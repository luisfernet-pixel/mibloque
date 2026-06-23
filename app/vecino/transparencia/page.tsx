import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compareYearMonth,
  formatBoliviaDate,
  formatBoliviaMonthLabel,
  getBoliviaDateParts,
  getCurrentBoliviaYearMonth,
  isDateInBoliviaMonth,
} from "@/lib/bolivia-time";
import { getCuotaMontoVigente } from "@/lib/cuotas";
import { ensureCurrentMonthCuotasForBlock } from "@/lib/cuotas-sync";

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

type GastoItem = {
  id: string;
  fecha_gasto: string | null;
  categoria: string | null;
  concepto?: string | null;
  monto: number | null;
};

type PagoItem = {
  monto_pagado: number | null;
  fecha_pago: string | null;
};

type CuotaItem = {
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number | null;
  estado: string | null;
  anio: number | null;
  mes: number | null;
  periodo?: string | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

type ConfigRow = {
  saldo_inicial: number | null;
  dia_vencimiento?: number | null;
  valor_mora?: number | null;
};

function categoriaClass(value: string) {
  const v = (value || "").toLowerCase();

  if (v.includes("luz") || v.includes("electric")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  if (v.includes("agua")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  if (v.includes("limpieza")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  return "border border-white/20 bg-white/10 text-white";
}

export default async function TransparenciaPage() {
  const usuario = await requireVecino();
  if (!usuario) redirect("/login");

  const bloqueId = usuario.perfil.bloque_id;
  if (!bloqueId) redirect("/login");

  const supabase = createAdminClient();
  await ensureCurrentMonthCuotasForBlock(supabase, bloqueId);
  const periodoActual = getCurrentBoliviaYearMonth();

  const [pagosRes, gastosRes, cuotasRes, configRes] = await Promise.all([
    supabase.from("pagos").select("monto_pagado, fecha_pago").eq("bloque_id", bloqueId),
    supabase
      .from("gastos")
      .select("id, fecha_gasto, categoria, concepto, monto")
      .eq("bloque_id", bloqueId)
      .order("fecha_gasto", { ascending: false }),
    supabase.from("cuotas").select("monto_base, mora_acumulada, monto_total, estado, anio, mes, periodo, fecha_vencimiento, created_at").eq("bloque_id", bloqueId),
    supabase
      .from("configuracion_bloque")
      .select("saldo_inicial, dia_vencimiento, valor_mora")
      .eq("bloque_id", bloqueId)
      .maybeSingle(),
  ]);

  const pagos = (pagosRes.data ?? []) as PagoItem[];
  const gastos = (gastosRes.data ?? []) as GastoItem[];
  const cuotas = ((cuotasRes.data ?? []) as CuotaItem[]).map((item) => ({
    ...item,
    monto_total: getCuotaMontoVigente(item, configRes.data as ConfigRow | null),
  }));
  const config = (configRes.data ?? null) as ConfigRow | null;

  const cobradoMes = pagos
    .filter((item) =>
      isDateInBoliviaMonth(item.fecha_pago, periodoActual.year, periodoActual.month)
    )
    .reduce((acc, item) => acc + Number(item.monto_pagado || 0), 0);

  const gastosDelMes = gastos
    .filter((item) =>
      isDateInBoliviaMonth(item.fecha_gasto, periodoActual.year, periodoActual.month)
    )
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  const porCobrarMes = cuotas
    .filter((item) => {
      const estado = String(item.estado || "").toLowerCase();
      return (
        (estado === "pendiente" || estado === "vencido") &&
        compareYearMonth(item.anio, item.mes, periodoActual.year, periodoActual.month) === 0
      );
    })
    .reduce((acc, item) => acc + Number(item.monto_total || 0), 0);

  const totalCobradoHistorico = pagos.reduce(
    (acc, item) => acc + Number(item.monto_pagado || 0),
    0
  );
  const totalGastadoHistorico = gastos.reduce(
    (acc, item) => acc + Number(item.monto || 0),
    0
  );
  const saldoDisponible =
    Number(config?.saldo_inicial || 0) + totalCobradoHistorico - totalGastadoHistorico;

  const gastosRecientes = gastos.slice(0, 18);

  const monthKey = (iso: string | null | undefined) => {
    const parts = getBoliviaDateParts(iso);
    if (!parts) return null;
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  };

  const gastosAgrupados = (() => {
    const map = new Map<
      string,
      { monthKey: string; monthLabel: string; gastos: GastoItem[]; total: number }
    >();

    for (const gasto of gastosRecientes) {
      const key = monthKey(gasto.fecha_gasto);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          monthLabel: formatBoliviaMonthLabel(`${key}-01`),
          gastos: [],
          total: 0,
        });
      }
      const group = map.get(key)!;
      group.gastos.push(gasto);
      group.total += Number(gasto.monto || 0);
    }

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  })();

  return (
    <main className="min-h-screen bg-[#334b68] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="mb-6 rounded-[32px] bg-gradient-to-r from-[#071426] via-[#031a38] to-[#0c2d4a] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                Cuentas del bloque
              </p>

              <h1 className="mt-3 text-xl font-bold leading-tight md:text-3xl">
                Cuentas del bloque
              </h1>

              <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
                Aqui puedes ver de forma clara cuanto dinero entro, cuanto se gasto y cuanto queda
                disponible en el bloque.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/25 bg-white/10 p-4 backdrop-blur-sm md:p-6">
              <p className="text-sm font-semibold text-slate-200">Estado general del mes</p>

              <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Saldo disponible</p>
                <p className="mt-2 text-3xl font-extrabold text-white md:text-3xl">
                  {money(saldoDisponible)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/vecino/transparencia/cuadro"
                  className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-500/25"
                >
                  Ver cuadro general
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ResumenCard titulo="Cobrado este mes" valor={money(cobradoMes)} />
          <ResumenCard titulo="Por cobrar" valor={money(porCobrarMes)} />
          <ResumenCard titulo="Gastos del mes" valor={money(gastosDelMes)} />
          <ResumenCard titulo="Saldo disponible" valor={money(saldoDisponible)} destacado />
        </section>

        <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
                Movimiento reciente
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">Gastos recientes del bloque</h2>
              <p className="mt-1 text-sm text-slate-300">
                Para que el vecino vea en que se esta usando el dinero.
              </p>
            </div>

            <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
              {gastosRecientes.length} gasto(s)
            </div>
          </div>

          <div className="p-4 md:p-4">
            {gastosAgrupados.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center">
                <p className="text-lg font-bold text-white">No hay gastos recientes para mostrar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gastosAgrupados.map((grupo, index) => {
                  const esMesActual = index === 0;

                  if (esMesActual) {
                    return (
                      <section
                        key={grupo.monthKey}
                        className="rounded-[22px] border border-white/15 bg-[#263f5c] p-3 md:p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                              {grupo.monthLabel}
                            </p>
                            <p className="mt-1 text-xs text-slate-300">
                              {grupo.gastos.length} gasto(s) Â· Total {money(grupo.total)}
                            </p>
                          </div>
                          <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-100">
                            Mes actual
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {grupo.gastos.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-white/10 bg-[#2d4a6c] px-3 py-2 md:px-4 md:py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-300">
                                    {formatBoliviaDate(item.fecha_gasto)}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${categoriaClass(
                                        String(item.categoria || "")
                                      )}`}
                                    >
                                      {String(item.categoria || "Sin categoria")}
                                    </span>
                                    {String(item.concepto || "").trim() ? (
                                      <span className="truncate text-xs text-slate-200">
                                        {String(item.concepto || "")}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <p className="shrink-0 text-base font-extrabold text-white md:text-lg">
                                  {money(Number(item.monto || 0))}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  return (
                    <details
                      key={grupo.monthKey}
                      className="rounded-[22px] border border-white/15 bg-[#263f5c] p-3 md:p-4"
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                            {grupo.monthLabel}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {grupo.gastos.length} gasto(s) Â· Total {money(grupo.total)}
                          </p>
                        </div>

                        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-white">
                          Ver detalle
                        </span>
                      </summary>

                      <div className="mt-3 space-y-2">
                        {grupo.gastos.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-[#2d4a6c] px-3 py-2 md:px-4 md:py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs text-slate-300">
                                  {formatBoliviaDate(item.fecha_gasto)}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${categoriaClass(
                                      String(item.categoria || "")
                                    )}`}
                                  >
                                    {String(item.categoria || "Sin categoria")}
                                  </span>
                                  {String(item.concepto || "").trim() ? (
                                    <span className="truncate text-xs text-slate-200">
                                      {String(item.concepto || "")}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <p className="shrink-0 text-base font-extrabold text-white md:text-lg">
                                {money(Number(item.monto || 0))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ResumenCard({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] p-4 shadow-lg ring-1 ${
        destacado ? "bg-[#426a95] ring-orange-300/30" : "bg-[#3b6189] ring-white/20"
      }`}
    >
      <p className="text-sm font-semibold text-slate-100">{titulo}</p>
      <p className="mt-3 text-3xl font-extrabold leading-tight text-white">{valor}</p>
    </div>
  );
}


