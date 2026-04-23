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

  if (!user || !archivo) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url));
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, bloque_id, departamento_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: vecino } = await supabase
    .from("vecinos")
    .select("id")
    .eq("departamento_id", perfil.departamento_id)
    .maybeSingle();

  if (!vecino) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url));
  }

  const bytes = await archivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${vecino.id}/${Date.now()}-${archivo.name}`;

  const { error: uploadError } = await supabase.storage
    .from("comprobantes")
    .upload(fileName, buffer, {
      contentType: archivo.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.redirect(new URL("/vecino/reportar-pago", req.url));
  }

  const { data: publicFile } = supabase.storage
    .from("comprobantes")
    .getPublicUrl(fileName);

  await supabase.from("comprobantes_pago").insert({
    vecino_id: vecino.id,
    bloque_id: perfil.bloque_id,
    referencia,
    monto,
    archivo_url: publicFile.publicUrl,
    estado: "pendiente",
  });

  return NextResponse.redirect(new URL("/vecino", req.url));
}