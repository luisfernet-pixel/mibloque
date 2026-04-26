import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

function buildReceiptNumber(prefix: string, seq: number) {
  const safePrefix = String(prefix || "BLK")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "BLK";
  return `${safePrefix}-${String(seq).padStart(4, "0")}`;
}

async function getNextReceiptNumber(
  supabase: ReturnType<typeof createAdminClient>,
  bloqueId: string
) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: bloque } = await supabase
      .from("bloques")
      .select("id, codigo, recibo_consecutivo")
      .eq("id", bloqueId)
      .single();

    if (!bloque) return null;

    const seq = Number(bloque.recibo_consecutivo || 1);
    const nextSeq = seq + 1;

    const { data: updated } = await supabase
      .from("bloques")
      .update({ recibo_consecutivo: nextSeq })
      .eq("id", bloqueId)
      .eq("recibo_consecutivo", seq)
      .select("id")
      .maybeSingle();

    if (updated) {
      return buildReceiptNumber(String(bloque.codigo || "BLK"), seq);
    }
  }

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const usuario = await requireAdmin();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const supabase = createAdminClient();

  const { data: confirmacion } = await supabase
    .from("confirmaciones_pago")
    .select(`
      id,
      bloque_id,
      departamento_id,
      cuota_id,
      monto_reportado,
      referencia,
      comprobante_url,
      estado
    `)
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .single();

  if (!confirmacion) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  if (confirmacion.estado === "aprobado") {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const ahora = new Date().toISOString();

  const { error: updateConfirmacionError } = await supabase
    .from("confirmaciones_pago")
    .update({
      estado: "aprobado",
      revisado_at: ahora,
      revisado_por: usuario.perfil.id,
    })
    .eq("id", id);

  if (updateConfirmacionError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const numeroRecibo = await getNextReceiptNumber(supabase, confirmacion.bloque_id);
  if (!numeroRecibo) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const { error: insertPagoError } = await supabase
    .from("pagos")
    .insert({
      bloque_id: confirmacion.bloque_id,
      departamento_id: confirmacion.departamento_id,
      cuota_id: confirmacion.cuota_id,
      monto_pagado: confirmacion.monto_reportado,
      fecha_pago: ahora,
      metodo_pago: "transferencia",
      referencia: confirmacion.referencia,
      comprobante_url: confirmacion.comprobante_url,
      numero_recibo: numeroRecibo,
      observaciones: "Pago aprobado desde confirmaciones",
    });

  if (insertPagoError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  revalidatePath("/admin/confirmaciones");
  revalidatePath("/admin");
  revalidatePath("/vecino");
  revalidatePath("/vecino/recibos");

  const { error: updateCuotaError } = await supabase
    .from("cuotas")
    .update({
      estado: "pagado",
      pagada_en: ahora,
      updated_at: ahora,
    })
    .eq("id", confirmacion.cuota_id);

  if (updateCuotaError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
}
