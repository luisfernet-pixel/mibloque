import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type SearchParams = Promise<{
  departamento?: string;
}>;

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
    .from("departamentos")
    .select("id, numero")
    .eq("bloque_id", bloqueId)
    .order("numero");

  const deptoIdActivo = params?.departamento || departamentos?.[0]?.id || "";

  const departamentoActual =
    departamentos?.find((d: any) => d.id === deptoIdActivo) || null;

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nombre, departamento_id")
    .eq("bloque_id", bloqueId)
    .eq("rol", "vecino")
    .eq("activo", true);

  const vecino =
    usuarios?.find((u: any) => u.departamento_id === deptoIdActivo) || null;

  const { data: cuotas } = await supabase
    .from("cuotas")
    .select("id, periodo, monto_total, estado, created_at, departamento_id")
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", deptoIdActivo)
    .order("created_at", { ascending: false });

  const { data: pagos } = await supabase
    .from("pagos")
    .select("id, monto_pagado, fecha_pago, metodo_pago, departamento_id")
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", deptoIdActivo)
    .order("fecha_pago", { ascending: false });

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  const cuotasPendientes = (cuotas || []).filter((c: any) =>
    estadosDeuda.has(String(c.estado || "").toLowerCase())
  );

  const deudaTotal = cuotasPendientes.reduce(
    (acc: number, item: any) => acc + Number(item.monto_total || 0),
    0
  );

  const movimientos = [
    ...((cuotas || []).map((c: any) => ({
      fecha: c.created_at,
      detalle: `Cuota ${c.periodo || ""}`.trim(),
      tipo: "cuota",
      estado: c.estado || "-",
      monto: Number(c.monto_total || 0),
    })) || []),

    ...((pagos || []).map((p: any) => ({
      fecha: p.fecha_pago,
      detalle: `Pago ${p.metodo_pago || ""}`.trim(),
      tipo: "pago",
      estado: "registrado",
      monto: Number(p.monto_pagado || 0),
    })) || []),
  ].sort((a, b) => {
    const fa = new Date(a.fecha || "").getTime();
    const fb = new Date(b.fecha || "").getTime();
    return fb - fa;
  });

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Reporte detallado
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Por departamento
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Consulta deuda, pagos y movimientos históricos por unidad.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">
              Seleccionar departamento
            </p>

            <form method="GET" className="mt-5 space-y-3">
              <select
                name="departamento"
                defaultValue={deptoIdActivo}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none"
              >
                {(departamentos || []).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.numero}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#ff5a3d] px-5 py-3 font-bold text-white transition hover:brightness-110"
              >
                Ver reporte
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Departamento" value={departamentoActual?.numero || "-"} />
        <Card title="Vecino" value={vecino?.nombre || "Sin asignar"} />
        <Card
          title="Estado"
          value={cuotasPendientes.length > 0 ? "Con deuda" : "Al día"}
        />
        <Card
          title="Pendientes"
          value={String(cuotasPendientes.length)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Mini title="Deuda total" value={formatBs(deudaTotal)} />
        <Mini title="Pagos registrados" value={String((pagos || []).length)} />
        <Mini title="Movimientos" value={String(movimientos.length)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Historial completo
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Movimientos del departamento
          </h2>
        </div>

        <div className="p-4 md:p-5">
          {movimientos.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center text-slate-300">
              Este departamento no tiene movimientos todavía.
            </div>
          ) : (
            <div className="space-y-4">
              {movimientos.map((m, i) => (
                <div
                  key={i}
                  className="grid gap-4 rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 md:grid-cols-[180px_1fr_120px_140px_160px] md:items-center"
                >
                  <div>
                    <p className="text-sm text-slate-300">Fecha</p>
                    <p className="mt-1 text-white font-semibold">
                      {m.fecha
                        ? new Date(m.fecha).toLocaleDateString("es-BO")
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Detalle</p>
                    <p className="mt-1 text-white font-semibold">
                      {m.detalle}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Tipo</p>
                    <p className="mt-1 text-white capitalize">{m.tipo}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Estado</p>
                    <p className="mt-1 text-white capitalize">{m.estado}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Monto</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {formatBs(m.monto)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{title}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Mini({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#2d4a6c] p-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}