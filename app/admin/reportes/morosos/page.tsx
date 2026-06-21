import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/print-button";
import { getCuotaEstadoVigente, getCuotaMontoVigente } from "@/lib/cuotas";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type MorosoItem = {
  departamento: string;
  vecino: string;
  pendientes: number;
  vencidos: number;
  deuda: number;
};

type DepartamentoRow = { id: string; numero: string | number | null };
type UsuarioVecinoRow = { nombre: string | null; departamento_id: string | null };
type CuotaRow = {
  id: string;
  departamento_id: string | null;
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number | null;
  estado: string | null;
  anio?: number | null;
  mes?: number | null;
  periodo?: string | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

type ConfigRow = {
  dia_vencimiento: number | null;
  valor_mora: number | null;
};

export default async function MorososPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const bloqueId = usuario.perfil.bloque_id;

  const [departamentosRes, usuariosRes, cuotasRes, configRes] = await Promise.all([
    supabase.from("departamentos").select("id, numero").eq("bloque_id", bloqueId).order("numero"),
    supabase.from("usuarios").select("nombre, departamento_id").eq("bloque_id", bloqueId).eq("rol", "vecino").eq("activo", true),
    supabase.from("cuotas").select("id, departamento_id, monto_base, mora_acumulada, monto_total, estado, anio, mes, periodo, fecha_vencimiento, created_at").eq("bloque_id", bloqueId),
    supabase.from("configuracion_bloque").select("dia_vencimiento, valor_mora").eq("bloque_id", bloqueId).maybeSingle(),
  ]);

  const departamentos = (departamentosRes.data ?? []) as DepartamentoRow[];
  const usuarios = (usuariosRes.data ?? []) as UsuarioVecinoRow[];
  const cuotas = ((cuotasRes.data ?? []) as CuotaRow[]).map((item) => ({
    ...item,
    monto_total: getCuotaMontoVigente(item, configRes.data as ConfigRow | null),
    estado: getCuotaEstadoVigente(item, configRes.data as ConfigRow | null),
  }));

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  const lista: MorosoItem[] = departamentos
    .map((depto) => {
      const vecino = usuarios.find((u) => u.departamento_id === depto.id)?.nombre || "Sin asignar";
      const pendientes = cuotas.filter(
        (c) => c.departamento_id === depto.id && estadosDeuda.has(String(c.estado || "").toLowerCase())
      );
      const vencidos = pendientes.filter((c) => String(c.estado || "").toLowerCase() === "vencido").length;
      const deuda = pendientes.reduce((acc, item) => acc + Number(item.monto_total || 0), 0);
      return {
        departamento: String(depto.numero || "-"),
        vecino,
        pendientes: pendientes.length,
        vencidos,
        deuda,
      };
    })
    .filter((item) => item.pendientes > 0)
    .sort((a, b) => b.deuda - a.deuda);

  const deudaTotal = lista.reduce((acc, item) => acc + item.deuda, 0);
  const totalPendientes = lista.reduce((acc, item) => acc + item.pendientes, 0);
  const totalVencidos = lista.reduce((acc, item) => acc + item.vencidos, 0);

  const fechaEmision = new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/La_Paz",
  }).format(new Date());

  return (
    <main className="space-y-4 print:space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 p-6 md:p-8 print:rounded-none print:ring-0 print:bg-white print:p-0 print:pb-4 print:border-b print:border-slate-300">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400 print:text-slate-500">
              Reporte de Cobranza
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white md:text-4xl print:text-slate-900 print:text-3xl">
              Unidades con Adeudo
            </h1>
            <p className="mt-1 text-sm text-slate-400 print:text-slate-500">
              Relación de departamentos con cuotas pendientes o vencidas al {fechaEmision}
            </p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-400">
              Administrador: {usuario.perfil.nombre ?? "—"}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Link
              href="/admin/reportes"
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10"
            >
              ← Volver
            </Link>
            <PrintButton label="Imprimir" />
          </div>
        </div>
      </section>

      {/* ── I. Resumen ejecutivo ─────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="I"
          titulo="Resumen Ejecutivo"
          subtitulo="Indicadores globales de la situación de cobranza"
        />
        <div className="p-5 print:p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricaCard label="Unidades con adeudo" valor={String(lista.length)} color="negativo" descripcion="Departamentos con deuda activa" />
            <MetricaCard label="Cuotas pendientes" valor={String(totalPendientes - totalVencidos)} color="advertencia" descripcion="Cuotas por vencer" />
            <MetricaCard label="Cuotas vencidas" valor={String(totalVencidos)} color="critico" descripcion="Cuotas con plazo superado" />
            <MetricaCard label="Deuda total" valor={formatBs(deudaTotal)} color="negativo" descripcion="Monto total adeudado" grande />
          </div>

          {lista.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 print:border-emerald-300 print:bg-emerald-50">
              <p className="font-semibold text-emerald-300 print:text-emerald-800">
                Sin adeudos registrados.
              </p>
              <p className="mt-0.5 text-xs text-emerald-400 print:text-emerald-600">
                Todos los departamentos se encuentran al día con sus cuotas de mantenimiento.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 print:border-orange-300 print:bg-orange-50">
              <p className="text-sm font-semibold text-orange-200 print:text-orange-800">
                Se requiere gestión de cobro en {lista.length} unidad{lista.length !== 1 ? "es" : ""}.
              </p>
              <p className="mt-0.5 text-xs text-orange-300 print:text-orange-600">
                La tabla a continuación está ordenada por monto adeudado de mayor a menor.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── II. Detalle por unidad ───────────────────────────────────────────── */}
      {lista.length > 0 && (
        <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
          <SectionHeader
            numero="II"
            titulo="Detalle por Unidad"
            subtitulo="Ordenado por monto adeudado descendente"
          />
          <div className="p-5 print:p-4">
            {/* Tabla para pantallas medianas y grandes */}
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead>
                  <tr className="border-b border-white/10 print:border-slate-300">
                    <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Depto.</th>
                    <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Propietario / Vecino</th>
                    <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Pendientes</th>
                    <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Vencidas</th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Monto adeudado</th>
                    <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-400 print:hidden">Situación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-slate-200">
                  {lista.map((item, i) => (
                    <tr key={i} className="group hover:bg-white/5 transition print:hover:bg-transparent">
                      <td className="py-3 font-bold text-white print:text-slate-900 print:py-2">
                        {item.departamento}
                      </td>
                      <td className="py-3 text-slate-300 print:text-slate-700 print:py-2">
                        {item.vecino}
                      </td>
                      <td className="py-3 text-center print:py-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300 print:bg-transparent print:text-amber-700">
                          {item.pendientes}
                        </span>
                      </td>
                      <td className="py-3 text-center print:py-2">
                        {item.vencidos > 0 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-400 print:bg-transparent print:text-red-700">
                            {item.vencidos}
                          </span>
                        ) : (
                          <span className="text-slate-600 print:text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold tabular-nums text-orange-300 print:text-orange-700 print:py-2">
                        {formatBs(item.deuda)}
                      </td>
                      <td className="py-3 text-center print:hidden">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          item.vencidos > 0
                            ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}>
                          {item.vencidos > 0 ? "Crítico" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/20 print:border-slate-400">
                    <td colSpan={4} className="pt-3 font-bold text-slate-300 print:text-slate-700 print:pt-2 text-sm">
                      Total general
                    </td>
                    <td className="pt-3 text-right font-bold tabular-nums text-white print:text-slate-900 text-base print:pt-2">
                      {formatBs(deudaTotal)}
                    </td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Cards para móvil */}
            <div className="md:hidden space-y-3">
              {lista.map((item, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-white">Depto. {item.departamento}</p>
                      <p className="text-sm text-slate-400">{item.vecino}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.vencidos > 0 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {item.vencidos > 0 ? "Crítico" : "Pendiente"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Pendientes</p>
                      <p className="font-bold text-amber-300">{item.pendientes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Vencidas</p>
                      <p className="font-bold text-red-400">{item.vencidos || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Deuda</p>
                      <p className="font-bold text-orange-300">{formatBs(item.deuda)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Nota ──────────────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 print:rounded-none print:border-slate-200 print:bg-transparent">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">Nota</p>
        <ul className="space-y-1 text-xs text-slate-400 print:text-slate-500 list-disc list-inside">
          <li>Se consideran cuotas con estado "pendiente" o "vencido" para este reporte.</li>
          <li>Las cuotas vencidas corresponden a períodos cuyo plazo de pago ha sido superado.</li>
          <li>El monto adeudado incluye la mora mensual vigente segun la configuracion del bloque.</li>
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

function MetricaCard({
  label, valor, descripcion, color, grande = false,
}: {
  label: string; valor: string; descripcion: string;
  color: "positivo" | "negativo" | "neutro" | "advertencia" | "critico";
  grande?: boolean;
}) {
  const borde = {
    positivo: "border-emerald-500/20 print:border-emerald-300",
    negativo: "border-red-500/20 print:border-red-300",
    neutro: "border-white/10 print:border-slate-200",
    advertencia: "border-amber-500/20 print:border-amber-300",
    critico: "border-red-600/30 print:border-red-400",
  }[color];

  const texto = {
    positivo: "text-emerald-400 print:text-emerald-700",
    negativo: "text-red-400 print:text-red-700",
    neutro: "text-white print:text-slate-800",
    advertencia: "text-amber-400 print:text-amber-700",
    critico: "text-red-300 print:text-red-800",
  }[color];

  return (
    <div className={`rounded-xl border bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b ${borde}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${grande ? "text-2xl" : "text-xl"} ${texto}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">{descripcion}</p>
    </div>
  );
}
