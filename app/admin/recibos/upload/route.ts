import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const formData = await req.formData();

  const vecino_id = String(formData.get("vecino_id"));
  const titulo = String(formData.get("titulo"));
  const monto = Number(formData.get("monto"));
  const estado = String(formData.get("estado"));
  const archivo = formData.get("archivo") as File;

  if (!archivo) {
    return NextResponse.redirect(new URL("/admin/recibos", req.url));
  }

  const bytes = await archivo.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const fileName = `${Date.now()}-${archivo.name}`;

  const { error: uploadError } = await supabase.storage
    .from("recibos")
    .upload(fileName, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.redirect(new URL("/admin/recibos", req.url));
  }

  const { data } = supabase.storage
    .from("recibos")
    .getPublicUrl(fileName);

  await supabase.from("recibos").insert({
    vecino_id,
    titulo,
    monto,
    estado,
    archivo_url: data.publicUrl,
  });

  return NextResponse.redirect(new URL("/admin/recibos", req.url));
}