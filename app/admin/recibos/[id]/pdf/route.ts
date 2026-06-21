import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildReceiptPdf } from "@/lib/pdf";
import { getAuthUserSafe } from "@/lib/auth";

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-BO");
}

function pickDepartamentoNumero(value: unknown) {
  if (Array.isArray(value)) return value[0]?.numero ?? "-";
  if (value && typeof value === "object" && "numero" in value) return (value as { numero?: string | number | null }).numero ?? "-";
  return "-";
}

function pickCuotaPeriodo(value: unknown) {
  if (Array.isArray(value)) return value[0]?.periodo ?? "-";
  if (value && typeof value === "object" && "periodo" in value) return (value as { periodo?: string | null }).periodo ?? "-";
  return "-";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const user = await getAuthUserSafe(supabase);
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const { data: perfil } = await adminSupabase
    .from("usuarios")
    .select("id, nombre, email, rol, bloque_id")
    .eq("id", user.id)
    .single();
  if (!perfil || perfil.rol !== "admin" || !perfil.bloque_id) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: bloque } = await adminSupabase
    .from("bloques")
    .select("nombre, codigo")
    .eq("id", perfil.bloque_id)
    .maybeSingle();

  const { data: pago } = await adminSupabase
    .from("pagos")
    .select(`id, numero_recibo, bloque_id, departamento_id, cuota_id, monto_pagado, fecha_pago, metodo_pago, referencia, observaciones, cuotas:cuota_id (periodo), departamentos:departamento_id (numero)`)
    .eq("id", id)
    .eq("bloque_id", perfil.bloque_id)
    .single();
  if (!pago) return NextResponse.redirect(new URL("/admin/pagos/historial", req.url), 303);

  const { data: confirmacion } = await adminSupabase
    .from("confirmaciones_pago")
    .select("revisado_por, revisado_at")
    .eq("cuota_id", pago.cuota_id)
    .eq("departamento_id", pago.departamento_id)
    .eq("estado", "aprobado")
    .order("revisado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: aprobador } = confirmacion?.revisado_por
    ? await adminSupabase.from("usuarios").select("nombre, email").eq("id", confirmacion.revisado_por).maybeSingle()
    : { data: null };

  const pdf = buildReceiptPdf({
    receiptNumber: String((pago as { numero_recibo?: string | null }).numero_recibo || pago.id.slice(0, 8).toUpperCase()),
    vecinoName: "Vecino",
    bloqueName: bloque?.nombre || "Bloque",
    bloqueCode: bloque?.codigo || perfil.bloque_id || "-",
    departamentoLabel: String(pickDepartamentoNumero(pago.departamentos)),
    periodoLabel: String(pickCuotaPeriodo(pago.cuotas)),
    montoLabel: money(pago.monto_pagado),
    fechaLabel: formatDate(pago.fecha_pago),
    referenciaLabel: pago.referencia || "Sin referencia",
    metodoLabel: pago.metodo_pago || "transferencia",
    observacionesLabel: pago.observaciones || "Pago aprobado desde confirmaciones",
    aprobadoPorLabel: aprobador?.nombre || perfil.nombre || "Administracion del bloque",
    adminEmailLabel: aprobador?.email || perfil.email || "No registrado",
    adminPhoneLabel: "No registrado",
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${pago.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
