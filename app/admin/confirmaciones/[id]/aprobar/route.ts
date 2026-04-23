import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: admin } = await supabase
    .from("usuarios")
    .select("id, rol")
    .eq("id", user.id)
    .single();

  if (!admin || admin.rol !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

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
      revisado_por: admin.id,
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