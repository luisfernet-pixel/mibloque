import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

type GrupoDepto = {
  departamentoId: string;
  numero: string;
  cuotas: CuotaRow[];
  totalAdeudado: number;
  mesesAdeudados: number;
  pendientes: number;
  vencidas: number;
};

type OpcionPago = {
  cantidad: number;
  desde: string;
  hasta: string;
  total: number;
  detalle: string[];
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function getDeptoNumero(value: CuotaRow["departamentos"]) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero;
}

function normalizarFechaSoloDia(value: string) {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function hoySoloDia() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function cuotaEstaVencida(fechaVencimiento: string) {
  return hoySoloDia().getTime() > normalizarFechaSoloDia(fechaVencimiento).getTime();
}

function montoCobrarCuota(cuota: CuotaRow) {
  const base = Number(cuota.monto_base || 0);
  const mora = Number(cuota.mora_acumulada || 0);

  if (cuota.estado === "pagado") return Number(cuota.monto_total || base);

  return cuotaEstaVencida(cuota.fecha_vencimiento) ? base + mora : base;
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
    grupo.vencidas = grupo.cuotas.filter((cuota) =>
      cuotaEstaVencida(cuota.fecha_vencimiento)
    ).length;
    grupo.pendientes = grupo.cuotas.length - grupo.vencidas;
  }

  return Array.from(mapa.values()).sort((a, b) => {
    if (b.mesesAdeudados !== a.mesesAdeudados) {
      return b.mesesAdeudados - a.mesesAdeudados;
    }
    return a.numero.localeCompare(b.numero);
  });
}

function construirOpcionesPago(cuotas: CuotaRow[]): OpcionPago[] {
  const opciones: OpcionPago[] = [];

  for (let i = 0; i < cuotas.length; i++) {
    const subset = cuotas.slice(0, i + 1);
    const total = subset.reduce((acc, cuota) => acc + montoCobrarCuota(cuota), 0);

    opciones.push({
      cantidad: i + 1,
      desde: subset[0].periodo,
      hasta: subset[subset.length - 1].periodo,
      total,
      detalle: subset.map((cuota) => {
        const monto = montoCobrarCuota(cuota);
        const vencida = cuotaEstaVencida(cuota.fecha_vencimiento);
        return `${cuota.periodo} — ${money(monto)}${vencida ? " (con mora)" : ""}`;
      }),
    });
  }

  return opciones;
}

async function registrarPagoManual(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const departamentoId = String(formData.get("departamento_id") || "");
  const cantidadMeses = Number(formData.get("cantidad_meses") || 1);
  const referencia = String(formData.get("referencia") || "").trim();

  if (!departamentoId) return;
  if (!cantidadMeses || cantidadMeses < 1) return;

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
    .in("estado", ["pendiente", "vencido"])
    .order("anio", { ascending: true })
    .order("mes", { ascending: true });

  if (cuotasError || !cuotas || cuotas.length === 0) {
    throw new Error("No se encontraron cuotas pendientes para este departamento.");
  }

  const cuotasOrdenadas = (cuotas as CuotaRow[]).slice(0, cantidadMeses);

  for (const cuota of cuotasOrdenadas) {
    const montoPagado = montoCobrarCuota(cuota);

    const { error: pagoError } = await supabase.from("pagos").insert({
      bloque_id: cuota.bloque_id,
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
      .eq("id", cuota.id);

    if (updateError) {
      throw new Error(`Error actualizando cuota: ${updateError.message}`);
    }
  }

  redirect("/admin/pagos");
}

export default async function NuevoPagoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data, error } = await supabase
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
    .order("mes", { ascending: true });

  const cuotas = (data ?? []) as CuotaRow[];
  const grupos = agruparPorDepartamento(cuotas);

  const totalDepartamentosConDeuda = grupos.length;
  const totalMesesAdeudados = grupos.reduce((acc, item) => acc + item.mesesAdeudados, 0);
  const totalAdeudado = grupos.reduce((acc, item) => acc + item.totalAdeudado, 0);
  const totalVencidas = grupos.reduce((acc, item) => acc + item.vencidas, 0);

  return (
    <main className="min-h-screen bg-[#324359] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-[#071426] p-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Cobros
              </p>

              <h1 className="mt-2 text-3xl font-bold">Registrar pago manual</h1>

              <p className="mt-3 text-sm text-slate-300">
                El pago manual siempre se aplica desde la deuda más antigua hacia adelante.
                Si una cuota ya venció, el sistema suma la mora automáticamente.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/admin/pagos"
                  className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"
                >
                  Volver a pagos
                </Link>

                <Link
                  href="/admin/validar-pagos"
                  className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-black transition hover:brightness-110"
                >
                  Revisar comprobantes
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Deptos con deuda" value={String(totalDepartamentosConDeuda)} tone="orange" />
          <KpiCard title="Meses adeudados" value={String(totalMesesAdeudados)} tone="blue" />
          <KpiCard title="Total adeudado hoy" value={money(totalAdeudado)} tone="cyan" />
          <KpiCard title="Cuotas vencidas" value={String(totalVencidas)} tone="orangeSoft" />
        </section>

        {grupos.length === 0 && !error ? (
          <section className="rounded-3xl bg-[#20354d] p-8 text-white">
            <h2 className="text-xl font-bold">No hay deudas pendientes</h2>
            <p className="mt-2 text-slate-300">
              En este momento no existen cuotas pendientes o vencidas en este bloque.
            </p>
          </section>
        ) : null}

        {grupos.length > 0 ? (
          <section className="rounded-3xl bg-[#20354d] p-5 text-white">
            <div className="border-b border-white/10 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Deuda por departamento
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                Departamentos con pagos pendientes
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                El administrador elige hasta qué mes pagó el vecino. El sistema
                siempre cobra primero los meses más antiguos.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {grupos.map((grupo, index) => {
                const opciones = construirOpcionesPago(grupo.cuotas);
                const pagoMinimo = grupo.cuotas[0] ? montoCobrarCuota(grupo.cuotas[0]) : 0;

                return (
                  <details
                    key={grupo.departamentoId}
                    className="rounded-3xl border border-white/10 bg-[#2a425c] p-5"
                    open={index === 0}
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 rounded-2xl bg-[#1b3148] p-4">
                      <div>
                        <p className="text-sm text-slate-300">Departamento</p>
                        <p className="text-3xl font-bold text-white">{grupo.numero}</p>
                      </div>

                      <div className="grid gap-2 text-right sm:grid-cols-3 sm:items-center sm:text-left">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Meses</p>
                          <p className="text-lg font-bold text-white">{grupo.mesesAdeudados}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Deuda total</p>
                          <p className="text-lg font-bold text-white">{money(grupo.totalAdeudado)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Pago minimo</p>
                          <p className="text-lg font-bold text-white">{money(pagoMinimo)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {grupo.vencidas > 0 && (
                          <span className="inline-flex rounded-full border border-[#EF4937]/30 bg-[#EF4937]/10 px-3 py-1 text-xs font-semibold text-[#ffb0a7]">
                            {grupo.vencidas} vencida(s)
                          </span>
                        )}

                        {grupo.pendientes > 0 && (
                          <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                            {grupo.pendientes} pendiente(s)
                          </span>
                        )}
                      </div>
                    </summary>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <InfoBox label="Meses adeudados" value={String(grupo.mesesAdeudados)} />
                          <InfoBox label="Total adeudado hoy" value={money(grupo.totalAdeudado)} />
                          <InfoBox label="Pago mínimo" value={money(pagoMinimo)} />
                        </div>

                        <div className="rounded-2xl bg-[#1b3148] p-4">
                          <p className="text-sm font-semibold text-white">
                            Periodos adeudados
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {grupo.cuotas.map((cuota) => {
                              const vencida = cuotaEstaVencida(cuota.fecha_vencimiento);
                              return (
                                <span
                                  key={cuota.id}
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    vencida
                                      ? "border border-[#EF4937]/30 bg-[#EF4937]/10 text-[#ffb0a7]"
                                      : "border border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
                                  }`}
                                >
                                  {cuota.periodo} — {money(montoCobrarCuota(cuota))}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <form
                        action={registrarPagoManual}
                        className="rounded-2xl bg-[#1b3148] p-4"
                      >
                        <input
                          type="hidden"
                          name="departamento_id"
                          value={grupo.departamentoId}
                        />

                        <div>
                          <label className="mb-3 block text-sm font-medium text-slate-300">
                            Elige hasta qué mes pagó
                          </label>

                          <div className="space-y-3">
                            {opciones.map((opcion, opcionIndex) => (
                              <label
                                key={opcion.cantidad}
                                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-[#0f2135] p-4 transition hover:border-[#EF4937]/40"
                              >
                                <input
                                  type="radio"
                                  name="cantidad_meses"
                                  value={opcion.cantidad}
                                  defaultChecked={opcionIndex === 0}
                                  className="mt-1 h-4 w-4 accent-[#EF4937]"
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-white">
                                        Pagar {opcion.cantidad} mes(es)
                                      </p>
                                      <p className="text-sm text-slate-300">
                                        Desde {opcion.desde} hasta {opcion.hasta}
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-[#EF4937] px-3 py-2 text-sm font-bold text-white">
                                      {money(opcion.total)}
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {opcion.detalle.map((linea) => (
                                      <span
                                        key={linea}
                                        className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                                      >
                                        {linea}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Aclaración o referencia
                          </label>

                          <input
                            type="text"
                            name="referencia"
                            placeholder="Opcional: recibo, nota, observación"
                            className="w-full rounded-2xl border border-white/10 bg-[#0f2135] px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-[#EF4937]/50"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-slate-400">
                            La mora se aplica automáticamente si ya venció la cuota.
                          </p>

                          <button
                            type="submit"
                            className="rounded-2xl bg-[#EF4937] px-5 py-3 font-bold text-white transition hover:brightness-110"
                          >
                            Registrar pago
                          </button>
                        </div>
                      </form>
                    </div>
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
    <div className={`rounded-3xl border p-5 text-white ${tones[tone]}`}>
      <p className="text-sm text-slate-300">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
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
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
