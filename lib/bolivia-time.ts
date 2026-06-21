const BOLIVIA_TIME_ZONE = "America/La_Paz";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function readIntlPart(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day") {
  return Number(parts.find((part) => part.type === type)?.value || 0);
}

export function getBoliviaDateParts(value: string | null | undefined): DateParts | null {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (dateOnlyMatch) {
    return {
      year: Number(dateOnlyMatch[1]),
      month: Number(dateOnlyMatch[2]),
      day: Number(dateOnlyMatch[3]),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  return {
    year: readIntlPart(parts, "year"),
    month: readIntlPart(parts, "month"),
    day: readIntlPart(parts, "day"),
  };
}

export function getCurrentBoliviaYearMonth(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  return {
    year: readIntlPart(parts, "year"),
    month: readIntlPart(parts, "month"),
  };
}

export function getCurrentBoliviaDateParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return {
    year: readIntlPart(parts, "year"),
    month: readIntlPart(parts, "month"),
    day: readIntlPart(parts, "day"),
  };
}

export function isDateInBoliviaMonth(
  value: string | null | undefined,
  targetYear: number,
  targetMonth: number
) {
  const parts = getBoliviaDateParts(value);
  if (!parts) return false;
  return parts.year === targetYear && parts.month === targetMonth;
}

export function compareYearMonth(
  year: number | null | undefined,
  month: number | null | undefined,
  targetYear: number,
  targetMonth: number
) {
  const safeYear = Number(year || 0);
  const safeMonth = Number(month || 0);

  if (!Number.isFinite(safeYear) || !Number.isFinite(safeMonth) || safeMonth < 1 || safeMonth > 12) {
    return null;
  }

  if (safeYear === targetYear && safeMonth === targetMonth) return 0;
  if (safeYear < targetYear || (safeYear === targetYear && safeMonth < targetMonth)) return -1;
  return 1;
}

export function formatBoliviaDate(value: string | null | undefined) {
  const parts = getBoliviaDateParts(value);
  if (!parts) return "-";
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatBoliviaMonthLabel(value: string | null | undefined) {
  const parts = getBoliviaDateParts(value);
  if (!parts) return "-";

  const label = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1)));

  return label.charAt(0).toUpperCase() + label.slice(1);
}
