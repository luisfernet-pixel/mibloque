import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareYearMonth, getCurrentBoliviaYearMonth, isDateInBoliviaMonth } from "@/lib/bolivia-time";
import { getCuotaMontoVigente } from "@/lib/cuotas";

const DEFAULT_TOLERANCE = 0.01;

function getBoliviaDateKey(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value || 0);
  const month = Number(parts.find((p) => p.type === "month")?.value || 0);
  const day = Number(parts.find((p) => p.type === "day")?.value || 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toNumber(value: number | null | undefined) {
  return Number(value || 0);
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!cronSecret || bearer !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const fechaControl = getBoliviaDateKey();
  const periodoActual = getCurrentBoliviaYearMonth();

  const { data: bloques, error: bloquesError } = await supabase.from("bloques").select("id").eq("activo", true);
  if (bloquesError) {
    return NextResponse.json({ ok: false, error: bloquesError.message }, { status: 500 });
  }

  let totalBloques = 0;
  let bloquesConDiferencia = 0;
  const detalles: Array<{ bloque_id: string; diferencia_total: number; tiene_diferencia: boolean }> = [];

  for (const bloque of bloques ?? []) {
    const bloqueId = String(bloque.id || "");
    if (!bloqueId) continue;
    totalBloques += 1;

    const [pagosRes, gastosRes, cuotasRes, configRes] = await Promise.all([
      supabase.from("pagos").select("monto_pagado, fecha_pago").eq("bloque_id", bloqueId),
      supabase.from("gastos").select("monto, fecha_gasto").eq("bloque_id", bloqueId),
      supabase.from("cuotas").select("monto_base, mora_acumulada, monto_total, estado, anio, mes, periodo, fecha_vencimiento, created_at").eq("bloque_id", bloqueId),
      supabase.from("configuracion_bloque").select("saldo_inicial, dia_vencimiento, valor_mora").eq("bloque_id", bloqueId).maybeSingle(),
    ]);

    const pagos = pagosRes.data ?? [];
    const gastos = gastosRes.data ?? [];
    const cuotas = (cuotasRes.data ?? []).map((row) => ({
      ...row,
      monto_total: getCuotaMontoVigente(row, configRes.data),
    }));
    const saldoInicial = toNumber(configRes.data?.saldo_inicial);

    const cobradoDashboard = pagos
      .filter((row) => isDateInBoliviaMonth(row.fecha_pago, periodoActual.year, periodoActual.month))
      .reduce((acc, row) => acc + toNumber(row.monto_pagado), 0);

    const gastadoDashboard = gastos
      .filter((row) => isDateInBoliviaMonth(row.fecha_gasto, periodoActual.year, periodoActual.month))
      .reduce((acc, row) => acc + toNumber(row.monto), 0);

    const porCobrarDashboard = cuotas
      .filter((row) => {
        const estado = String(row.estado || "").toLowerCase();
        return (
          (estado === "pendiente" || estado === "vencido") &&
          compareYearMonth(row.anio, row.mes, periodoActual.year, periodoActual.month) === 0
        );
      })
      .reduce((acc, row) => acc + toNumber(row.monto_total), 0);

    const cobradoAuditoria = cobradoDashboard;
    const gastadoAuditoria = gastadoDashboard;
    const porCobrarAuditoria = porCobrarDashboard;

    const saldoDashboard = saldoInicial + pagos.reduce((acc, row) => acc + toNumber(row.monto_pagado), 0) - gastos.reduce((acc, row) => acc + toNumber(row.monto), 0);
    const saldoAuditoria = saldoDashboard;

    const diferenciaTotal =
      Math.abs(cobradoDashboard - cobradoAuditoria) +
      Math.abs(gastadoDashboard - gastadoAuditoria) +
      Math.abs(porCobrarDashboard - porCobrarAuditoria) +
      Math.abs(saldoDashboard - saldoAuditoria);

    const tieneDiferencia = diferenciaTotal > DEFAULT_TOLERANCE;
    if (tieneDiferencia) bloquesConDiferencia += 1;

    const detalle = tieneDiferencia
      ? `Dif: cobros=${(cobradoDashboard - cobradoAuditoria).toFixed(2)}, gastos=${(gastadoDashboard - gastadoAuditoria).toFixed(2)}, por_cobrar=${(porCobrarDashboard - porCobrarAuditoria).toFixed(2)}, saldo=${(saldoDashboard - saldoAuditoria).toFixed(2)}`
      : "OK";

    const { error: upsertError } = await supabase.from("auditoria_diaria").upsert(
      {
        bloque_id: bloqueId,
        fecha_control: fechaControl,
        cobrado_dashboard: cobradoDashboard,
        gastado_dashboard: gastadoDashboard,
        por_cobrar_dashboard: porCobrarDashboard,
        cobrado_auditoria: cobradoAuditoria,
        gastado_auditoria: gastadoAuditoria,
        por_cobrar_auditoria: porCobrarAuditoria,
        saldo_dashboard: saldoDashboard,
        saldo_auditoria: saldoAuditoria,
        diferencia_total: diferenciaTotal,
        tiene_diferencia: tieneDiferencia,
        detalle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bloque_id,fecha_control" }
    );

    if (upsertError) {
      return NextResponse.json({ ok: false, error: upsertError.message, bloqueId }, { status: 500 });
    }

    detalles.push({
      bloque_id: bloqueId,
      diferencia_total: Number(diferenciaTotal.toFixed(2)),
      tiene_diferencia: tieneDiferencia,
    });
  }

  return NextResponse.json({
    ok: true,
    fecha_control: fechaControl,
    total_bloques: totalBloques,
    bloques_con_diferencia: bloquesConDiferencia,
    detalles,
  });
}
