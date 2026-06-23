import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCurrentBoliviaYearMonth } from "@/lib/bolivia-time";
import { getCuotaEstadoVigente } from "@/lib/cuotas";
import { createClient } from "@/lib/supabase/server";

// Utilidades

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

function dateOnly(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function boliviaDateToUtcIso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0)).toISOString();
}

function getNextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
function parseMes(value: string, fallbackMonth: number) {
  const raw = String(value || "").trim();
  const legacy = /^(\d{4})-(\d{2})$/.exec(raw);
  if (legacy) {
    const month = Number(legacy[2]);
    if (month >= 1 && month <= 12) return month;
  }
  const month = Number(raw);
  if (!Number.isFinite(month) || month < 1 || month > 12) return fallbackMonth;
  return month;
}

function parseAnio(value: string, fallbackYear: number) {
  const year = Number(value || fallbackYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return fallbackYear;
  return year;
}

function getRangoPeriodo(
  modo: "mensual" | "anual",
  mesInput: string,
  anioInput: string,
  now: Date
) {
  const actualBolivia = getCurrentBoliviaYearMonth(now);
  const fallbackYear = actualBolivia.year;
  const fallbackMonth = actualBolivia.month;

  if (modo === "anual") {
    const year = parseAnio(anioInput, fallbackYear);
    const inicioVisible = new Date(Date.UTC(year, 0, 1));
    const finVisible = new Date(Date.UTC(year, 11, 31));
    return {
      modo,
      mesValue: String(fallbackMonth).padStart(2, "0"),
      anioValue: String(year),
      inicioIso: boliviaDateToUtcIso(year, 1, 1),
      finIso: boliviaDateToUtcIso(year + 1, 1, 1),
      inicioDate: dateOnly(year, 1, 1),
      finDateExclusiva: dateOnly(year + 1, 1, 1),
      periodoTitulo: `Gestión ${year}`,
      periodoDetalle: `Del ${formatDateLong(inicioVisible)} al ${formatDateLong(finVisible)}`,
    };
  }

  const year = parseAnio(anioInput, fallbackYear);
  const month = parseMes(mesInput, fallbackMonth);
  const nextMonth = getNextMonth(year, month);
  const inicioVisible = new Date(Date.UTC(year, month - 1, 1));
  const finVisible = new Date(Date.UTC(nextMonth.year, nextMonth.month - 1, 0));
  const periodoTitulo = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(inicioVisible);

  return {
    modo,
    mesValue: String(month).padStart(2, "0"),
    anioValue: String(year),
    inicioIso: boliviaDateToUtcIso(year, month, 1),
    finIso: boliviaDateToUtcIso(nextMonth.year, nextMonth.month, 1),
    inicioDate: dateOnly(year, month, 1),
    finDateExclusiva: dateOnly(nextMonth.year, nextMonth.month, 1),
    periodoTitulo: periodoTitulo.charAt(0).toUpperCase() + periodoTitulo.slice(1),
    periodoDetalle: `Del ${formatDateLong(inicioVisible)} al ${formatDateLong(finVisible)}`,
  };
}

// Tipos

type SearchParams = Promise<{ modo?: string; mes?: string; anio?: string }>;
type PagoAgg = { monto_pagado: number | null };
type GastoAgg = { monto: number | null };
type DepartamentoRow = { id: string; numero: string };
type CuotaEstadoRow = {
  departamento_id: string | null;
  estado: string | null;
  anio?: number | null;
  mes?: number | null;
  periodo?: string | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};
type ConfigRow = {
  saldo_inicial: number | null;
  dia_vencimiento?: number | null;
  valor_mora?: number | null;
};

// Página principal

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
  if (!bloqueId) {
    return (
      <main className="space-y-4 overflow-x-hidden print:space-y-6">
        <section className="rounded-[20px] border border-amber-300/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          No hay un bloque asignado para mostrar reportes.
        </section>
      </main>
    );
  }

  const now = new Date();
  const { year: currentYear } = getCurrentBoliviaYearMonth(now);
  const availableYears = Array.from(
    { length: currentYear - 2024 + 2 },
    (_, index) => String(2024 + index)
  );

  const modo = params?.modo === "anual" ? "anual" : "mensual";
  const rango = getRangoPeriodo(modo, params?.mes || "", params?.anio || "", now);

  const [
    pagosPeriodoRes,
    gastosPeriodoRes,
    departamentosRes,
    cuotasRes,
    configRes,
    pagosAcumuladosRes,
    gastosAcumuladosRes,
  ] = await Promise.all([
    supabase.from("pagos").select("monto_pagado").eq("bloque_id", bloqueId).gte("fecha_pago", rango.inicioIso).lt("fecha_pago", rango.finIso),
    supabase.from("gastos").select("monto").eq("bloque_id", bloqueId).gte("fecha_gasto", rango.inicioDate).lt("fecha_gasto", rango.finDateExclusiva),
    supabase.from("departamentos").select("id, numero").eq("bloque_id", bloqueId),
    supabase.from("cuotas").select("departamento_id, estado, anio, mes, periodo, fecha_vencimiento, created_at").eq("bloque_id", bloqueId),
    supabase.from("configuracion_bloque").select("saldo_inicial, dia_vencimiento, valor_mora").eq("bloque_id", bloqueId).maybeSingle(),
    supabase.from("pagos").select("monto_pagado").eq("bloque_id", bloqueId).lt("fecha_pago", rango.finIso),
    supabase.from("gastos").select("monto").eq("bloque_id", bloqueId).lt("fecha_gasto", rango.finDateExclusiva),
  ]);

  const pagosPeriodo = (pagosPeriodoRes.data ?? []) as PagoAgg[];
  const gastosPeriodo = (gastosPeriodoRes.data ?? []) as GastoAgg[];
  const departamentos = (departamentosRes.data ?? []) as DepartamentoRow[];
  const cuotas = (cuotasRes.data ?? []) as CuotaEstadoRow[];
  const config = (configRes.data ?? null) as ConfigRow | null;
  const cuotasConEstadoVigente = cuotas.map((cuota) => ({
    ...cuota,
    estado: getCuotaEstadoVigente(cuota, config, now),
  }));
  const pagosAcumulados = (pagosAcumuladosRes.data ?? []) as PagoAgg[];
  const gastosAcumuladosRows = (gastosAcumuladosRes.data ?? []) as GastoAgg[];

  const ingresos = pagosPeriodo.reduce((acc, item) => acc + Number(item.monto_pagado || 0), 0);
  const gastos = gastosPeriodo.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const ingresosAcumulados = pagosAcumulados.reduce((acc, item) => acc + Number(item.monto_pagado || 0), 0);
  const gastosAcumulados = gastosAcumuladosRows.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const saldoInicial = Number(config?.saldo_inicial || 0);
  const balancePeriodo = ingresos - gastos;
  const saldoAcumuladoHistorico = saldoInicial + ingresosAcumulados - gastosAcumulados;
  const saldoInicioPeriodo = saldoAcumuladoHistorico - balancePeriodo;
  const saldoFinalPeriodo = saldoAcumuladoHistorico;

  const estadosDeuda = new Set(["pendiente", "vencido"]);
  let departamentosAlDia = 0;
  let morosos = 0;
  for (const depto of departamentos) {
    const tieneDeuda = cuotasConEstadoVigente.some(
      (c) => c.departamento_id === depto.id && estadosDeuda.has(String(c.estado || "").toLowerCase())
    );
    if (tieneDeuda) morosos++;
    else departamentosAlDia++;
  }

  const tasaCumplimiento =
    departamentos.length > 0
      ? Math.round((departamentosAlDia / departamentos.length) * 100)
      : 0;

  const fechaEmision = new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  }).format(now);

  return (
    <main className="space-y-4 overflow-x-hidden print:space-y-6">

      {/* Encabezado del informe */}
      <section className="overflow-hidden rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 print:rounded-none print:ring-0 print:bg-white">
        <div className="grid gap-0 xl:grid-cols-[1fr_auto]">

          {/* Título */}
          <div className="p-4 md:p-6 xl:p-8 print:p-0 print:pb-4 print:border-b print:border-slate-300">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400 print:text-slate-500">
              Informe Financiero · {rango.modo === "anual" ? "Gestión Anual" : "Período Mensual"}
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white md:text-4xl print:text-slate-900 print:text-3xl">
              Estado de Cuentas
            </h1>
            <p className="mt-1 text-lg text-cyan-200 font-medium print:text-slate-600 print:text-base">
              {rango.periodoTitulo}
            </p>
            <p className="mt-1 text-sm text-slate-400 print:text-slate-500">
              {rango.periodoDetalle}
            </p>
            <p className="mt-4 text-xs text-slate-500 print:text-slate-400">
              Emitido el {fechaEmision} - Administrador: {usuario.perfil.nombre || "-"}
            </p>
          </div>

          {/* Selector de período - solo en pantalla */}
          <div className="border-t border-white/10 bg-[#162b42] p-4 print:hidden xl:min-w-[260px] xl:border-l xl:border-t-0 xl:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-4">
              Seleccionar período
            </p>
            <form method="GET" className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Modo</label>
                <select
                  name="modo"
                  defaultValue={modo}
                  className="w-full rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Mes</label>
                <select
                  name="mes"
                  defaultValue={rango.mesValue}
                  className="w-full rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                >
                  {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Año (formato AAAA)</label>
                <select
                  name="anio"
                  defaultValue={rango.anioValue}
                  className="w-full rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500"
              >
                Generar informe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* I. Estado de resultados */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="I"
          titulo="Estado de Resultados del Período"
          subtitulo="Ingresos, egresos y resultado neto del período seleccionado"
        />
        <div className="p-5 print:p-4">
          <table className="w-full text-sm print:text-xs">
            <tbody className="divide-y divide-white/5 print:divide-slate-200">
              <FilaTabla
                concepto="Ingresos por cuotas de mantenimiento"
                monto={formatBs(ingresos)}
                tipo="ingreso"
                descripcion="Pagos recibidos de propietarios en el período"
              />
              <FilaTabla
                concepto="Egresos operativos"
                monto={`(${formatBs(gastos)})`}
                tipo="egreso"
                descripcion="Gastos registrados en el período"
              />
              <FilaTabla
                concepto="Resultado neto del período"
                monto={formatBs(balancePeriodo)}
                tipo={balancePeriodo >= 0 ? "resultado-positivo" : "resultado-negativo"}
                descripcion="Ingresos menos egresos del período"
                resaltado
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── II. Posición financiera ────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="II"
          titulo="Posición Financiera"
          subtitulo="Patrimonio líquido disponible al cierre del período"
        />
        <div className="p-5 print:p-4">
          <table className="w-full text-sm print:text-xs">
            <tbody className="divide-y divide-white/5 print:divide-slate-200">
              <FilaTabla
                concepto="Saldo al inicio del período"
                monto={formatBs(saldoInicioPeriodo)}
                tipo="neutro"
                descripcion="Saldo acumulado justo antes del inicio del período seleccionado"
              />
              <FilaTabla
                concepto="Resultado neto del período"
                monto={formatBs(balancePeriodo)}
                tipo={balancePeriodo >= 0 ? "ingreso" : "egreso"}
                descripcion="Ver sección I"
              />
              <FilaTabla
                concepto="Saldo de caja al cierre del período"
                monto={formatBs(saldoFinalPeriodo)}
                tipo={saldoFinalPeriodo >= 0 ? "resultado-positivo" : "resultado-negativo"}
                descripcion="Saldo al inicio del período más resultado neto del período"
                resaltado
              />
            </tbody>
          </table>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 print:border-slate-200 print:bg-slate-50">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 print:text-slate-500">
              Saldo histórico acumulado
            </p>
            <p className="mt-1 text-2xl font-bold text-white print:text-slate-900">
              {formatBs(saldoAcumuladoHistorico)}
            </p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-400">
              Incluye todos los movimientos desde el inicio hasta el corte del período seleccionado.
            </p>
          </div>
        </div>
      </section>

      {/* III. Cumplimiento de cuotas */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="III"
          titulo="Cumplimiento de Cuotas"
          subtitulo="Estado de pago por unidades del edificio"
        />
        <div className="p-5 print:p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricaCard
              label="Unidades totales"
              valor={String(departamentos.length)}
              descripcion="Departamentos registrados"
              color="neutro"
            />
            <MetricaCard
              label="Al día"
              valor={String(departamentosAlDia)}
              descripcion="Sin cuotas pendientes"
              color="positivo"
            />
            <MetricaCard
              label="Con adeudo"
              valor={String(morosos)}
              descripcion="Con cuotas pendientes o vencidas"
              color="negativo"
            />
            <MetricaCard
              label="Tasa de cumplimiento"
              valor={`${tasaCumplimiento}%`}
              descripcion="Porcentaje de unidades al día"
              color={tasaCumplimiento >= 80 ? "positivo" : tasaCumplimiento >= 50 ? "advertencia" : "negativo"}
            />
          </div>

          {/* Barra de cumplimiento */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-400 print:text-slate-500 mb-2">
              <span>Cumplimiento global</span>
              <span className="font-semibold text-white print:text-slate-700">{tasaCumplimiento}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 print:bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tasaCumplimiento >= 80
                    ? "bg-emerald-500"
                    : tasaCumplimiento >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${tasaCumplimiento}%` }}
              />
            </div>
          </div>

          {morosos > 0 && (
            <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 print:border-orange-300 print:bg-orange-50">
              <p className="text-sm font-semibold text-orange-200 print:text-orange-800">
                {morosos} unidad{morosos !== 1 ? "es" : ""} registra{morosos === 1 ? "" : "n"} adeudos pendientes.
              </p>
              <p className="mt-0.5 text-xs text-orange-300 print:text-orange-600">
                Consulte el reporte de morosos para el detalle por departamento.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── IV. Indicadores clave ─────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <SectionHeader
          numero="IV"
          titulo="Indicadores Clave"
          subtitulo="Métricas de gestión del período"
        />
        <div className="p-5 print:p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Indicador
              label="Pagos recibidos"
              valor={String(pagosPeriodo.length)}
              unidad="transacciones en el período"
            />
            <Indicador
              label="Promedio por pago"
              valor={pagosPeriodo.length > 0 ? formatBs(ingresos / pagosPeriodo.length) : "—"}
              unidad="monto promedio por transacción"
            />
            <Indicador
              label="Cobertura de gastos"
              valor={gastos > 0 ? `${Math.round((ingresos / gastos) * 100)}%` : "—"}
              unidad="ratio ingresos sobre egresos"
            />
          </div>
        </div>
      </section>

      {/* ── Nota metodológica ─────────────────────────────────────────────── */}
      <section className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 print:rounded-none print:border-slate-200 print:bg-transparent">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">
          Nota metodológica
        </p>
        <ul className="space-y-1 text-xs text-slate-400 print:text-slate-500 list-disc list-inside">
          <li>El resultado del período se calcula como: Ingresos del período − Egresos del período.</li>
          <li>El saldo al inicio del período se calcula con el saldo inicial configurado más los movimientos acumulados antes del corte.</li>
          <li>El saldo al cierre corresponde al saldo al inicio del período más el resultado neto del período.</li>
          <li>El saldo histórico acumulado considera todos los movimientos desde el inicio de operaciones hasta el corte.</li>
          <li>La tasa de cumplimiento refleja el estado actual de cuotas; no está limitada al período seleccionado.</li>
        </ul>
      </section>

      {/* VI. Reportes detallados */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400">
            Reportes detallados
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Documentos de soporte con mayor nivel de detalle.
          </p>
        </div>
        <div className="grid gap-3 p-4 md:p-5 md:grid-cols-2 xl:grid-cols-4">
          <ReportButton
            href="/admin/auditoria"
            titulo="Auditoría simple"
            texto="Control mensual directo de cobros, gastos, por cobrar y saldo."
          />
          <ReportButton
            href="/admin/reportes/departamento"
            titulo="Por Departamento"
            texto="Historial de pagos, deuda y movimientos por unidad."
          />
          <ReportButton
            href="/admin/reportes/morosos"
            titulo="Unidades con Adeudo"
            texto="Relación de departamentos con cuotas pendientes o vencidas."
          />
          <ReportButton
            href="/admin/reportes/cuadro"
            titulo="Cuadro de Cuotas"
            texto="Tabla anual de cumplimiento por mes, apta para impresión."
          />
        </div>
      </section>

    </main>
  );
}

// ─── Componentes ───────────────────────────────────────────────────────────────

function SectionHeader({
  numero,
  titulo,
  subtitulo,
}: {
  numero: string;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/10 px-4 py-4 print:border-slate-200 print:px-4 sm:gap-4 sm:px-5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/20 print:bg-slate-100 print:text-slate-600 print:ring-slate-300">
        {numero}
      </span>
      <div>
        <h2 className="text-base font-bold text-white print:text-slate-900">{titulo}</h2>
        <p className="text-xs text-slate-500 print:text-slate-400">{subtitulo}</p>
      </div>
    </div>
  );
}

function FilaTabla({
  concepto,
  monto,
  tipo,
  descripcion,
  resaltado = false,
}: {
  concepto: string;
  monto: string;
  tipo: "ingreso" | "egreso" | "resultado-positivo" | "resultado-negativo" | "neutro";
  descripcion: string;
  resaltado?: boolean;
}) {
  const colorMonto = {
    ingreso: "text-emerald-400 print:text-emerald-700",
    egreso: "text-red-400 print:text-red-700",
    "resultado-positivo": "text-emerald-300 print:text-emerald-800",
    "resultado-negativo": "text-red-300 print:text-red-800",
    neutro: "text-slate-200 print:text-slate-700",
  }[tipo];

  return (
    <tr className={resaltado ? "bg-white/5 print:bg-slate-50" : ""}>
      <td className="py-3 pr-4 print:py-2">
        <p className={`font-medium ${resaltado ? "text-white print:text-slate-900" : "text-slate-200 print:text-slate-700"}`}>
          {concepto}
        </p>
        <p className="text-xs text-slate-500 print:text-slate-400">{descripcion}</p>
      </td>
      <td className={`py-3 pl-4 text-right font-bold tabular-nums whitespace-nowrap print:py-2 ${resaltado ? "text-lg" : "text-base"} ${colorMonto}`}>
        {monto}
      </td>
    </tr>
  );
}

function MetricaCard({
  label,
  valor,
  descripcion,
  color,
}: {
  label: string;
  valor: string;
  descripcion: string;
  color: "positivo" | "negativo" | "neutro" | "advertencia";
}) {
  const borde = {
    positivo: "border-emerald-500/20 print:border-emerald-300",
    negativo: "border-red-500/20 print:border-red-300",
    neutro: "border-white/10 print:border-slate-200",
    advertencia: "border-amber-500/20 print:border-amber-300",
  }[color];

  const texto = {
    positivo: "text-emerald-400 print:text-emerald-700",
    negativo: "text-red-400 print:text-red-700",
    neutro: "text-white print:text-slate-800",
    advertencia: "text-amber-400 print:text-amber-700",
  }[color];

  return (
    <div className={`rounded-xl border bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b ${borde}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${texto}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">{descripcion}</p>
    </div>
  );
}

function Indicador({
  label,
  valor,
  unidad,
}: {
  label: string;
  valor: string;
  unidad: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 print:border-slate-200 print:bg-transparent print:rounded-none">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-white tabular-nums print:text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">{unidad}</p>
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
      className="group flex flex-col justify-between rounded-[16px] border border-white/10 bg-white/5 p-4 min-h-[120px] transition hover:bg-white/10 hover:border-cyan-500/20"
    >
      <div>
        <h3 className="font-bold text-white">{titulo}</h3>
        <p className="mt-1.5 text-xs leading-5 text-slate-400">{texto}</p>
      </div>
      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 transition group-hover:bg-cyan-500/25">
        Abrir →
      </span>
    </Link>
  );
}
