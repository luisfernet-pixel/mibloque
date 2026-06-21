import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCuotaEstadoVigente, getCuotaMontoVigente } from "@/lib/cuotas";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatFecha(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}

type SearchParams = Promise<{ departamento?: string }>;

type DepartamentoRow = { id: string; numero: string | number | null };
type UsuarioVecinoRow = { id: string; nombre: string | null; departamento_id: string | null };
type CuotaRow = {
  id: string; periodo: string | null; monto_base?: number | null; mora_acumulada?: number | null; monto_total: number | null;
  estado: string | null; created_at: string | null; departamento_id: string | null; anio?: number | null; mes?: number | null; fecha_vencimiento?: string | null;
};
type PagoRow = {
  id: string; monto_pagado: number | null; fecha_pago: string | null;
  metodo_pago: string | null; departamento_id: string | null;
};
type Movimiento = {
  fecha: string | null; detalle: string; tipo: "cuota" | "pago";
  estado: string; monto: number;
};

type ConfigRow = {
  dia_vencimiento: number | null;
  valor_mora: number | null;
};

export default async function ReporteDepartamentoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = await searchParams;
  const supabase = await createClient();
  const bloqueId = usuario.perfil.bloque_id;

  const { data: departamentos } = await supabase
    .from("departamentos").select("id, numero").eq("bloque_id", bloqueId).order("numero");

  const departamentosRows = (departamentos ?? []) as DepartamentoRow[];
  const deptoIdActivo = params?.departamento || departamentos?.[0]?.id || "";
  const departamentoActual = departamentosRows.find((d) => d.id === deptoIdActivo) || null;

  const { data: usuarios } = await supabase
    .from("usuarios").select("id, nombre, departamento_id")
    .eq("bloque_id", bloqueId).eq("rol", "vecino").eq("activo", true);
  const usuariosRows = (usuarios ?? []) as UsuarioVecinoRow[];
  const vecino = usuariosRows.find((u) => u.departamento_id === deptoIdActivo) || null;

  const [{ data: cuotas }, { data: config }] = await Promise.all([
    supabase
      .from("cuotas").select("id, periodo, monto_base, mora_acumulada, monto_total, estado, created_at, departamento_id, anio, mes, fecha_vencimiento")
      .eq("bloque_id", bloqueId).eq("departamento_id", deptoIdActivo)
      .order("created_at", { ascending: false }),
    supabase
      .from("configuracion_bloque")
      .select("dia_vencimiento, valor_mora")
      .eq("bloque_id", bloqueId)
      .maybeSingle(),
  ]);
  const cuotasRows = ((cuotas ?? []) as CuotaRow[]).map((item) => ({
    ...item,
    monto_total: getCuotaMontoVigente(item, config as ConfigRow | null),
    estado: getCuotaEstadoVigente(item, config as ConfigRow | null),
  }));

  const { data: pagos } = await supabase
    .from("pagos").select("id, monto_pagado, fecha_pago, metodo_pago, departamento_id")
    .eq("bloque_id", bloqueId).eq("departamento_id", deptoIdActivo)
    .order("fecha_pago", { ascending: false });
  const pagosRows = (pagos ?? []) as PagoRow[];

  const estadosDeuda = new Set(["pendiente", "vencido"]);
  const cuotasPendientes = cuotasRows.filter((c) =>
    estadosDeuda.has(String(c.estado || "").toLowerCase())
  );
  const cuotasVencidas = cuotasRows.filter((c) =>
    String(c.estado || "").toLowerCase() === "vencido"
  );
  const deudaTotal = cuotasPendientes.reduce((acc, item) => acc + Number(item.monto_total || 0), 0);
  const totalPagado = pagosRows.reduce((acc, p) => acc + Number(p.monto_pagado || 0), 0);

  const estaAlDia = cuotasPendientes.length === 0;

  const movimientos: Movimiento[] = [
    ...cuotasRows.map((c) => ({
      fecha: c.created_at,
      detalle: `Cuota ${c.periodo || ""}`.trim(),
      tipo: "cuota" as const,
      estado: c.estado || "-",
      monto: Number(c.monto_total || 0),
    })),
    ...pagosRows.map((p) => ({
      fecha: p.fecha_pago,
      detalle: `Pago${p.metodo_pago ? ` — ${p.metodo_pago}` : ""}`,
      tipo: "pago" as const,
      estado: "registrado",
      monto: Number(p.monto_pagado || 0),
    })),
  ].sort((a, b) => new Date(b.fecha || "").getTime() - new Date(a.fecha || "").getTime());

  const fechaEmision = new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/La_Paz",
  }).format(new Date());

  return (
    <main className="space-y-4 print:space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:bg-white">
        <div className="grid gap-0 md:grid-cols-[1fr_auto]">
          <div className="p-6 md:p-8 print:p-0 print:pb-4 print:border-b print:border-slate-300">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400 print:text-slate-500">
              Reporte por Unidad
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white md:text-4xl print:text-slate-900 print:text-3xl">
              Departamento {departamentoActual?.numero ?? "—"}
            </h1>
            <p className="mt-1 text-base text-slate-300 print:text-slate-600">
              {vecino?.nombre ?? "Sin vecino asignado"}
            </p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-400">
              Emitido el {fechaEmision} · Administrador: {usuario.perfil.nombre ?? "—"}
            </p>
          </div>

          {/* Selector — solo pantalla */}
          <div className="border-l border-white/10 bg-[#162b42] p-5 print:hidden min-w-[240px]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-4">
              Seleccionar unidad
            </p>
            <form method="GET" className="space-y-3">
              <select
                name="departamento"
                defaultValue={deptoIdActivo}
                className="w-full rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
              >
                {departamentosRows.map((d) => (
                  <option key={d.id} value={d.id}>Depto. {d.numero}</option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500"
              >
                Ver unidad
              </button>
            </form>
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link
                href="/admin/reportes"
                className="text-xs text-slate-400 hover:text-slate-200 transition"
              >
                ← Volver a reportes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── I. Estado de la unidad ───────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="I"
          titulo="Estado de la Unidad"
          subtitulo="Situación financiera actual del departamento"
        />
        <div className="p-5 print:p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricaCard
              label="Estado actual"
              valor={estaAlDia ? "Al día" : "Con adeudo"}
              descripcion={estaAlDia ? "Sin cuotas pendientes" : "Requiere atención"}
              color={estaAlDia ? "positivo" : "negativo"}
            />
            <MetricaCard
              label="Cuotas pendientes"
              valor={String(cuotasPendientes.length)}
              descripcion="Sin pagar"
              color={cuotasPendientes.length === 0 ? "neutro" : "advertencia"}
            />
            <MetricaCard
              label="Cuotas vencidas"
              valor={String(cuotasVencidas.length)}
              descripcion="Plazo superado"
              color={cuotasVencidas.length === 0 ? "neutro" : "critico"}
            />
            <MetricaCard
              label="Deuda total"
              valor={formatBs(deudaTotal)}
              descripcion="Monto adeudado acumulado"
              color={deudaTotal === 0 ? "neutro" : "negativo"}
              grande
            />
          </div>
        </div>
      </section>

      {/* ── II. Resumen financiero ───────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="II"
          titulo="Resumen Financiero"
          subtitulo="Totales históricos de la unidad"
        />
        <div className="p-5 print:p-4">
          <table className="w-full text-sm print:text-xs">
            <tbody className="divide-y divide-white/5 print:divide-slate-200">
              <FilaTabla
                concepto="Total cuotas emitidas"
                monto={String(cuotasRows.length)}
                descripcion="Cuotas generadas en el historial de la unidad"
                unidad
              />
              <FilaTabla
                concepto="Total pagos registrados"
                monto={String(pagosRows.length)}
                descripcion="Transacciones de pago recibidas"
                unidad
              />
              <FilaTabla
                concepto="Monto total pagado"
                monto={formatBs(totalPagado)}
                descripcion="Suma de todos los pagos recibidos"
              />
              <FilaTabla
                concepto="Monto total adeudado"
                monto={formatBs(deudaTotal)}
                descripcion="Suma de cuotas pendientes y vencidas"
                resaltado
                color={deudaTotal === 0 ? "neutro" : "negativo"}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── III. Historial de movimientos ────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="III"
          titulo="Historial de Movimientos"
          subtitulo="Cuotas emitidas y pagos recibidos, en orden cronológico descendente"
        />
        <div className="p-5 print:p-4">
          {movimientos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-5 py-10 text-center">
              <p className="text-slate-400 print:text-slate-500">Esta unidad no registra movimientos.</p>
            </div>
          ) : (
            <>
              {/* Tabla escritorio / impresión */}
              <div className="hidden md:block print:block overflow-x-auto">
                <table className="w-full text-sm print:text-xs">
                  <thead>
                    <tr className="border-b border-white/10 print:border-slate-300">
                      <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Fecha</th>
                      <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Concepto</th>
                      <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Tipo</th>
                      <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Estado</th>
                      <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 print:divide-slate-200">
                    {movimientos.map((m, i) => {
                      const esPago = m.tipo === "pago";
                      const estadoNorm = String(m.estado).toLowerCase();
                      const estadoColor =
                        esPago ? "text-emerald-400 print:text-emerald-700" :
                        estadoNorm === "vencido" ? "text-red-400 print:text-red-700" :
                        estadoNorm === "pendiente" ? "text-amber-400 print:text-amber-700" :
                        estadoNorm === "pagado" ? "text-slate-400 print:text-slate-500" :
                        "text-slate-400 print:text-slate-500";

                      return (
                        <tr key={i} className="hover:bg-white/5 transition print:hover:bg-transparent">
                          <td className="py-3 text-slate-300 print:text-slate-600 print:py-2 whitespace-nowrap">
                            {formatFecha(m.fecha)}
                          </td>
                          <td className="py-3 font-medium text-white print:text-slate-800 print:py-2">
                            {m.detalle}
                          </td>
                          <td className="py-3 text-center print:py-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              esPago
                                ? "bg-emerald-500/15 text-emerald-400 print:text-emerald-700"
                                : "bg-cyan-500/15 text-cyan-400 print:text-cyan-700"
                            }`}>
                              {esPago ? "Pago" : "Cuota"}
                            </span>
                          </td>
                          <td className="py-3 text-center print:py-2">
                            <span className={`text-xs font-semibold capitalize ${estadoColor}`}>
                              {m.estado}
                            </span>
                          </td>
                          <td className={`py-3 text-right font-bold tabular-nums print:py-2 ${
                            esPago
                              ? "text-emerald-400 print:text-emerald-700"
                              : "text-white print:text-slate-800"
                          }`}>
                            {formatBs(m.monto)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards móvil */}
              <div className="md:hidden space-y-2">
                {movimientos.map((m, i) => {
                  const esPago = m.tipo === "pago";
                  return (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-white text-sm">{m.detalle}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatFecha(m.fecha)}</p>
                        </div>
                        <span className={`shrink-0 font-bold text-sm tabular-nums ${esPago ? "text-emerald-400" : "text-white"}`}>
                          {formatBs(m.monto)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          esPago ? "bg-emerald-500/15 text-emerald-400" : "bg-cyan-500/15 text-cyan-400"
                        }`}>
                          {esPago ? "Pago" : "Cuota"}
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize self-center">{m.estado}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Nota ──────────────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 print:rounded-none print:border-slate-200 print:bg-transparent">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">Nota metodológica</p>
        <ul className="space-y-1 text-xs text-slate-400 print:text-slate-500 list-disc list-inside">
          <li>El historial incluye cuotas emitidas y pagos registrados desde el inicio de operaciones.</li>
          <li>El monto adeudado considera únicamente cuotas con estado "pendiente" o "vencido".</li>
          <li>Las cuotas impagas muestran la mora mensual vigente según la configuración del bloque.</li>
        </ul>
      </section>

    </main>
  );
}

// ─── Componentes ───────────────────────────────────────────────────────────────

function SectionHeader({ numero, titulo, subtitulo }: { numero: string; titulo: string; subtitulo: string }) {
  return (
    <div className="border-b border-white/10 px-5 py-4 flex gap-4 items-start print:border-slate-200 print:px-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/20 print:bg-slate-100 print:text-slate-600 print:ring-slate-300">
        {numero}
      </span>
      <div>
        <h2 className="text-base font-bold text-white print:text-slate-900">{titulo}</h2>
        <p className="text-xs text-slate-500 print:text-slate-400">{subtitulo}</p>
      </div>
    </div>
  );
}

function MetricaCard({ label, valor, descripcion, color, grande = false }: {
  label: string; valor: string; descripcion: string;
  color: "positivo" | "negativo" | "neutro" | "advertencia" | "critico";
  grande?: boolean;
}) {
  const borde = { positivo: "border-emerald-500/20", negativo: "border-red-500/20", neutro: "border-white/10", advertencia: "border-amber-500/20", critico: "border-red-600/30" }[color];
  const texto = { positivo: "text-emerald-400 print:text-emerald-700", negativo: "text-red-400 print:text-red-700", neutro: "text-white print:text-slate-800", advertencia: "text-amber-400 print:text-amber-700", critico: "text-red-300 print:text-red-800" }[color];
  return (
    <div className={`rounded-xl border bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b print:border-slate-200 ${borde}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${grande ? "text-2xl" : "text-xl"} ${texto}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">{descripcion}</p>
    </div>
  );
}

function FilaTabla({ concepto, monto, descripcion, resaltado = false, color = "neutro", unidad = false }: {
  concepto: string; monto: string; descripcion: string;
  resaltado?: boolean; color?: "neutro" | "negativo" | "positivo"; unidad?: boolean;
}) {
  const colorMonto = { neutro: "text-white print:text-slate-900", negativo: "text-red-400 print:text-red-700", positivo: "text-emerald-400 print:text-emerald-700" }[color];
  return (
    <tr className={resaltado ? "bg-white/5 print:bg-slate-50" : ""}>
      <td className="py-3 pr-4 print:py-2">
        <p className={`font-medium ${resaltado ? "text-white print:text-slate-900" : "text-slate-200 print:text-slate-700"}`}>{concepto}</p>
        <p className="text-xs text-slate-500 print:text-slate-400">{descripcion}</p>
      </td>
      <td className={`py-3 pl-4 text-right font-bold tabular-nums print:py-2 ${resaltado ? "text-lg" : "text-base"} ${colorMonto}`}>
        {unidad ? <span className="text-slate-300 print:text-slate-600">{monto} cuota{Number(monto) !== 1 ? "s" : ""}</span> : monto}
      </td>
    </tr>
  );
}
