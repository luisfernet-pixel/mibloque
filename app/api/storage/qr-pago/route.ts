import { requireAdmin, requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAdminPaymentDetails } from "@/lib/admin-payment";
import { redirectToComprobantesSignedUrl, resolveStoragePath } from "@/lib/storage-paths";

function isPublicHttpUrl(value: string | null | undefined) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export async function GET(req: Request) {
  const adminUsuario = await requireAdmin();
  const vecinoUsuario = adminUsuario ? null : await requireVecino();
  const usuario = adminUsuario ?? vecinoUsuario;
  if (!usuario) return new Response("No autorizado.", { status: 401 });

  const url = new URL(req.url);
  const requestedBloqueId = url.searchParams.get("bloque_id");
  const isSuperadmin = usuario.perfil.rol === "superadmin";
  const bloqueId = isSuperadmin && requestedBloqueId ? requestedBloqueId : usuario.perfil.bloque_id;
  if (!bloqueId) return new Response("QR no disponible.", { status: 404 });

  const supabase = createAdminClient();
  const { data: bloque, error } = await supabase
    .from("bloques")
    .select("id, pago_qr_path, pago_qr_url")
    .eq("id", bloqueId)
    .maybeSingle();

  let bloqueRow = bloque as { pago_qr_path?: string | null; pago_qr_url?: string | null } | null;

  if (error && String(error.message || "").includes("pago_qr_path")) {
    const fallback = await supabase
      .from("bloques")
      .select("id, pago_qr_url")
      .eq("id", bloqueId)
      .maybeSingle();
    bloqueRow = fallback.data as { pago_qr_url?: string | null } | null;
  }

  const { data: adminPerfil } = await supabase
    .from("usuarios")
    .select("username")
    .eq("rol", "admin")
    .eq("bloque_id", bloqueId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const paymentDetails = parseAdminPaymentDetails(adminPerfil?.username);
  const path = resolveStoragePath(
    bloqueRow?.pago_qr_path || paymentDetails.qrPath,
    bloqueRow?.pago_qr_url || paymentDetails.qrUrl
  );

  if (path) return redirectToComprobantesSignedUrl(path);

  const legacyUrl = bloqueRow?.pago_qr_url || paymentDetails.qrUrl;
  if (isPublicHttpUrl(legacyUrl)) return Response.redirect(String(legacyUrl), 302);

  return Response.redirect(new URL("/qr-pago-admin.png", req.url), 302);
}
