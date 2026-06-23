import { NextResponse } from "next/server";
import { extname } from "node:path";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserSafe } from "@/lib/auth";
import { getCuotaMontoVigente } from "@/lib/cuotas";

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const cuotaId = String(formData.get("cuota_id") || "");
  const referencia = String(formData.get("referencia") || "");
  const archivo = formData.get("archivo") as File | null;

  const user = await getAuthUserSafe(supabase);

  if (!user || !archivo || !cuotaId) {
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

  const { data: bloque } = await adminSupabase
    .from("bloques")
    .select("activo")
    .eq("id", perfil.bloque_id)
    .maybeSingle();

  if (bloque?.activo === false) {
    return NextResponse.redirect(new URL("/vecino?error=servicio_suspendido", req.url), 303);
  }

  const [{ data: cuotasPendientes }, { data: confirmacionesPendientes }, { data: pagosExistentes }] =
    await Promise.all([
      adminSupabase
        .from("cuotas")
        .select("id, estado, departamento_id, monto_total, monto_base, mora_acumulada, anio, mes, periodo, fecha_vencimiento, created_at")
        .eq("departamento_id", perfil.departamento_id)
        .eq("bloque_id", perfil.bloque_id)
        .in("estado", ["pendiente", "vencido"])
        .order("anio", { ascending: true })
        .order("mes", { ascending: true }),
      adminSupabase
        .from("confirmaciones_pago")
        .select("cuota_id")
        .eq("departamento_id", perfil.departamento_id)
        .eq("bloque_id", perfil.bloque_id)
        .eq("estado", "pendiente"),
      adminSupabase
        .from("pagos")
        .select("cuota_id")
        .eq("departamento_id", perfil.departamento_id)
        .eq("bloque_id", perfil.bloque_id),
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
    .select("id, estado, departamento_id, monto_total, monto_base, mora_acumulada, anio, mes, periodo, fecha_vencimiento, created_at")
    .eq("id", cuotaId)
    .eq("departamento_id", perfil.departamento_id)
    .eq("bloque_id", perfil.bloque_id)
    .maybeSingle();

  const { data: config } = await adminSupabase
    .from("configuracion_bloque")
    .select("dia_vencimiento, valor_mora")
    .eq("bloque_id", perfil.bloque_id)
    .maybeSingle();

  if (!cuota || !["pendiente", "vencido"].includes(String(cuota.estado || "").toLowerCase())) {
    return NextResponse.redirect(new URL("/vecino?error=cuota", req.url), 303);
  }

  const { data: confirmacionPendiente } = await adminSupabase
    .from("confirmaciones_pago")
    .select("id")
    .eq("departamento_id", perfil.departamento_id)
    .eq("bloque_id", perfil.bloque_id)
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
    .eq("bloque_id", perfil.bloque_id)
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

  const { error: insertError } = await adminSupabase
    .from("confirmaciones_pago")
    .insert({
      bloque_id: perfil.bloque_id,
      departamento_id: perfil.departamento_id,
      cuota_id: cuota.id,
      monto_reportado: getCuotaMontoVigente(cuota, config),
      referencia: referencia || null,
      comprobante_path: fileName,
      estado: "pendiente",
    });

  if (insertError) {
    return NextResponse.redirect(
      new URL("/vecino?error=confirmacion", req.url),
      303
    );
  }

  revalidatePath("/vecino");

  const res = NextResponse.redirect(
    new URL(`/vecino?sent=1&t=${Date.now()}#subir-comprobante`, req.url),
    303
  );
  res.cookies.set("vecino_comprobante_sent", "1", {
    maxAge: 120,
    path: "/vecino",
    sameSite: "lax",
  });
  return res;
}
