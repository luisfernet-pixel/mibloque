import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCuotaMontoVigente } from "@/lib/cuotas";
import { formatPeriodoLabel } from "@/lib/periodo";

type ConfirmacionRow = {
  id: string;
  departamento_id: string | null;
  cuota_id: string | null;
  referencia: string | null;
  monto_reportado: number | null;
  comprobante_path: string | null;
  estado: string | null;
  created_at: string | null;
  revisado_at?: string | null;
  departamentos: { numero: string | number | null } | { numero: string | number | null }[] | null;
  cuotas:
    | { periodo: string | null; monto_base?: number | null; mora_acumulada?: number | null; monto_total: number | null; estado?: string | null; anio?: number | null; mes?: number | null; fecha_vencimiento?: string | null; created_at?: string | null }
    | { periodo: string | null; monto_base?: number | null; mora_acumulada?: number | null; monto_total: number | null; estado?: string | null; anio?: number | null; mes?: number | null; fecha_vencimiento?: string | null; created_at?: string | null }[]
    | null;
};

type ConfigRow = { dia_vencimiento: number | null; valor_mora: number | null };

type DepartamentoRow = { id: string; numero: string | number | null };
type CuotaRow = {
  id: string;
  periodo: string | null;
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number | null;
  estado?: string | null;
  anio?: number | null;
  mes?: number | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString("es-BO") : "Sin fecha"; }
function getDepto(value: ConfirmacionRow["departamentos"]) { return !value ? "-" : Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero ?? "-"; }
function getPeriodo(value: ConfirmacionRow["cuotas"]) { return !value ? "-" : Array.isArray(value) ? value[0]?.periodo ?? "-" : value.periodo ?? "-"; }
function getMontoCuota(value: ConfirmacionRow["cuotas"], config: ConfigRow | null) { if (!value) return 0; const cuota = Array.isArray(value) ? value[0] : value; return cuota ? getCuotaMontoVigente(cuota, config) : 0; }
function monthGroupKey(value?: string | null) { if (!value) return "sin-fecha"; const d = new Date(value); if (Number.isNaN(d.getTime())) return "sin-fecha"; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthGroupLabel(key: string) {
  if (key === "sin-fecha") return "Sin fecha";
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const e = String(estado || "").toLowerCase();
  const style = e === "aprobado" ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200" : e === "rechazado" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-orange-400/30 bg-orange-500/10 text-orange-200";
  return <span className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold capitalize ${style}`}>{estado || "sin estado"}</span>;
}

export default async function AdminConfirmacionesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const errorParam = Array.isArray(params.error) ? String(params.error[0] || "") : String(params.error || "");
  const servicioSuspendido = errorParam === "servicio_suspendido";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  const supabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;

  const [{ data: confirmacionesData }, { data: config }] = await Promise.all([
    supabase
      .from("confirmaciones_pago")
      .select("id, departamento_id, cuota_id, referencia, monto_reportado, comprobante_path, estado, created_at, revisado_at")
      .eq("bloque_id", bloqueId)
      .order("created_at", { ascending: false }),
    supabase.from("configuracion_bloque").select("dia_vencimiento, valor_mora").eq("bloque_id", bloqueId).maybeSingle(),
  ]);

  const baseRows = (confirmacionesData ?? []) as Omit<ConfirmacionRow, "departamentos" | "cuotas">[];
  const departamentoIds = Array.from(new Set(baseRows.map((item) => item.departamento_id).filter(Boolean))) as string[];
  const cuotaIds = Array.from(new Set(baseRows.map((item) => item.cuota_id).filter(Boolean))) as string[];

  const [{ data: departamentosData }, { data: cuotasData }] = await Promise.all([
    departamentoIds.length
      ? supabase.from("departamentos").select("id, numero").eq("bloque_id", bloqueId).in("id", departamentoIds)
      : Promise.resolve({ data: [] as DepartamentoRow[] }),
    cuotaIds.length
      ? supabase
          .from("cuotas")
          .select("id, periodo, monto_base, mora_acumulada, monto_total, estado, anio, mes, fecha_vencimiento, created_at")
          .eq("bloque_id", bloqueId)
          .in("id", cuotaIds)
      : Promise.resolve({ data: [] as CuotaRow[] }),
  ]);

  const departamentosById = new Map(
    ((departamentosData ?? []) as DepartamentoRow[]).map((item) => [item.id, { numero: item.numero }])
  );
  const cuotasById = new Map(
    ((cuotasData ?? []) as CuotaRow[]).map((item) => {
      const { id: cuotaRowId, ...cuota } = item;
      return [cuotaRowId, cuota];
    })
  );

  const rows = baseRows.map((item) => ({
    ...item,
    departamentos: item.departamento_id ? departamentosById.get(item.departamento_id) ?? null : null,
    cuotas: item.cuota_id ? cuotasById.get(item.cuota_id) ?? null : null,
  })) as ConfirmacionRow[];
  const pendientes = rows.filter((item) => String(item.estado || "").toLowerCase() === "pendiente");
  const aprobadas = rows.filter((item) => String(item.estado || "").toLowerCase() === "aprobado");
  const rechazadas = rows.filter((item) => String(item.estado || "").toLowerCase() === "rechazado");
  const revisadas = [...aprobadas, ...rechazadas];
  const revisadasPorMes = new Map<string, ConfirmacionRow[]>();
  for (const item of revisadas) {
    const key = monthGroupKey(item.revisado_at || item.created_at);
    revisadasPorMes.set(key, [...(revisadasPorMes.get(key) ?? []), item]);
  }
  const gruposRevisadasMes = Array.from(revisadasPorMes.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <main className="space-y-3">
      {servicioSuspendido ? (
        <section className="rounded-2xl border border-orange-300/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100">
          El servicio de este bloque se encuentra temporalmente suspendido por estado de facturacion.
        </section>
      ) : null}
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Validación de pagos</p>
            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">Comprobantes por revisar</h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">Revisa los comprobantes enviados por los vecinos y aprueba solo los pagos correctos para mantener el bloque al día.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin/pagos/deudas" className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20">Ver quien debe</Link>
              <Link href="/admin" className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10">Volver al inicio</Link>
            </div>
          </div>
          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-sm font-semibold text-white">Resumen de revisión</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Por revisar" value={String(pendientes.length)} />
              <InfoBox label="Aprobadas" value={String(aprobadas.length)} />
              <InfoBox label="Rechazadas" value={String(rechazadas.length)} />
              <InfoBox label="Total" value={String(rows.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Revisión principal</p>
            <h2 className="mt-2 text-xl font-bold text-white">Comprobantes pendientes</h2>
          </div>
          <div className="w-fit rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">{pendientes.length} pendiente(s)</div>
        </div>
        <div className="p-4 md:p-4">
          {pendientes.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/20 bg-[#2b4768] px-4 py-6 text-center">
              <p className="text-lg font-bold text-white">Todo al día · No hay comprobantes pendientes por revisar.</p>
              <div className="mt-3"><Link href="/admin/pagos/deudas" className="inline-flex h-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20">Ver quién debe</Link></div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendientes.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-white/20 bg-[#2d4a6c] p-3 shadow-lg">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Departamento</p><p className="mt-2 text-lg font-bold text-white">{getDepto(item.departamentos)}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Periodo</p><p className="mt-2 text-lg font-bold text-white">{formatPeriodoLabel(getPeriodo(item.cuotas))}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Monto reportado</p><p className="mt-2 text-lg font-bold text-white">{money(item.monto_reportado)}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Cuota esperada</p><p className="mt-2 text-lg font-bold text-white">{money(getMontoCuota(item.cuotas, config as ConfigRow | null))}</p></div>
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Comprobante</p>
                      {item.comprobante_path ? (
                        <Link
                          href={`/api/admin/confirmaciones/${item.id}/comprobante`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20 hover:text-white"
                        >
                          Ver comprobante
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold text-slate-200">Sin comprobante adjunto</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <form action={`/admin/confirmaciones/${item.id}/rechazar`} method="post">
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 hover:text-white active:scale-[0.98]"
                        >
                          Rechazar
                        </button>
                      </form>
                      <form action={`/admin/confirmaciones/${item.id}/aprobar`} method="post">
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20 hover:text-white active:scale-[0.98]"
                        >
                          Aprobar
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <details className="group">
          <summary className="cursor-pointer list-none border-b border-white/10 px-4 py-3 md:px-4">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Historial</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Confirmaciones revisadas</h2>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">{revisadas.length} registro(s)</span>
            </div>
          </summary>
          <div className="p-4 md:p-4">
            {revisadas.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center"><p className="text-lg font-bold text-white">Aún no hay confirmaciones revisadas</p></div>
            ) : (
              <div className="space-y-2">
                {gruposRevisadasMes.map(([mesKey, items], index) => (
                  <details key={mesKey} open={index === 0} className="group rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                    <summary className="list-none cursor-pointer text-sm font-semibold text-cyan-100">
                      <span className="inline-flex items-center gap-2">
                        <span className="group-open:hidden">{">"}</span>
                        <span className="hidden group-open:inline">v</span>
                        <span>{monthGroupLabel(mesKey)} ({items.length})</span>
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-[22px] border border-white/20 bg-[#2d4a6c] p-3 shadow-lg">
                          <div className="grid gap-3 md:grid-cols-5">
                            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Departamento</p><p className="mt-2 font-bold text-white">{getDepto(item.departamentos)}</p></div>
                            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Periodo</p><p className="mt-2 font-bold text-white">{formatPeriodoLabel(getPeriodo(item.cuotas))}</p></div>
                            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Monto</p><p className="mt-2 font-bold text-white">{money(item.monto_reportado)}</p></div>
                            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Revisado</p><p className="mt-2 text-slate-100">{formatDate(item.revisado_at || item.created_at)}</p></div>
                            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-300">Estado</p><div className="mt-2"><EstadoBadge estado={item.estado} /></div></div>
                          </div>
                          <div className="mt-4 border-t border-white/10 pt-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Referencia</p>
                            <p className="mt-2 text-slate-100">{item.referencia || "Sin referencia"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
