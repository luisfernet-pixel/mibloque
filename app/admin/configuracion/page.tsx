import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isBloqueActivo, requireAdmin, requireBlockAdmin } from "@/lib/auth";

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseNumericInput(value: FormDataEntryValue | null, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function guardarConfiguracion(formData: FormData) {
  "use server";

  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  if (!(await isBloqueActivo(usuario.perfil.bloque_id, supabase))) {
    redirect("/admin/configuracion?error=servicio_suspendido");
  }

  const cuotaMensual = parseNumericInput(formData.get("cuota_mensual"), 0);
  const diaVencimiento = parseNumericInput(formData.get("dia_vencimiento"), 15);
  const valorMora = parseNumericInput(formData.get("valor_mora"), 0);
  const saldoInicial = parseNumericInput(formData.get("saldo_inicial"), 0);

  const { data: existente } = await supabase
    .from("configuracion_bloque")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();

  const payload = {
    moneda: "BOB",
    cuota_mensual: cuotaMensual,
    dia_vencimiento: diaVencimiento,
    tipo_mora: "fija_mensual",
    valor_mora: valorMora,
    saldo_inicial: saldoInicial,
    qr_texto_pago: "",
  };

  if (existente?.id) {
    const { error } = await supabase
      .from("configuracion_bloque")
      .update(payload)
      .eq("id", existente.id);
    if (error) {
      const msg = encodeURIComponent(error.message || "Error guardando configuracion");
      redirect(`/admin/configuracion?error=${msg}`);
    }
  } else {
    const { error } = await supabase.from("configuracion_bloque").insert({
      bloque_id: usuario.perfil.bloque_id,
      ...payload,
    });
    if (error) {
      const msg = encodeURIComponent(error.message || "Error creando configuracion");
      redirect(`/admin/configuracion?error=${msg}`);
    }
  }

  redirect("/admin/configuracion");
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  const params = (await searchParams) ?? {};
  const errorRaw = params.error ? decodeURIComponent(params.error) : "";
  const errorHint = errorRaw.toLowerCase().includes("saldo_inicial")
    ? "Falta la migracion de base de datos para saldo_inicial."
    : "";
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("configuracion_bloque")
    .select("*")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();

  return (
    <main className="space-y-3">
      {errorRaw ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 px-5 py-4 text-red-100 ring-1 ring-white/10">
          No se pudo guardar configuracion: {errorRaw}
          {errorHint ? ` ${errorHint}` : ""}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Ajustes del sistema
            </p>

            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
              Configuracion del bloque
            </h1>

            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Define cuota mensual, vencimiento, mora y saldo inicial del bloque.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-sm font-semibold text-white">Ten en cuenta</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Consideraciones
            </p>

            <div className="mt-5 space-y-3">
              <TipBox text="Cambiar la cuota aplica para el siguiente mes." />
              <TipBox text="La mora y el vencimiento actualizan las cuotas impagas mes a mes." />
              <TipBox text="Si no cobran multa, coloca mora en 0." />
              <TipBox text="Saldo inicial: dinero con el que parte el bloque al entrar al sistema." />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard title="Cuota actual" value={money(Number(config?.cuota_mensual ?? 0))} tone="orange" />
        <InfoCard title="Vence el dia" value={String(config?.dia_vencimiento ?? 15)} tone="cyan" />
        <InfoCard title="Mora" value={money(Number(config?.valor_mora ?? 0))} tone="orangeSoft" />
        <InfoCard title="Saldo inicial" value={money(Number(config?.saldo_inicial ?? 0))} tone="cyan" />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3 md:px-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Carga inicial</p>
          <h2 className="mt-2 text-xl font-bold text-white">Deudas antiguas de departamentos</h2>
          <p className="mt-1 text-sm text-slate-300">
            Usalo una sola vez por bloque cuando empieces con un edificio que ya trae meses atrasados.
          </p>
        </div>

        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <Link
              href="/admin/departamentos"
              className="inline-flex items-center justify-center rounded-2xl border border-orange-300/30 bg-orange-500/15 px-4 py-2.5 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/25 hover:text-white"
            >
              Abrir carga de deuda
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3 md:px-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Datos del bloque</p>
          <h2 className="mt-2 text-xl font-bold text-white">Cobro, vencimiento y base inicial</h2>
          <p className="mt-1 text-sm text-slate-300">
            Mantener estos datos bien definidos mejora reportes y proyecciones.
          </p>
        </div>

        <div className="p-3 md:p-4">
          <form action={guardarConfiguracion} className="space-y-3.5">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">Cuota mensual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-500">Bs</span>
                  <input
                    type="number"
                    name="cuota_mensual"
                    step="0.01"
                    defaultValue={config?.cuota_mensual ?? 0}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-[#173454] py-2 pl-11 pr-3 text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">Mora mensual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-500">Bs</span>
                  <input
                    type="number"
                    name="valor_mora"
                    step="0.01"
                    defaultValue={config?.valor_mora ?? 0}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-[#173454] py-2 pl-11 pr-3 text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">Dia de vencimiento</label>
                <input
                  type="number"
                  name="dia_vencimiento"
                  min={1}
                  max={28}
                  defaultValue={config?.dia_vencimiento ?? 15}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">Saldo inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-500">Bs</span>
                  <input
                    type="number"
                    name="saldo_inicial"
                    step="0.01"
                    defaultValue={config?.saldo_inicial ?? 0}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-[#173454] py-2 pl-11 pr-3 text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold"
            >
              Guardar configuracion
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function TipBox({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-slate-200">
      {text}
    </div>
  );
}

function InfoCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "orange" | "cyan" | "orangeSoft";
}) {
  const toneClasses = {
    orange: "border-orange-400/20 bg-gradient-to-br from-orange-500/15 to-transparent text-orange-100",
    cyan: "border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-transparent text-cyan-100",
    orangeSoft: "border-orange-300/20 bg-gradient-to-br from-orange-400/10 to-transparent text-orange-50",
  } as const;

  return (
    <article className={`rounded-[24px] border px-4 py-4 shadow-xl ring-1 ring-white/10 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">{title}</p>
      <p className="mt-3 text-2xl font-bold text-white md:text-3xl">{value}</p>
    </article>
  );
}






