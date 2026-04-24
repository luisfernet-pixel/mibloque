import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

type CuotaRow = {
  id: string;
  periodo: string;
  monto_total: number;
  estado: string;
  anio: number;
  mes: number;
  departamento_id: string;
};

function bs(n: number) {
  return `Bs ${Number(n || 0).toLocaleString("es-BO")}`;
}

function parseDeptoNumero(value: string) {
  const cleaned = String(value || "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  const piso = Math.floor(num / 100);
  return { num, piso };
}

export default async function CuotasPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;

  const [{ data: departamentosData }, { data }] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("bloque_id", bloqueId),
    supabase
    .from("cuotas")
    .select(
      `
      id,
      periodo,
      monto_total,
      estado,
      anio,
      mes,
      departamento_id
    `
    )
    .eq("bloque_id", bloqueId)
    .order("periodo", { ascending: false }),
  ]);

  const cuotas = (data ?? []) as CuotaRow[];
  const departamentos =
    (departamentosData ?? []) as Array<{ id: string; numero: string | null }>;

  const pendientes = cuotas.filter((x) => x.estado === "pendiente");
  const vencidas = cuotas.filter((x) => x.estado === "vencido");
  const pagadas = cuotas.filter((x) => x.estado === "pagado");

  const totalPendiente = pendientes.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );
  const totalVencido = vencidas.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );
  const totalPagado = pagadas.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );

  const cuotasPorDepto = new Map<string, CuotaRow[]>();
  for (const cuota of cuotas) {
    const key = String(cuota.departamento_id || "");
    if (!key) continue;
    const list = cuotasPorDepto.get(key) ?? [];
    list.push(cuota);
    cuotasPorDepto.set(key, list);
  }

  const grupos = departamentos.map((depto) => {
    const cuotasDepto = cuotasPorDepto.get(depto.id) ?? [];
    const totalPendiente = cuotasDepto
      .filter((item) => item.estado === "pendiente")
      .reduce((a, x) => a + Number(x.monto_total || 0), 0);
    const totalVencido = cuotasDepto
      .filter((item) => item.estado === "vencido")
      .reduce((a, x) => a + Number(x.monto_total || 0), 0);

    return {
      departamento: String(depto.numero || "-"),
      cuotas: cuotasDepto,
      totalAdeudado: totalPendiente + totalVencido,
      totalPendiente,
      totalVencido,
    };
  });

  grupos.sort((a, b) => {
    const aNum = parseDeptoNumero(a.departamento);
    const bNum = parseDeptoNumero(b.departamento);

    if (aNum && bNum) {
      if (aNum.piso !== bNum.piso) return bNum.piso - aNum.piso;
      if (aNum.num !== bNum.num) return aNum.num - bNum.num;
      return 0;
    }

    if (aNum) return -1;
    if (bNum) return 1;
    return String(a.departamento).localeCompare(String(b.departamento), "es");
  });
  for (const grupo of grupos) {
    grupo.cuotas.sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return b.mes - a.mes;
    });
  }

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Cobros
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Cuotas y cobros
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Revisa deudas, pagos realizados y el estado general de cobro del
              bloque.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/confirmaciones"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Revisar comprobantes
              </Link>

              <Link
                href="/admin/pagos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Historial de pagos
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Resumen de cobranza
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Estado actual
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Pendientes" value={String(pendientes.length)} />
              <InfoBox label="Vencidas" value={String(vencidas.length)} />
              <InfoBox label="Pagadas" value={String(pagadas.length)} />
              <InfoBox label="Total cuotas" value={String(cuotas.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Mini titulo="Por cobrar" valor={bs(totalPendiente)} />
        <Mini titulo="Vencido" valor={bs(totalVencido)} />
        <Mini titulo="Ya cobrado" valor={bs(totalPagado)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Deudas del bloque
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Estado de cuotas por departamento
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Agrupado por departamento con total adeudado por unidad.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {departamentos.length} departamento(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {departamentos.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay departamentos registrados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grupos.map((grupo) => (
                <details
                  key={grupo.departamento}
                  className="group rounded-[24px] border border-white/20 bg-[#2d4a6c] p-4 md:p-5"
                >
                  <summary className="list-none cursor-pointer">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
                      <div>
                        <p className="text-sm text-slate-300">Departamento</p>
                        <p className="mt-1 text-xl font-bold text-white">
                          {grupo.departamento}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Total adeudado
                        </p>
                        <p className="mt-1 text-xl font-extrabold text-orange-200">
                          {bs(grupo.totalAdeudado)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Pendiente
                        </p>
                        <p className="mt-1 text-lg font-bold text-orange-100">
                          {bs(grupo.totalPendiente)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Vencido
                        </p>
                        <p className="mt-1 text-lg font-bold text-red-200">
                          {bs(grupo.totalVencido)}
                        </p>
                      </div>

                      <div className="self-center md:justify-self-end">
                        <span className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-sm font-bold text-cyan-100 transition group-open:hidden">
                          Ampliar
                        </span>
                        <span className="hidden min-h-[40px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition group-open:inline-flex">
                          Reducir
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 border-t border-white/10 pt-4 group-open:block">
                    <div>
                      {grupo.cuotas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/20 bg-[#264465] px-4 py-4 text-sm text-slate-200">
                          Sin cuotas registradas para este departamento.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {grupo.cuotas.map((item) => (
                            <div
                              key={item.id}
                              className="grid gap-3 rounded-2xl border border-white/10 bg-[#264465] px-4 py-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                            >
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                                  Periodo
                                </p>
                                <p className="mt-1 text-base font-bold text-white">
                                  {item.periodo}
                                </p>
                              </div>

                              <p className="text-lg font-bold text-white">
                                {bs(item.monto_total)}
                              </p>

                              <EstadoCuota estado={item.estado} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
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

function Mini({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
    </div>
  );
}

function EstadoCuota({ estado }: { estado: string }) {
  const normalizado = (estado || "").toLowerCase();

  const estilo =
    normalizado === "pagado"
      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
      : normalizado === "vencido"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-orange-400/30 bg-orange-500/10 text-orange-200";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold capitalize ${estilo}`}
    >
      {normalizado === "pagado"
        ? "Pagada"
        : normalizado === "vencido"
        ? "Vencida"
        : "Pendiente"}
    </span>
  );
}
