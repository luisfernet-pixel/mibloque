import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { getCuotaEstadoVigente, getCuotaMontoVigente } from "@/lib/cuotas";
import { ensureCurrentMonthCuotas } from "@/lib/cuotas-sync";
import { formatPeriodoLabel } from "@/lib/periodo";
import CuotasMesesInteractivos, { type MesPagoItem } from "@/components/admin/cuotas-meses-interactivos";

type CuotaRow = {
  id: string;
  periodo: string;
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number;
  estado: string;
  anio: number;
  mes: number;
  departamento_id: string;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

type ConfigRow = {
  dia_vencimiento: number | null;
  valor_mora: number | null;
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
  await ensureCurrentMonthCuotas(supabase);
  const bloqueId = usuario.perfil.bloque_id;

  const [{ data: departamentosData }, { data }, { data: config }] = await Promise.all([
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
      departamento_id,
      monto_base,
      mora_acumulada,
      fecha_vencimiento,
      created_at
    `
    )
    .eq("bloque_id", bloqueId)
    .order("periodo", { ascending: false }),
    supabase
      .from("configuracion_bloque")
      .select("dia_vencimiento, valor_mora")
      .eq("bloque_id", bloqueId)
      .maybeSingle(),
  ]);

  const cuotas = ((data ?? []) as CuotaRow[]).map((item) => ({
    ...item,
    monto_total: getCuotaMontoVigente(item, config as ConfigRow | null),
    estado: getCuotaEstadoVigente(item, config as ConfigRow | null),
  }));
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
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-2.5 p-3 md:p-3.5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Vecinos y pagos
            </p>

            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
              Ver quien debe
            </h1>

            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Aqui puedes ver que departamentos deben, cuanto deben y revisar
              pagos o comprobantes sin entrar a pantallas complicadas.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 md:grid md:w-full md:grid-cols-3 md:items-center">
              <Link
                href="/admin/confirmaciones"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110 md:justify-self-start"
              >
                Ver comprobantes
              </Link>

              <Link
                href="/admin/pagos/registrar"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15 md:justify-self-center"
              >
                Registrar pago
              </Link>

              <Link
                href="/admin/pagos/historial"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20 md:justify-self-end"
              >
                Ver historial
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <div>
              <p className="text-sm font-semibold text-white">
                Resumen rapido
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Lo mas importante
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoBox label="Pendientes" value={String(pendientes.length)} />
              <InfoBox label="Vencidas" value={String(vencidas.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Mini titulo="Por cobrar" valor={bs(totalPendiente)} />
        <Mini titulo="Vencido" valor={bs(totalVencido)} />
        <Mini titulo="Ya cobrado" valor={bs(totalPagado)} />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Deudas del bloque
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-white">
              Vecinos con cuotas pendientes
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Cada tarjeta muestra cuanto debe ese departamento.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
            {departamentos.length} departamento(s)
          </div>
        </div>

        <div className="p-3 md:p-3">
          {departamentos.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay departamentos registrados
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {grupos.map((grupo) => (
                <details
                  key={grupo.departamento}
                  className="group rounded-[22px] border border-white/20 bg-[#2d4a6c] p-3 md:p-3"
                >
                  <summary className="list-none cursor-pointer">
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
                      <div>
                        <p className="text-xs text-slate-300">Departamento</p>
                        <p className="mt-1 text-lg font-bold text-white">
                          {grupo.departamento}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Total adeudado
                        </p>
                        <p className="mt-1 text-lg font-extrabold text-orange-200">
                          {bs(grupo.totalAdeudado)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Pendiente
                        </p>
                        <p className="mt-1 text-base font-bold text-orange-100">
                          {bs(grupo.totalPendiente)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                          Vencido
                        </p>
                        <p className="mt-1 text-base font-bold text-red-200">
                          {bs(grupo.totalVencido)}
                        </p>
                      </div>

                      <div className="self-center md:justify-self-end">
                        <span className="inline-flex min-h-[34px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-100 transition group-open:hidden">
                          Ampliar
                        </span>
                        <span className="hidden min-h-[34px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white transition group-open:inline-flex">
                          Reducir
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-3 border-t border-white/10 pt-3 group-open:block">
                    <div>
                      {grupo.cuotas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/20 bg-[#264465] px-4 py-4 text-sm text-slate-200">
                          Sin cuotas registradas para este departamento.
                        </div>
                      ) : (
                        (() => {
                          const cuotasAsc = [...grupo.cuotas].sort((a, b) => {
                            if (a.anio !== b.anio) return a.anio - b.anio;
                            return a.mes - b.mes;
                          });
                          const primeraAdeudada = cuotasAsc.find(
                            (x) => x.estado === "pendiente" || x.estado === "vencido"
                          );
                          const primeraAdeudadaPeriodo = primeraAdeudada?.periodo || null;

                          const items: MesPagoItem[] = grupo.cuotas.map((item) => ({
                            id: item.id,
                            periodo: item.periodo,
                            monto: item.monto_total,
                            estado:
                              item.estado === "pagado"
                                ? "pagado"
                                : item.estado === "vencido"
                                ? "vencido"
                                : "pendiente",
                            esHabilitado:
                              (item.estado === "pendiente" || item.estado === "vencido") &&
                              item.periodo === primeraAdeudadaPeriodo,
                            mensajeBloqueo:
                              primeraAdeudadaPeriodo && item.periodo !== primeraAdeudadaPeriodo
                                ? `No puedes pagar ${formatPeriodoLabel(item.periodo)} hasta pagar primero ${formatPeriodoLabel(primeraAdeudadaPeriodo)}.`
                                : null,
                          }));

                          return (
                            <div>
                              <CuotasMesesInteractivos departamento={grupo.departamento} items={items} />
                              <p className="mt-2 text-xs text-slate-300">
                                El pago manual solo deja avanzar desde el mes mas antiguo pendiente.
                              </p>
                            </div>
                          );
                        })()
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
    <div className="rounded-[20px] bg-[#213b59] p-3 shadow-xl ring-1 ring-white/10">
      <p className="text-xs text-slate-300">{titulo}</p>
      <p className="mt-1.5 text-lg font-bold text-white">{valor}</p>
    </div>
  );
}

