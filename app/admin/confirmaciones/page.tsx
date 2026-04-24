import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

type ConfirmacionRow = {
  id: string;
  referencia: string | null;
  monto_reportado: number | null;
  comprobante_url: string | null;
  estado: string | null;
  created_at: string | null;
  revisado_at?: string | null;
  departamentos:
    | {
        numero: string | number | null;
      }
    | {
        numero: string | number | null;
      }[]
    | null;
  cuotas:
    | {
        periodo: string | null;
        monto_total: number | null;
      }
    | {
        periodo: string | null;
        monto_total: number | null;
      }[]
    | null;
};

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-BO");
}

function getDepto(
  value: ConfirmacionRow["departamentos"]
) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero ?? "-";
}

function getPeriodo(
  value: ConfirmacionRow["cuotas"]
) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.periodo ?? "-" : value.periodo ?? "-";
}

function getMontoCuota(
  value: ConfirmacionRow["cuotas"]
) {
  if (!value) return 0;
  return Array.isArray(value)
    ? Number(value[0]?.monto_total ?? 0)
    : Number(value.monto_total ?? 0);
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const e = String(estado || "").toLowerCase();

  const style =
    e === "aprobado"
      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
      : e === "rechazado"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-orange-400/30 bg-orange-500/10 text-orange-200";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold capitalize ${style}`}
    >
      {estado || "sin estado"}
    </span>
  );
}

export default async function AdminConfirmacionesPage() {
  const usuario = await requireAdmin();
  if (!usuario) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;

  const { data } = await supabase
    .from("confirmaciones_pago")
    .select(`
      id,
      referencia,
      monto_reportado,
      comprobante_url,
      estado,
      created_at,
      revisado_at,
      departamentos:departamento_id (
        numero
      ),
      cuotas:cuota_id (
        periodo,
        monto_total
      )
    `)
    .eq("bloque_id", bloqueId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ConfirmacionRow[];

  const pendientes = rows.filter(
    (item) => String(item.estado || "").toLowerCase() === "pendiente"
  );
  const aprobadas = rows.filter(
    (item) => String(item.estado || "").toLowerCase() === "aprobado"
  );
  const rechazadas = rows.filter(
    (item) => String(item.estado || "").toLowerCase() === "rechazado"
  );

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Validación de pagos
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Confirmaciones
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Revisa los comprobantes enviados por los vecinos y aprueba solo los
              pagos correctos para mantener el bloque al día.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/cuotas"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Ver cobros
              </Link>

              <Link
                href="/admin"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Volver al inicio
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Resumen de revisión
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Estado general
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Pendientes" value={String(pendientes.length)} />
              <InfoBox label="Aprobadas" value={String(aprobadas.length)} />
              <InfoBox label="Rechazadas" value={String(rechazadas.length)} />
              <InfoBox label="Total" value={String(rows.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pendientes" value={String(pendientes.length)} tone="orange" />
        <KpiCard title="Aprobadas" value={String(aprobadas.length)} tone="cyan" />
        <KpiCard title="Rechazadas" value={String(rechazadas.length)} tone="red" />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Revisión principal
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Confirmaciones pendientes
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Estas requieren atención inmediata.
            </p>
          </div>

          <div className="w-fit rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
            {pendientes.length} pendiente(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {pendientes.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay confirmaciones pendientes
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Todo lo enviado ya fue revisado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendientes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 shadow-lg"
                >
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Departamento
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {getDepto(item.departamentos)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Periodo
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {getPeriodo(item.cuotas)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Monto reportado
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {money(item.monto_reportado)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Cuota esperada
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {money(getMontoCuota(item.cuotas))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px_180px] md:items-end">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Referencia
                      </p>
                      <p className="mt-2 text-slate-100">
                        {item.referencia || "Sin referencia"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Enviado
                      </p>
                      <p className="mt-2 text-slate-100">
                        {formatDate(item.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Estado
                      </p>
                      <div className="mt-2">
                        <EstadoBadge estado={item.estado} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    {item.comprobante_url ? (
                      <Link
                        href={item.comprobante_url}
                        target="_blank"
                        className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        Ver comprobante
                      </Link>
                    ) : null}

                    <form
                      action={`/admin/confirmaciones/${item.id}/aprobar`}
                      method="post"
                    >
                      <button className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-5 text-sm font-bold text-white transition hover:brightness-110">
                        Aprobar
                      </button>
                    </form>

                    <form
                      action={`/admin/confirmaciones/${item.id}/rechazar`}
                      method="post"
                    >
                      <button className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 px-5 text-sm font-bold text-red-200 transition hover:bg-red-500/15">
                        Rechazar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Historial
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Confirmaciones revisadas
          </h2>
        </div>

        <div className="p-4 md:p-5">
          {aprobadas.length + rechazadas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                Aún no hay confirmaciones revisadas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...aprobadas, ...rechazadas].map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 shadow-lg"
                >
                  <div className="grid gap-4 md:grid-cols-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Departamento
                      </p>
                      <p className="mt-2 font-bold text-white">
                        {getDepto(item.departamentos)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Periodo
                      </p>
                      <p className="mt-2 font-bold text-white">
                        {getPeriodo(item.cuotas)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Monto
                      </p>
                      <p className="mt-2 font-bold text-white">
                        {money(item.monto_reportado)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Revisado
                      </p>
                      <p className="mt-2 text-slate-100">
                        {formatDate(item.revisado_at || item.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Estado
                      </p>
                      <div className="mt-2">
                        <EstadoBadge estado={item.estado} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                      Referencia
                    </p>
                    <p className="mt-2 text-slate-100">
                      {item.referencia || "Sin referencia"}
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

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "orange" | "cyan" | "red";
}) {
  const tones = {
    orange: "border-orange-400/30 bg-orange-500/10",
    cyan: "border-cyan-500/20 bg-cyan-500/10",
    red: "border-red-400/30 bg-red-500/10",
  };

  return (
    <div className={`rounded-[24px] border p-5 text-white shadow-xl ${tones[tone]}`}>
      <p className="text-sm text-slate-200">{title}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
