import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBlockAdmin } from "@/lib/auth";

function buildReceiptNumber(prefix: string, seq: number) {
  const safePrefix = String(prefix || "BLK")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "BLK";
  return `${safePrefix}-${String(seq).padStart(4, "0")}`;
}

function redirectToConfirmaciones(req: Request, suffix = "") {
  return NextResponse.redirect(new URL(`/admin/confirmaciones${suffix}`, req.url), 303);
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
  const bloqueId = usuario.perfil.bloque_id;

  const { data: bloqueEstado } = await supabase
    .from("bloques")
    .select("activo")
    .eq("id", bloqueId)
    .maybeSingle();

  if (bloqueEstado?.activo === false) {
    return redirectToConfirmaciones(req, "?error=servicio_suspendido");
  }

  const { data: confirmacion } = await supabase
    .from("confirmaciones_pago")
    .select(
      `
      id,
      bloque_id,
      departamento_id,
      cuota_id,
      monto_reportado,
      referencia,
      comprobante_path,
      estado
    `
    )
    .eq("id", id)
    .eq("bloque_id", bloqueId)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (!confirmacion) {
    return redirectToConfirmaciones(req);
  }

  const { data: cuotaRelacionada } = await supabase
    .from("cuotas")
    .select("id, estado, periodo, anio, mes")
    .eq("id", confirmacion.cuota_id)
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", confirmacion.departamento_id)
    .in("estado", ["pendiente", "vencido"])
    .maybeSingle();

  if (!cuotaRelacionada) {
    return redirectToConfirmaciones(req);
  }

  const cuotaIdsMismoPeriodo = new Set<string>([String(cuotaRelacionada.id)]);
  const cuotaPeriodo = String(cuotaRelacionada.periodo || "").trim();

  if (cuotaPeriodo) {
    const { data: cuotasMismoPeriodo } = await supabase
      .from("cuotas")
      .select("id")
      .eq("bloque_id", bloqueId)
      .eq("departamento_id", confirmacion.departamento_id)
      .eq("periodo", cuotaPeriodo);

    for (const cuota of cuotasMismoPeriodo ?? []) {
      if (cuota.id) cuotaIdsMismoPeriodo.add(String(cuota.id));
    }
  } else if (cuotaRelacionada.anio && cuotaRelacionada.mes) {
    const { data: cuotasMismoPeriodo } = await supabase
      .from("cuotas")
      .select("id")
      .eq("bloque_id", bloqueId)
      .eq("departamento_id", confirmacion.departamento_id)
      .eq("anio", cuotaRelacionada.anio)
      .eq("mes", cuotaRelacionada.mes);

    for (const cuota of cuotasMismoPeriodo ?? []) {
      if (cuota.id) cuotaIdsMismoPeriodo.add(String(cuota.id));
    }
  }

  const cuotaIds = Array.from(cuotaIdsMismoPeriodo);

  const { data: pagoExistente } = await supabase
    .from("pagos")
    .select("id")
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", confirmacion.departamento_id)
    .in("cuota_id", cuotaIds)
    .limit(1)
    .maybeSingle();

  if (pagoExistente) {
    return redirectToConfirmaciones(req);
  }

  const ahora = new Date().toISOString();
  const numeroRecibo = await getNextReceiptNumber(supabase, confirmacion.bloque_id);

  if (!numeroRecibo) {
    return redirectToConfirmaciones(req);
  }

  const { data: confirmacionActualizada, error: updateConfirmacionError } = await supabase
    .from("confirmaciones_pago")
    .update({
      estado: "aprobado",
      revisado_at: ahora,
      revisado_por: usuario.perfil.id,
    })
    .eq("id", id)
    .eq("bloque_id", bloqueId)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();

  if (updateConfirmacionError || !confirmacionActualizada) {
    return redirectToConfirmaciones(req);
  }

  const rollbackConfirmacion = async () => {
    await supabase
      .from("confirmaciones_pago")
      .update({
        estado: "pendiente",
        revisado_at: null,
        revisado_por: null,
      })
      .eq("id", id)
      .eq("bloque_id", bloqueId)
      .eq("estado", "aprobado")
      .eq("revisado_at", ahora)
      .eq("revisado_por", usuario.perfil.id);
  };

  const { data: pagoDuplicadoPostBloqueo } = await supabase
    .from("pagos")
    .select("id")
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", confirmacion.departamento_id)
    .in("cuota_id", cuotaIds)
    .limit(1)
    .maybeSingle();

  if (pagoDuplicadoPostBloqueo) {
    await rollbackConfirmacion();
    return redirectToConfirmaciones(req);
  }

  const { data: pagoInsertado, error: insertPagoError } = await supabase
    .from("pagos")
    .insert({
      bloque_id: confirmacion.bloque_id,
      departamento_id: confirmacion.departamento_id,
      cuota_id: confirmacion.cuota_id,
      monto_pagado: confirmacion.monto_reportado,
      fecha_pago: ahora,
      metodo_pago: "transferencia",
      referencia: confirmacion.referencia,
      comprobante_path: confirmacion.comprobante_path,
      numero_recibo: numeroRecibo,
      observaciones: "Pago aprobado desde confirmaciones",
    })
    .select("id")
    .maybeSingle();

  if (insertPagoError || !pagoInsertado) {
    await rollbackConfirmacion();
    return redirectToConfirmaciones(req);
  }

  const { data: cuotaActualizada, error: updateCuotaError } = await supabase
    .from("cuotas")
    .update({
      estado: "pagado",
      monto_total: confirmacion.monto_reportado,
      pagada_en: ahora,
      updated_at: ahora,
    })
    .eq("id", confirmacion.cuota_id)
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", confirmacion.departamento_id)
    .in("estado", ["pendiente", "vencido"])
    .select("id")
    .maybeSingle();

  if (updateCuotaError || !cuotaActualizada) {
    await supabase
      .from("pagos")
      .delete()
      .eq("id", pagoInsertado.id)
      .eq("bloque_id", bloqueId)
      .eq("departamento_id", confirmacion.departamento_id)
      .eq("cuota_id", confirmacion.cuota_id);

    await rollbackConfirmacion();
    return redirectToConfirmaciones(req);
  }

  revalidatePath("/admin/confirmaciones");
  revalidatePath("/admin");
  revalidatePath("/vecino");
  revalidatePath("/vecino/recibos");

  return redirectToConfirmaciones(req);
}
