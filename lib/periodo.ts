export function formatPeriodoLabel(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin periodo";

  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) {
      const label = new Intl.DateTimeFormat("es-BO", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month - 1, 1)));
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  const normalized = raw.replace(/\s+/g, " ").trim();
  const normalizedDe = /\bde\b/i.test(normalized)
    ? normalized
    : normalized.replace(/^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})$/, "$1 de $2");
  return normalizedDe.charAt(0).toUpperCase() + normalizedDe.slice(1);
}
