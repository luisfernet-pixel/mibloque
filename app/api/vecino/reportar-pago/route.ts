import { NextResponse } from "next/server";
import { extname } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const cuotaId = String(formData.get("cuota_id") || "");
  const referencia = String(formData.get("referencia") || "");
  const archivo = formData.get("archivo") as File | null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !archivo || !cuotaId || !referencia.trim()) {
    return NextResponse.redirect(new URL("/vecino?error=datos", req.url), 303);
  }

  const adminSupabase = createAdminClient();

  const { data: perfil } = await adminSupabase
    .from("usuarios")
    .select("id, bloque_id, departamento_id, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const [{ data: cuotasPendientes }, { data: confirmacionesPendientes }, { data: pagosExistentes }] =
    await Promise.all([
      adminSupabase
        .from("cuotas")
        .select("id, estado, departamento_id, monto_total, anio, mes")
        .eq("departamento_id", perfil.departamento_id)
        .in("estado", ["pendiente", "vencido"])
        .order("anio", { ascending: true })
        .order("mes", { ascending: true }),
      adminSupabase
        .from("confirmaciones_pago")
        .select("cuota_id")
        .eq("departamento_id", perfil.departamento_id)
        .eq("estado", "pendiente"),
      adminSupabase
        .from("pagos")
        .select("cuota_id")
        .eq("departamento_id", perfil.departamento_id),
    ]);

  const cuotasConConfirmacionPendiente = new Set(
    (confirmacionesPendientes ?? [])
      .map((item) => String(item.cuota_id || ""))
      .filter(Boolean)
  );

  const cuotasConPago = new Set(
    (pagosExistentes ?? [])
      .map((item) => String(item.cuota_id || ""))
      .filter(Boolean)
  );

  const cuotaMasAntiguaPendiente = (cuotasPendientes ?? []).find((item) => {
    const cuotaIdActual = String(item.id || "");
    if (!cuotaIdActual) return false;
    if (cuotasConConfirmacionPendiente.has(cuotaIdActual)) return false;
    if (cuotasConPago.has(cuotaIdActual)) return false;
    return true;
  });

  if (!cuotaMasAntiguaPendiente) {
    return NextResponse.redirect(new URL("/vecino?error=cuota", req.url), 303);
  }

  if (cuotaMasAntiguaPendiente.id !== cuotaId) {
    return NextResponse.redirect(new URL("/vecino?error=orden", req.url), 303);
  }

  const { data: cuota } = await adminSupabase
    .from("cuotas")
    .select("id, estado, departamento_id, monto_total")
    .eq("id", cuotaId)
    .eq("departamento_id", perfil.departamento_id)
    .maybeSingle();

  if (!cuota || !["pendiente", "vencido"].includes(String(cuota.estado || "").toLowerCase())) {
    return NextResponse.redirect(new URL("/vecino?error=cuota", req.url), 303);
  }

  const { data: confirmacionPendiente } = await adminSupabase
    .from("confirmaciones_pago")
    .select("id")
    .eq("departamento_id", perfil.departamento_id)
    .eq("cuota_id", cuotaId)
    .eq("estado", "pendiente")
    .limit(1)
    .maybeSingle();

  if (confirmacionPendiente) {
    return NextResponse.redirect(new URL("/vecino?error=enrevision", req.url), 303);
  }

  const { data: pagoAprobado } = await adminSupabase
    .from("pagos")
    .select("id")
    .eq("departamento_id", perfil.departamento_id)
    .eq("cuota_id", cuotaId)
    .limit(1)
    .maybeSingle();

  if (pagoAprobado) {
    return NextResponse.redirect(new URL("/vecino?error=cuota", req.url), 303);
  }

  const bytes = await archivo.arrayBuffer();
  const buffer = new Uint8Array(bytes);
  const extension = extname(archivo.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
  const safeName = `${Date.now()}-${crypto.randomUUID()}${extension || ""}`;
  const fileName = `${perfil.departamento_id}/${safeName}`;

  const { error: uploadError } = await adminSupabase.storage
    .from("comprobantes")
    .upload(fileName, buffer, {
      contentType: archivo.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.redirect(
      new URL(
        `/vecino?error=upload&detalle=${encodeURIComponent(
          uploadError.message || "unknown"
        )}`,
        req.url
      ),
      303
    );
  }

  const { data: publicFile } = adminSupabase.storage
    .from("comprobantes")
    .getPublicUrl(fileName);

  const { error: insertError } = await adminSupabase
    .from("confirmaciones_pago")
    .insert({
      bloque_id: perfil.bloque_id,
      departamento_id: perfil.departamento_id,
      cuota_id: cuota.id,
      monto_reportado: Number(cuota.monto_total || 0),
      referencia,
      comprobante_url: publicFile.publicUrl,
      estado: "pendiente",
    });

  if (insertError) {
    return NextResponse.redirect(
      new URL("/vecino?error=confirmacion", req.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/vecino?sent=1", req.url), 303);
}
