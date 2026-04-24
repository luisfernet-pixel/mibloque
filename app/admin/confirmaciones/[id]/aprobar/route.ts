import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

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
