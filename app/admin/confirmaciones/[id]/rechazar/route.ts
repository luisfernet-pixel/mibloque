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
    .select(
      `
      id,
      bloque_id,
      departamento_id,
      cuota_id,
      estado
    `
    )
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .single();

  if (!confirmacion) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const estadoActual = String(confirmacion.estado || "").toLowerCase();
  if (estadoActual === "rechazado") {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const ahora = new Date().toISOString();

  const { error: updateConfirmacionError } = await supabase
    .from("confirmaciones_pago")
    .update({
      estado: "rechazado",
      revisado_at: ahora,
      revisado_por: usuario.perfil.id,
    })
    .eq("id", id);

  if (updateConfirmacionError) {
    return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
  }

  const { data: cuotaRelacionada } = await supabase
    .from("cuotas")
    .select("periodo")
    .eq("id", confirmacion.cuota_id)
    .maybeSingle();

  const periodo = String(cuotaRelacionada?.periodo || "sin periodo");

  await supabase.from("notificaciones_vecino").insert({
    bloque_id: confirmacion.bloque_id,
    departamento_id: confirmacion.departamento_id,
    tipo: "rechazo_pago",
    titulo: "Comprobante rechazado",
    mensaje: `Tu comprobante del periodo ${periodo} fue rechazado. Vuelve a intentarlo o comunicate con el administrador del bloque.`,
    metadata: {
      confirmacion_id: confirmacion.id,
      cuota_id: confirmacion.cuota_id,
      periodo,
    },
  });

  revalidatePath("/admin/confirmaciones");
  revalidatePath("/admin");
  revalidatePath("/vecino");
  revalidatePath("/vecino/avisos");

  return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
}
