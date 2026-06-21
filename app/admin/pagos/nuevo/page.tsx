import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthUserSafe, isBloqueActivo } from "@/lib/auth";
import PagoDepartamentoSelector from "@/components/admin/pago-departamento-selector";
import { ensureCurrentMonthCuotas } from "@/lib/cuotas-sync";
import { formatPeriodoLabel } from "@/lib/periodo";
import {
  getCuotaEstadoVigente,
  getCuotaMontoVigente,
  getCuotaMoraVigente,
} from "@/lib/cuotas";

type CuotaRow = {
  id: string;
  bloque_id: string;
  departamento_id: string;
  anio: number;
  mes: number;
  periodo: string;
  monto_base: number;
  mora_acumulada: number;
  monto_total: number;
  fecha_vencimiento: string;
  estado: string;
  created_at?: string | null;
  departamentos: { numero: string } | { numero: string }[] | null;
};

type ConfigRow = {
  dia_vencimiento: number | null;
  valor_mora: number | null;
};

type GrupoDepto = {
  departamentoId: string;
  numero: string;
  cuotas: CuotaRow[];
  totalAdeudado: number;
  mesesAdeudados: number;
  pendientes: number;
  vencidas: number;
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function getDeptoNumero(value: CuotaRow["departamentos"]) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero;
}

function getDeptoSortValue(value: string) {
  const raw = String(value || "").trim();
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : -1;
}

function cuotaEstaVencida(cuota: CuotaRow) {
  return String(cuota.estado || "").toLowerCase() === "vencido";
}

function montoCobrarCuota(cuota: CuotaRow) {
  return Number(cuota.monto_total || cuota.monto_base || 0);
}

function agruparPorDepartamento(cuotas: CuotaRow[]): GrupoDepto[] {
  const mapa = new Map<string, GrupoDepto>();

  for (const cuota of cuotas) {
    const key = cuota.departamento_id;
    const numero = getDeptoNumero(cuota.departamentos);

    if (!mapa.has(key)) {
      mapa.set(key, {
        departamentoId: key,
        numero,
        cuotas: [],
        totalAdeudado: 0,
        mesesAdeudados: 0,
        pendientes: 0,
        vencidas: 0,
      });
    }

    const grupo = mapa.get(key)!;
    grupo.cuotas.push(cuota);
  }

  for (const grupo of mapa.values()) {
    grupo.cuotas.sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });

    grupo.mesesAdeudados = grupo.cuotas.length;
    grupo.totalAdeudado = grupo.cuotas.reduce(
      (acc, cuota) => acc + montoCobrarCuota(cuota),
      0
    );
    grupo.vencidas = grupo.cuotas.filter((cuota) => cuotaEstaVencida(cuota)).length;
    grupo.pendientes = grupo.cuotas.length - grupo.vencidas;
  }

  return Array.from(mapa.values()).sort((a, b) => {
    return getDeptoSortValue(b.numero) - getDeptoSortValue(a.numero);
  });
}

async function registrarPagoManual(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const user = await getAuthUserSafe(supabase);

  const departamentoId = String(formData.get("departamento_id") || "");
  const cantidadMeses = Number(formData.get("cantidad_meses") || 1);
  const referencia = String(formData.get("referencia") || "").trim();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol, bloque_id")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");
  if (perfil.rol === "superadmin") redirect("/superadmin");
  if (perfil.rol !== "admin") redirect("/login");

  const bloqueId = String(perfil.bloque_id || "");
  if (!bloqueId) redirect("/login");
  if (!departamentoId) return;
  if (!cantidadMeses || cantidadMeses < 1) return;
  if (!(await isBloqueActivo(bloqueId, supabase))) return;

  const { data: departamento } = await supabase
    .from("departamentos")
    .select("id")
    .eq("id", departamentoId)
    .eq("bloque_id", bloqueId)
    .maybeSingle();

  if (!departamento) return;

  const { data: config } = await supabase
    .from("configuracion_bloque")
    .select("dia_vencimiento, valor_mora")
    .eq("bloque_id", bloqueId)
    .maybeSingle();

  const { data: cuotas, error: cuotasError } = await supabase
    .from("cuotas")
    .select(
      `
      id,
      bloque_id,
      departamento_id,
      anio,
      mes,
      periodo,
      monto_base,
      mora_acumulada,
      monto_total,
      fecha_vencimiento,
      estado
    `
    )
    .eq("departamento_id", departamentoId)
    .eq("bloque_id", bloqueId)
    .in("estado", ["pendiente", "vencido"])
    .order("anio", { ascending: true })
    .order("mes", { ascending: true });

  if (cuotasError || !cuotas || cuotas.length === 0) {
    throw new Error("No se encontraron cuotas pendientes para este departamento.");
  }

  const cuotasOrdenadas = (cuotas as CuotaRow[])
    .map((cuota) => ({
      ...cuota,
      mora_acumulada: getCuotaMoraVigente(cuota, config as ConfigRow | null),
      monto_total: getCuotaMontoVigente(cuota, config as ConfigRow | null),
      estado: getCuotaEstadoVigente(cuota, config as ConfigRow | null),
    }))
    .slice(0, cantidadMeses);

  for (const cuota of cuotasOrdenadas) {
    const montoPagado = montoCobrarCuota(cuota);

    const { error: pagoError } = await supabase.from("pagos").insert({
      bloque_id: bloqueId,
      departamento_id: cuota.departamento_id,
      cuota_id: cuota.id,
      monto_pagado: montoPagado,
      metodo_pago: "efectivo",
      referencia: referencia || null,
    });

    if (pagoError) {
      throw new Error(`Error registrando pago: ${pagoError.message}`);
    }

    const { error: updateError } = await supabase
      .from("cuotas")
      .update({
        estado: "pagado",
        monto_total: montoPagado,
        pagada_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cuota.id)
      .eq("bloque_id", bloqueId)
      .eq("departamento_id", departamentoId);

    if (updateError) {
      throw new Error(`Error actualizando cuota: ${updateError.message}`);
    }
  }

  redirect("/admin/pagos/historial");
}

export default async function NuevoPagoPage({
  searchParams,
}: {
  searchParams?: Promise<{ departamento?: string; periodo?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const targetDepartamento = String(query.departamento || "").trim();
  const targetPeriodo = String(query.periodo || "").trim();

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  await ensureCurrentMonthCuotas(adminSupabase);
  const user = await getAuthUserSafe(supabase);

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol, bloque_id")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");
  if (perfil.rol === "superadmin") redirect("/superadmin");
  if (perfil.rol !== "admin") redirect("/login");

  const bloqueId = perfil.bloque_id;
  if (!bloqueId) redirect("/login");

  const [{ data, error }, { data: config }] = await Promise.all([
    supabase
      .from("cuotas")
      .select(
        `
        id,
        bloque_id,
        departamento_id,
        anio,
        mes,
        periodo,
        monto_base,
        mora_acumulada,
        monto_total,
        fecha_vencimiento,
        estado,
        created_at,
        departamentos:departamento_id (
          numero
        )
      `
      )
      .eq("bloque_id", bloqueId)
      .in("estado", ["pendiente", "vencido"])
      .order("anio", { ascending: true })
      .order("mes", { ascending: true }),
    supabase
      .from("configuracion_bloque")
      .select("dia_vencimiento, valor_mora")
      .eq("bloque_id", bloqueId)
      .maybeSingle(),
  ]);

  const cuotas = ((data ?? []) as CuotaRow[]).map((cuota) => ({
    ...cuota,
    mora_acumulada: getCuotaMoraVigente(cuota, config as ConfigRow | null),
    monto_total: getCuotaMontoVigente(cuota, config as ConfigRow | null),
    estado: getCuotaEstadoVigente(cuota, config as ConfigRow | null),
  }));
  const grupos = agruparPorDepartamento(cuotas);

  const totalDepartamentosConDeuda = grupos.length;
  const totalMesesAdeudados = grupos.reduce((acc, item) => acc + item.mesesAdeudados, 0);
  const totalAdeudado = grupos.reduce((acc, item) => acc + item.totalAdeudado, 0);
  const totalVencidas = grupos.reduce((acc, item) => acc + item.vencidas, 0);

  return (
    <main className="min-h-screen bg-[#324359] p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-3">
        <section className="rounded-3xl bg-[#071426] p-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Cobros
              </p>

              <h1 className="mt-2 text-xl font-bold">Registrar pago</h1>

              <p className="mt-2 text-sm text-slate-300">
                El pago manual siempre se aplica desde la deuda mas antigua hacia adelante.
                Si una cuota ya vencio, el sistema suma la mora automaticamente.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/admin/pagos/historial"
                  className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Volver a pagos
                </Link>

                <Link
                  href="/admin/confirmaciones"
                  className="rounded-xl bg-cyan-500 px-3.5 py-2 text-sm font-bold text-black transition hover:brightness-110"
                >
                  Ver comprobantes
                </Link>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-[#EF4937]/30 bg-[#EF4937]/10 p-4 text-sm text-[#ffb1a8]">
            Error cargando cuotas: {error.message}
          </section>
        ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Deptos con deuda" value={String(totalDepartamentosConDeuda)} tone="orange" />
          <KpiCard title="Meses adeudados" value={String(totalMesesAdeudados)} tone="blue" />
          <KpiCard title="Total adeudado hoy" value={money(totalAdeudado)} tone="cyan" />
          <KpiCard title="Cuotas vencidas" value={String(totalVencidas)} tone="orangeSoft" />
        </section>

        {grupos.length === 0 && !error ? (
          <section className="rounded-3xl bg-[#20354d] p-4 text-white">
            <h2 className="text-lg font-bold">No hay deudas pendientes</h2>
            <p className="mt-2 text-slate-300">
              En este momento no existen cuotas pendientes o vencidas en este bloque.
            </p>
          </section>
        ) : null}

        {grupos.length > 0 ? (
          <section className="rounded-3xl bg-[#20354d] p-2.5 text-white">
            <div className="border-b border-white/10 pb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Deuda por departamento
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Vecinos con pagos pendientes
              </h2>
              <p className="mt-1.5 text-xs text-slate-300">
                El administrador elige hasta que mes pago el vecino. El sistema
                siempre cobra primero los meses mas antiguos.
              </p>
            </div>

            <div className="mt-2.5 space-y-2">
              {grupos.map((grupo) => {
                const pagoMinimo = grupo.cuotas[0] ? montoCobrarCuota(grupo.cuotas[0]) : 0;
                const cuotasDetalle = grupo.cuotas.map((cuota) => {
                  const montoBase = Number(cuota.monto_base || 0);
                  const total = montoCobrarCuota(cuota);
                  return {
                    id: cuota.id,
                    periodo: cuota.periodo,
                    montoBase,
                    multa: Math.max(0, total - montoBase),
                    total,
                    vencida: cuotaEstaVencida(cuota),
                  };
                });
                const selectedIndexByPeriodo = targetPeriodo
                  ? grupo.cuotas.findIndex((cuota) => String(cuota.periodo) === targetPeriodo)
                  : -1;
                const initialCantidadMeses =
                  selectedIndexByPeriodo >= 0
                    ? selectedIndexByPeriodo + 1
                    : targetDepartamento && String(grupo.numero) === targetDepartamento
                    ? 1
                    : 1;

                return (
                  <details
                    key={grupo.departamentoId}
                    className="rounded-3xl border border-white/10 bg-[#2a425c] p-2"
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#1b3148] p-2">
                      <div>
                        <p className="text-xs text-slate-300">Departamento</p>
                        <p className="text-lg font-bold leading-tight text-white">{grupo.numero}</p>
                      </div>

                      <div className="grid gap-1.5 text-right sm:grid-cols-3 sm:items-center sm:text-left">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Meses</p>
                          <p className="text-xs font-bold text-white">{grupo.mesesAdeudados}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Deuda total</p>
                          <p className="text-xs font-bold text-white">{money(grupo.totalAdeudado)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Pago minimo</p>
                          <p className="text-xs font-bold text-white">{money(pagoMinimo)}</p>
                        </div>
                      </div>

                      <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                        Registrar pago
                      </span>
                    </summary>

                    <form
                      action={registrarPagoManual}
                      className="mt-2.5 grid gap-2.5 xl:grid-cols-[0.9fr_1.1fr]"
                    >
                      <div className="space-y-2.5">
                        <div className="rounded-2xl bg-white/5 p-2.5">
                          <p className="text-sm font-semibold text-white">
                            Departamento {grupo.numero} · {grupo.mesesAdeudados} meses adeudados · Deuda total {money(grupo.totalAdeudado)} · Pago mínimo {money(pagoMinimo)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#1b3148] p-2.5">
                          <p className="text-xs font-semibold text-white">
                            Periodos adeudados
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {grupo.cuotas.map((cuota) => {
                              const vencida = cuotaEstaVencida(cuota);
                              return (
                                <span
                                  key={cuota.id}
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    vencida
                                      ? "border border-[#EF4937]/30 bg-[#EF4937]/10 text-[#ffb0a7]"
                                      : "border border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
                                  }`}
                                >
                                  {formatPeriodoLabel(cuota.periodo)} - {money(montoCobrarCuota(cuota))}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="rounded-2xl bg-[#1b3148] p-2.5">
                        <input
                          type="hidden"
                          name="departamento_id"
                          value={grupo.departamentoId}
                        />
                        <input type="hidden" name="bloque_id" value={bloqueId} />

                          <PagoDepartamentoSelector cuotas={cuotasDetalle} initialCantidadMeses={initialCantidadMeses} />
                        </div>

                        <div className="rounded-2xl bg-[#1b3148] p-2.5">
                          <label className="mb-1.5 block text-xs font-medium text-slate-300">
                            Aclaracion o referencia
                          </label>

                          <input
                            type="text"
                            name="referencia"
                            placeholder="Opcional: recibo, nota, observacion"
                            className="w-full rounded-2xl border border-white/10 bg-[#0f2135] px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-[#EF4937]/50"
                          />

                          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="submit"
                              className="rounded-xl bg-[#EF4937] px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-110"
                            >
                              Entrar a pagar
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
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
  tone: "orange" | "cyan" | "blue" | "orangeSoft";
}) {
  const tones = {
    orange: "border-[#EF4937]/30 bg-[#EF4937]/12",
    cyan: "border-cyan-500/20 bg-cyan-500/10",
    blue: "border-blue-500/20 bg-blue-500/10",
    orangeSoft: "border-[#EF4937]/20 bg-[#EF4937]/8",
  };

  return (
    <div className={`rounded-3xl border p-3 text-white ${tones[tone]}`}>
      <p className="text-xs text-slate-300">{title}</p>
      <p className="mt-1.5 text-[1.7rem] font-bold leading-none">{value}</p>
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
    <div className="rounded-2xl bg-white/5 p-2.5">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}


