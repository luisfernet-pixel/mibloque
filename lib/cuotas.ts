import { getBoliviaDateParts, getCurrentBoliviaDateParts } from "@/lib/bolivia-time";

type CuotaLike = {
  monto_base?: number | null;
  monto_total?: number | null;
  mora_acumulada?: number | null;
  estado?: string | null;
  anio?: number | null;
  mes?: number | null;
  periodo?: string | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

type ConfiguracionMoraLike = {
  dia_vencimiento?: number | null;
  valor_mora?: number | null;
};

export type CuotaMoraDetalle = {
  anio: number;
  mes: number;
  monto: number;
};

function clampDueDay(value: number | null | undefined) {
  const day = Number(value || 15);
  if (!Number.isFinite(day)) return 15;
  return Math.min(28, Math.max(1, Math.trunc(day)));
}

function resolvePeriodo(cuota: CuotaLike) {
  const anio = Number(cuota.anio || 0);
  const mes = Number(cuota.mes || 0);
  if (anio >= 2000 && mes >= 1 && mes <= 12) {
    return { year: anio, month: mes };
  }

  const periodoMatch = /^(\d{4})-(\d{2})$/.exec(String(cuota.periodo || "").trim());
  if (periodoMatch) {
    return {
      year: Number(periodoMatch[1]),
      month: Number(periodoMatch[2]),
    };
  }

  const fechaVencimiento = getBoliviaDateParts(cuota.fecha_vencimiento || null);
  if (fechaVencimiento) {
    return { year: fechaVencimiento.year, month: fechaVencimiento.month };
  }

  const createdAt = getBoliviaDateParts(cuota.created_at || null);
  if (createdAt) {
    return { year: createdAt.year, month: createdAt.month };
  }

  return null;
}

export function getCuotaMesesDeMora(
  cuota: CuotaLike,
  config: ConfiguracionMoraLike | null | undefined,
  now: Date = new Date()
) {
  const estado = String(cuota.estado || "").toLowerCase();
  if (estado === "pagado") return 0;

  const periodo = resolvePeriodo(cuota);
  if (!periodo) return 0;

  const actual = getCurrentBoliviaDateParts(now);
  const diferenciaMeses =
    (actual.year - periodo.year) * 12 + (actual.month - periodo.month);

  if (diferenciaMeses <= 0) return 0;

  const diaVencimiento = clampDueDay(config?.dia_vencimiento);
  const moraActivaEsteMes = actual.day >= diaVencimiento;

  return Math.max(0, moraActivaEsteMes ? diferenciaMeses : diferenciaMeses - 1);
}

export function getCuotaMoraVigente(
  cuota: CuotaLike,
  config: ConfiguracionMoraLike | null | undefined,
  now: Date = new Date()
) {
  const estado = String(cuota.estado || "").toLowerCase();
  if (estado === "pagado") {
    return Number(cuota.mora_acumulada || 0);
  }

  const moraMensual = Number(config?.valor_mora || 0);
  if (!Number.isFinite(moraMensual) || moraMensual <= 0) return 0;

  return getCuotaMesesDeMora(cuota, config, now) * moraMensual;
}

export function getCuotaMoraDetalle(
  cuota: CuotaLike,
  config: ConfiguracionMoraLike | null | undefined,
  now: Date = new Date()
): CuotaMoraDetalle[] {
  const periodo = resolvePeriodo(cuota);
  const mesesDeMora = getCuotaMesesDeMora(cuota, config, now);
  const moraMensual = Number(config?.valor_mora || 0);

  if (!periodo || mesesDeMora <= 0 || !Number.isFinite(moraMensual) || moraMensual <= 0) {
    return [];
  }

  return Array.from({ length: mesesDeMora }, (_, index) => {
    const totalMeses = periodo.year * 12 + (periodo.month - 1) + index + 1;
    return {
      anio: Math.floor(totalMeses / 12),
      mes: (totalMeses % 12) + 1,
      monto: moraMensual,
    };
  });
}

export function getCuotaMontoVigente(
  cuota: CuotaLike,
  config: ConfiguracionMoraLike | null | undefined,
  now: Date = new Date()
) {
  const estado = String(cuota.estado || "").toLowerCase();
  const montoBase = Number(cuota.monto_base ?? cuota.monto_total ?? 0);

  if (estado === "pagado") {
    return Number(cuota.monto_total ?? montoBase);
  }

  return montoBase + getCuotaMoraVigente(cuota, config, now);
}

export function getCuotaEstadoVigente(
  cuota: CuotaLike,
  config: ConfiguracionMoraLike | null | undefined,
  now: Date = new Date()
) {
  const estado = String(cuota.estado || "").toLowerCase();
  if (estado === "pagado") return "pagado";

  return getCuotaMesesDeMora(cuota, config, now) > 0 ? "vencido" : "pendiente";
}
