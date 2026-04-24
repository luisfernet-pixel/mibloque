import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildReceiptPdf } from "@/lib/pdf";

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
  if (Array.isArray(value)) {
    const first = value[0] as { numero?: string | number | null } | undefined;
    return first?.numero ?? "-";
  }
  if (value && typeof value === "object" && "numero" in value) {
    const row = value as { numero?: string | number | null };
    return row.numero ?? "-";
  }
  return "-";
}

function pickCuotaPeriodo(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { periodo?: string | null } | undefined;
    return first?.periodo ?? "-";
  }
  if (value && typeof value === "object" && "periodo" in value) {
    const row = value as { periodo?: string | null };
    return row.periodo ?? "-";
  }
  return "-";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: perfil } = await adminSupabase
    .from("usuarios")
    .select("id, nombre, email, rol, bloque_id, departamento_id")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: bloque } = await adminSupabase
    .from("bloques")
    .select("nombre, codigo")
    .eq("id", perfil.bloque_id)
    .maybeSingle();

  const { data: pago } = await adminSupabase
    .from("pagos")
    .select(
      `
      id,
      bloque_id,
      departamento_id,
      cuota_id,
      monto_pagado,
      fecha_pago,
      metodo_pago,
      referencia,
      observaciones,
      cuotas:cuota_id (
        periodo
      ),
      departamentos:departamento_id (
        numero
      )
    `
    )
    .eq("id", id)
    .eq("departamento_id", perfil.departamento_id)
    .single();

  if (!pago) {
    return NextResponse.redirect(new URL("/vecino", req.url), 303);
  }

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
    ? await adminSupabase
        .from("usuarios")
        .select("nombre, email")
        .eq("id", confirmacion.revisado_por)
        .maybeSingle()
    : { data: null };

  const pdf = buildReceiptPdf({
    receiptNumber: pago.id.slice(0, 8).toUpperCase(),
    vecinoName: perfil.nombre || "Vecino",
    bloqueName: bloque?.nombre || "Bloque",
    bloqueCode: bloque?.codigo || perfil.bloque_id || "-",
    departamentoLabel: String(pickDepartamentoNumero(pago.departamentos)),
    periodoLabel: String(pickCuotaPeriodo(pago.cuotas)),
    montoLabel: money(pago.monto_pagado),
    fechaLabel: formatDate(pago.fecha_pago),
    referenciaLabel: pago.referencia || "Sin referencia",
    metodoLabel: pago.metodo_pago || "transferencia",
    observacionesLabel: pago.observaciones || "Pago aprobado desde confirmaciones",
    aprobadoPorLabel: aprobador?.nombre || "Administracion del bloque",
    adminEmailLabel: aprobador?.email || "No registrado",
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
