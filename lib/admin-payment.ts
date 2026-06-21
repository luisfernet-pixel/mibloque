export type AdminPaymentDetails = {
  banco: string;
  numeroCuenta: string;
  qrUrl: string;
};

const ADMIN_PAYMENT_PREFIX = "kubo-admin-payment:";

export function parseAdminPaymentDetails(value: string | null | undefined): AdminPaymentDetails {
  const raw = String(value || "").trim();
  if (!raw.startsWith(ADMIN_PAYMENT_PREFIX)) {
    return { banco: "", numeroCuenta: "", qrUrl: "" };
  }

  try {
    const parsed = JSON.parse(raw.slice(ADMIN_PAYMENT_PREFIX.length)) as Partial<AdminPaymentDetails>;
    return {
      banco: String(parsed.banco || ""),
      numeroCuenta: String(parsed.numeroCuenta || ""),
      qrUrl: String(parsed.qrUrl || ""),
    };
  } catch {
    return { banco: "", numeroCuenta: "", qrUrl: "" };
  }
}

export function serializeAdminPaymentDetails(details: AdminPaymentDetails) {
  return `${ADMIN_PAYMENT_PREFIX}${JSON.stringify({
    banco: details.banco,
    numeroCuenta: details.numeroCuenta,
    qrUrl: details.qrUrl,
  })}`;
}
