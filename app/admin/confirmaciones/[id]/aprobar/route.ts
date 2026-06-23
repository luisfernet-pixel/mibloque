import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBlockAdmin } from "@/lib/auth";
import { resolveStoragePath } from "@/lib/storage-paths";

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
  const usuario = await requireBlockAdmin();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const supabase = createAdminClient();

  const { data: bloqueEstado } = await supabase
    .from("bloques")
    .select("activo")
    .eq("id", usuario.perfil.bloque_id)
    .maybeSingle();

  if (bloqueEstado?.activo === false) {
    return NextResponse.redirect(new URL("/admin/confirmaciones?error=servicio_suspendido", req.url), 303);
  }

  const { data: confirmacion, error: confirmacionError } = await supabase
    .from("confirmaciones_pago")
    .select(`
      id,
      bloque_id,
      departamento_id,
      cuota_id,
      monto_reportado,
      referencia,
      comprobante_path,
      comprobante_url,
      estado
    `)
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .single();

  let confirmacionRow = confirmacion;
  if (confirmacionError && String(confirmacionError.message || "").includes("comprobante_path")) {
    const fallback = await supabase
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
    confirmacionRow = fallback.data as typeof confirmacion;
  }

  if (!confirmacionRow) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  if (confirmacionRow.estado === "aprobado") {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const { data: cuotaRelacionada } = await supabase
    .from("cuotas")
    .select("id")
    .eq("id", confirmacionRow.cuota_id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("departamento_id", confirmacionRow.departamento_id)
    .maybeSingle();

  if (!cuotaRelacionada) {
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
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  if (updateConfirmacionError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const numeroRecibo = await getNextReceiptNumber(supabase, confirmacionRow.bloque_id);
  if (!numeroRecibo) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const pagoPayload = {
      bloque_id: confirmacionRow.bloque_id,
      departamento_id: confirmacionRow.departamento_id,
      cuota_id: confirmacionRow.cuota_id,
      monto_pagado: confirmacionRow.monto_reportado,
      fecha_pago: ahora,
      metodo_pago: "transferencia",
      referencia: confirmacionRow.referencia,
      comprobante_path: resolveStoragePath((confirmacionRow as { comprobante_path?: string | null }).comprobante_path, confirmacionRow.comprobante_url),
      comprobante_url: confirmacionRow.comprobante_url,
      numero_recibo: numeroRecibo,
      observaciones: "Pago aprobado desde confirmaciones",
    };

  const { error: insertPagoError } = await supabase
    .from("pagos")
    .insert(pagoPayload);

  if (insertPagoError) {
    if (String(insertPagoError.message || "").includes("comprobante_path")) {
      const fallbackPagoPayload = { ...pagoPayload };
      delete (fallbackPagoPayload as { comprobante_path?: unknown }).comprobante_path;
      const { error: fallbackPagoError } = await supabase
        .from("pagos")
        .insert(fallbackPagoPayload);

      if (fallbackPagoError) {
        return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
      }
    } else {
      return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
    }
  }
  revalidatePath("/admin/confirmaciones");
  revalidatePath("/admin");
  revalidatePath("/vecino");
  revalidatePath("/vecino/recibos");

  const { error: updateCuotaError } = await supabase
    .from("cuotas")
    .update({
      estado: "pagado",
      monto_total: confirmacionRow.monto_reportado,
      pagada_en: ahora,
      updated_at: ahora,
    })
    .eq("id", confirmacionRow.cuota_id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("departamento_id", confirmacionRow.departamento_id);

  if (updateCuotaError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
}
