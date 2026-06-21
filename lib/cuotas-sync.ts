import { getCurrentBoliviaDateParts } from "@/lib/bolivia-time";

type DepartamentoRow = {
  id: string;
  bloque_id: string;
  activo?: boolean | null;
};

type ConfigRow = {
  bloque_id: string;
  cuota_mensual?: number | null;
  dia_vencimiento?: number | null;
};

type CuotaExistenteRow = {
  bloque_id: string;
  departamento_id: string;
};

type HistoricalDebtOptions = {
  bloqueId: string;
  departamentoId: string;
  mesesAdeudadosIniciales: number;
};

function clampDueDay(value: number | null | undefined) {
  const day = Number(value || 15);
  if (!Number.isFinite(day)) return 15;
  return Math.min(28, Math.max(1, Math.trunc(day)));
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function clampNonNegativeInteger(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function shiftYearMonth(year: number, month: number, offsetMonths: number) {
  const totalMonths = year * 12 + (month - 1) - offsetMonths;
  const shiftedYear = Math.floor(totalMonths / 12);
  const shiftedMonth = (totalMonths % 12) + 1;
  return {
    year: shiftedYear,
    month: shiftedMonth,
  };
}

function toBoliviaDateTime(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}T12:00:00-04:00`;
}

async function ensureCurrentMonthCuotasFallback(supabase: any, targetDate: string) {
  const parts = getCurrentBoliviaDateParts(new Date(`${targetDate}T12:00:00-04:00`));
  const anio = parts.year;
  const mes = parts.month;
  const periodo = `${anio}-${pad2(mes)}`;

  const deptosRes = await Promise.resolve(
    supabase.from("departamentos").select("id, bloque_id, activo")
  );
  const deptos = (deptosRes?.data ?? []) as DepartamentoRow[];
  if (!deptos.length) return;

  const bloqueIds = Array.from(
    new Set(deptos.map((d) => String(d.bloque_id || "")).filter(Boolean))
  );
  if (!bloqueIds.length) return;

  const configRes = await Promise.resolve(
    (supabase
      .from("configuracion_bloque")
      .select("bloque_id, cuota_mensual, dia_vencimiento") as unknown as {
      in: (column: string, values: unknown[]) => Promise<{ data: unknown[] | null; error: unknown }>;
    }).in("bloque_id", bloqueIds)
  );
  const configs = (configRes?.data ?? []) as ConfigRow[];
  const configByBloque = new Map(configs.map((cfg) => [String(cfg.bloque_id || ""), cfg]));

  const cuotasRes = await Promise.resolve(
    (supabase.from("cuotas").select("bloque_id, departamento_id, anio, mes") as unknown as {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    })
      .eq("anio", anio)
      .eq("mes", mes)
  );
  const existentes = new Set(
    ((cuotasRes?.data ?? []) as CuotaExistenteRow[]).map(
      (c) => `${String(c.bloque_id || "")}:${String(c.departamento_id || "")}:${anio}:${mes}`
    )
  );

  const insertRows = deptos
    .filter((depto) => {
      const key = `${String(depto.bloque_id || "")}:${String(depto.id || "")}:${anio}:${mes}`;
      return !existentes.has(key);
    })
    .map((depto) => {
      const config = configByBloque.get(String(depto.bloque_id || ""));
      const cuotaMensual = Number(config?.cuota_mensual || 0);
      const dueDay = clampDueDay(config?.dia_vencimiento);

      return {
        bloque_id: String(depto.bloque_id || ""),
        departamento_id: String(depto.id || ""),
        anio,
        mes,
        periodo,
        monto_base: cuotaMensual,
        mora_acumulada: 0,
        monto_total: cuotaMensual,
        fecha_generacion: `${anio}-${pad2(mes)}-01`,
        fecha_vencimiento: `${anio}-${pad2(mes)}-${pad2(dueDay)}`,
        estado: "pendiente",
      };
    });

  if (!insertRows.length) return;
  await Promise.resolve(supabase.from("cuotas").insert(insertRows));
}

export async function ensureCurrentMonthCuotas(supabase: any) {
  const today = getCurrentBoliviaDateParts();
  const targetDate = `${today.year}-${pad2(today.month)}-${pad2(today.day)}`;

  try {
    const rpcRes = await Promise.resolve(
      supabase.rpc("generate_monthly_cuotas", { p_target_date: targetDate })
    );
    if (!rpcRes?.error) return;
    await ensureCurrentMonthCuotasFallback(supabase, targetDate);
    return;
  } catch {
    await ensureCurrentMonthCuotasFallback(supabase, targetDate);
  }
}

export async function ensureHistoricalDebtCuotas(
  supabase: any,
  options: HistoricalDebtOptions
) {
  const bloqueId = String(options.bloqueId || "").trim();
  const departamentoId = String(options.departamentoId || "").trim();
  const mesesAdeudados = clampNonNegativeInteger(options.mesesAdeudadosIniciales);

  if (!bloqueId || !departamentoId || mesesAdeudados <= 0) {
    return;
  }

  const configRes = await Promise.resolve(
    supabase
      .from("configuracion_bloque")
      .select("bloque_id, cuota_mensual, dia_vencimiento")
      .eq("bloque_id", bloqueId)
      .maybeSingle()
  );
  const config = configRes?.data as ConfigRow | null | undefined;
  const cuotaMensual = Number(config?.cuota_mensual || 0);
  const dueDay = clampDueDay(config?.dia_vencimiento);

  const existingRes = await Promise.resolve(
    supabase
      .from("cuotas")
      .select("anio, mes")
      .eq("bloque_id", bloqueId)
      .eq("departamento_id", departamentoId)
  );
  const existingPeriods = new Set(
    ((existingRes?.data ?? []) as Array<{ anio?: number; mes?: number }>).map(
      (row) => `${Number(row.anio || 0)}-${pad2(Number(row.mes || 0))}`
    )
  );

  const today = getCurrentBoliviaDateParts();
  const rows: Record<string, unknown>[] = [];

  for (let index = 0; index < mesesAdeudados; index += 1) {
    const offsetMonths = index + 1;
    const periodDate = shiftYearMonth(today.year, today.month, offsetMonths);
    const key = `${periodDate.year}-${pad2(periodDate.month)}`;

    if (existingPeriods.has(key)) {
      continue;
    }

    rows.push({
      bloque_id: bloqueId,
      departamento_id: departamentoId,
      anio: periodDate.year,
      mes: periodDate.month,
      periodo: key,
      monto_base: cuotaMensual,
      mora_acumulada: 0,
      monto_total: cuotaMensual,
      fecha_generacion: toBoliviaDateTime(periodDate.year, periodDate.month, 1),
      fecha_vencimiento: `${periodDate.year}-${pad2(periodDate.month)}-${pad2(dueDay)}`,
      estado: "pendiente",
      created_at: toBoliviaDateTime(periodDate.year, periodDate.month, 1),
      updated_at: toBoliviaDateTime(periodDate.year, periodDate.month, 1),
    });
  }

  if (!rows.length) {
    return;
  }

  await Promise.resolve(supabase.from("cuotas").insert(rows));
}
