import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const referencia = String(formData.get("referencia") || "");
  const monto = Number(formData.get("monto") || 0);
  const archivo = formData.get("archivo") as File | null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !archivo || !monto) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url), 303);
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, bloque_id, departamento_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: cuota } = await supabase
    .from("cuotas")
    .select("id, estado, anio, mes")
    .eq("departamento_id", perfil.departamento_id)
    .in("estado", ["pendiente", "vencido"])
    .order("anio", { ascending: true })
    .order("mes", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!cuota) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url), 303);
  }

  const bytes = await archivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${perfil.departamento_id}/${Date.now()}-${archivo.name}`;

  const { error: uploadError } = await supabase.storage
    .from("comprobantes")
    .upload(fileName, buffer, {
      contentType: archivo.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url), 303);
  }

  const { data: publicFile } = supabase.storage
    .from("comprobantes")
    .getPublicUrl(fileName);

  const { error: insertError } = await supabase
    .from("confirmaciones_pago")
    .insert({
      bloque_id: perfil.bloque_id,
      departamento_id: perfil.departamento_id,
      cuota_id: cuota.id,
      monto_reportado: monto,
      referencia,
      comprobante_url: publicFile.publicUrl,
      estado: "pendiente",
    });

  if (insertError) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url), 303);
  }

  return NextResponse.redirect(new URL("/vecino", req.url), 303);
}