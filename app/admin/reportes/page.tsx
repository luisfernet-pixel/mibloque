import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateLong(value: Date) {
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function parseMes(value: string, fallbackMonth: number) {
  const raw = String(value || "").trim();
  const legacy = /^(\d{4})-(\d{2})$/.exec(raw);
  if (legacy) {
    const month = Number(legacy[2]);
    if (month >= 1 && month <= 12) return month;
  }

  const month = Number(raw);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return fallbackMonth;
  }
  return month;
}

function parseAnio(value: string, fallbackYear: number) {
  const year = Number(value || fallbackYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return fallbackYear;
  }
  return year;
}

function getRangoPeriodo(
  modo: "mensual" | "anual",
  mesInput: string,
  anioInput: string,
  now: Date
) {
  const fallbackYear = now.getUTCFullYear();
  const fallbackMonth = now.getUTCMonth() + 1;

  if (modo === "anual") {
    const year = parseAnio(anioInput, fallbackYear);
    const inicio = new Date(Date.UTC(year, 0, 1));
    const finExclusivo = new Date(Date.UTC(year + 1, 0, 1));
    const finVisible = new Date(Date.UTC(year, 11, 31));

    return {
      modo,
      mesValue: String(fallbackMonth).padStart(2, "0"),
      anioValue: String(year),
      inicioIso: inicio.toISOString(),
      finIso: finExclusivo.toISOString(),
      inicioDate: inicio.toISOString().split("T")[0],
      finDateExclusiva: finExclusivo.toISOString().split("T")[0],
      periodoTitulo: `Gestion ${year}`,
      periodoDetalle: `Del ${formatDateLong(inicio)} al ${formatDateLong(finVisible)}`,
    };
  }

  const year = parseAnio(anioInput, fallbackYear);
  const month = parseMes(mesInput, fallbackMonth);
  const inicio = new Date(Date.UTC(year, month - 1, 1));
  const finExclusivo = new Date(Date.UTC(year, month, 1));
  const finVisible = new Date(Date.UTC(year, month, 0));

  const periodoTitulo = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(inicio);

  return {
    modo,
    mesValue: String(month).padStart(2, "0"),
    anioValue: String(year),
    inicioIso: inicio.toISOString(),
    finIso: finExclusivo.toISOString(),
    inicioDate: inicio.toISOString().split("T")[0],
    finDateExclusiva: finExclusivo.toISOString().split("T")[0],
    periodoTitulo: periodoTitulo.charAt(0).toUpperCase() + periodoTitulo.slice(1),
    periodoDetalle: `Del ${formatDateLong(inicio)} al ${formatDateLong(finVisible)}`,
  };
}

type SearchParams = Promise<{
  modo?: string;
  mes?: string;
  anio?: string;
}>;

type PagoAgg = {
  monto_pagado: number | null;
};

type GastoAgg = {
  monto: number | null;
};

type DepartamentoRow = {
  id: string;
  numero: string;
};

type CuotaEstadoRow = {
  departamento_id: string;
  estado: string;
};

type ConfigRow = {
  saldo_inicial: number | null;
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = await searchParams;
  const supabase = await createClient();
  const bloqueId = usuario.perfil.bloque_id;
  const now = new Date();

  const modo = params?.modo === "anual" ? "anual" : "mensual";
  const rango = getRangoPeriodo(
    modo,
    params?.mes || "",
    params?.anio || "",
    now
  );

  const [
    pagosPeriodoRes,
    gastosPeriodoRes,
    departamentosRes,
    cuotasRes,
    configRes,
    pagosAcumuladosRes,
    gastosAcumuladosRes,
  ] = await Promise.all([
    supabase
      .from("pagos")
      .select("monto_pagado")
      .eq("bloque_id", bloqueId)
      .gte("fecha_pago", rango.inicioIso)
      .lt("fecha_pago", rango.finIso),

    supabase
      .from("gastos")
      .select("monto")
      .eq("bloque_id", bloqueId)
      .gte("fecha_gasto", rango.inicioDate)
      .lt("fecha_gasto", rango.finDateExclusiva),

    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("bloque_id", bloqueId),

    supabase
      .from("cuotas")
      .select("departamento_id, estado")
      .eq("bloque_id", bloqueId),

    supabase
      .from("configuracion_bloque")
      .select("saldo_inicial")
      .eq("bloque_id", bloqueId)
      .maybeSingle(),

    supabase
      .from("pagos")
      .select("monto_pagado")
      .eq("bloque_id", bloqueId)
      .lt("fecha_pago", rango.finIso),

    supabase
      .from("gastos")
      .select("monto")
      .eq("bloque_id", bloqueId)
      .lt("fecha_gasto", rango.finDateExclusiva),
  ]);

  const pagosPeriodo = (pagosPeriodoRes.data ?? []) as PagoAgg[];
  const gastosPeriodo = (gastosPeriodoRes.data ?? []) as GastoAgg[];
  const departamentos = (departamentosRes.data ?? []) as DepartamentoRow[];
  const cuotas = (cuotasRes.data ?? []) as CuotaEstadoRow[];
  const config = (configRes.data ?? null) as ConfigRow | null;
  const pagosAcumulados = (pagosAcumuladosRes.data ?? []) as PagoAgg[];
  const gastosAcumuladosRows = (gastosAcumuladosRes.data ?? []) as GastoAgg[];

  const ingresos = pagosPeriodo.reduce(
    (acc, item) => acc + Number(item.monto_pagado || 0),
    0
  );

  const gastos = gastosPeriodo.reduce(
    (acc, item) => acc + Number(item.monto || 0),
    0
  );

  const ingresosAcumulados = pagosAcumulados.reduce(
    (acc, item) => acc + Number(item.monto_pagado || 0),
    0
  );
  const gastosAcumulados = gastosAcumuladosRows.reduce(
    (acc, item) => acc + Number(item.monto || 0),
    0
  );

  const saldoInicial = Number(config?.saldo_inicial || 0);
  const balancePeriodo = ingresos - gastos;
  const saldoFinalPeriodo = saldoInicial + balancePeriodo;
  const saldoAcumuladoHistorico = saldoInicial + ingresosAcumulados - gastosAcumulados;

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  let departamentosAlDia = 0;
  let morosos = 0;

  for (const depto of departamentos) {
    const tieneDeuda = cuotas.some(
      (c) =>
        c.departamento_id === depto.id &&
        estadosDeuda.has(String(c.estado || "").toLowerCase())
    );

    if (tieneDeuda) morosos++;
    else departamentosAlDia++;
  }

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Inteligencia financiera
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Reportes
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Puedes ver reportes mensuales o anuales. Este panel muestra siempre
              el periodo exacto aplicado para evitar confusiones.
            </p>

            <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Periodo aplicado
              </p>
              <p className="mt-1 text-lg font-bold text-white">{rango.periodoTitulo}</p>
              <p className="mt-1 text-sm text-cyan-100">{rango.periodoDetalle}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">Filtro del reporte</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Mensual o anual
            </p>

            <form method="GET" className="mt-5 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Modo
              </label>
              <select
                name="modo"
                defaultValue={modo}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
              >
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>

              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Mes
              </label>
              <select
                name="mes"
                defaultValue={rango.mesValue}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
              >
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>

              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Ano (formato AAAA)
              </label>
              <input
                type="number"
                name="anio"
                min={2000}
                max={2100}
                defaultValue={rango.anioValue}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
              />

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

      <section className="rounded-[24px] border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
          Formula principal
        </p>
        <p className="mt-1 text-sm text-cyan-100">
          Saldo final del periodo = Saldo inicial + Balance del periodo
        </p>
        <p className="mt-1 text-xs text-cyan-50">
          El saldo historico acumulado incluye todos los meses previos hasta el corte seleccionado.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card titulo="Ingresos del periodo" valor={formatBs(ingresos)} />
        <Card titulo="Gastos del periodo" valor={formatBs(gastos)} />
        <Card titulo="Balance del periodo" valor={formatBs(balancePeriodo)} />
        <Card titulo="Saldo inicial" valor={formatBs(saldoInicial)} />
        <Card titulo="Saldo final del periodo" valor={formatBs(saldoFinalPeriodo)} />
        <Card
          titulo="Saldo historico acumulado"
          valor={formatBs(saldoAcumuladoHistorico)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Mini titulo="Pagos del periodo" valor={String(pagosPeriodo.length)} />
        <Mini titulo="Deptos al dia" valor={String(departamentosAlDia)} />
        <AlertCard titulo="Morosos" valor={String(morosos)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Accesos rapidos
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Reportes disponibles
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Selecciona el reporte que quieres abrir.
          </p>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
          <ReportButton
            href="/admin/reportes/departamento"
            titulo="Por departamento"
            texto="Historial, deuda y pagos."
          />

          <ReportButton
            href="/admin/reportes/morosos"
            titulo="Morosos"
            texto="Departamentos con deuda."
          />

          <ReportButton
            href="/admin/gastos"
            titulo="Gastos"
            texto="Ir a gestion de gastos."
          />
        </div>
      </section>
    </main>
  );
}

function Card({
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

function AlertCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-[24px] border border-orange-400/30 bg-orange-500/10 p-5 shadow-xl">
      <p className="text-sm text-orange-100">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
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
    <div className="rounded-2xl bg-[#2d4a6c] p-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-white">{valor}</p>
    </div>
  );
}

function ReportButton({
  href,
  titulo,
  texto,
}: {
  href: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-white/15 bg-[#2d4a6c] p-5 shadow-lg transition hover:bg-[#35557b] hover:ring-1 hover:ring-cyan-400/20"
    >
      <div className="flex h-full min-h-[150px] flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{titulo}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{texto}</p>
        </div>

        <div className="mt-5 inline-flex w-fit items-center rounded-2xl bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-200 transition group-hover:bg-cyan-500/25">
          Abrir reporte
        </div>
      </div>
    </Link>
  );
}
