import { requireAdmin, requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAdminPaymentDetails } from "@/lib/admin-payment";
import { createComprobantesSignedUrl, resolveStoragePath } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function noStoreResponse(body: string, status: number) {
  return new Response(body, { status, headers: NO_STORE_HEADERS });
}

function noStoreRedirect(url: string | URL) {
  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      Location: String(url),
    },
  });
}
function isPublicHttpUrl(value: string | null | undefined) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export async function GET(req: Request) {
  const adminUsuario = await requireAdmin();
  const vecinoUsuario = adminUsuario ? null : await requireVecino();
  const usuario = adminUsuario ?? vecinoUsuario;
  if (!usuario) return noStoreResponse("No autorizado.", 401);

  const url = new URL(req.url);
  const requestedBloqueId = url.searchParams.get("bloque_id");
  const isSuperadmin = usuario.perfil.rol === "superadmin";
  const bloqueId = isSuperadmin && requestedBloqueId ? requestedBloqueId : usuario.perfil.bloque_id;
  if (!bloqueId) return noStoreResponse("QR no disponible.", 404);

  const supabase = createAdminClient();
  const { data: bloque, error } = await supabase
    .from("bloques")
    .select("id, pago_qr_path")
    .eq("id", bloqueId)
    .maybeSingle();

  let bloqueRow = bloque as { pago_qr_path?: string | null } | null;

  if (error && String(error.message || "").includes("pago_qr_path")) {
    bloqueRow = null;
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
    paymentDetails.qrUrl
  );

  if (path) {
    const signedUrl = await createComprobantesSignedUrl(path);
    if (!signedUrl) return noStoreResponse("Archivo no disponible.", 404);
    return noStoreRedirect(signedUrl);
  }

  const legacyUrl = paymentDetails.qrUrl;
  if (isPublicHttpUrl(legacyUrl)) return noStoreRedirect(String(legacyUrl));

  return noStoreRedirect(new URL("/qr-pago-admin.png", req.url));
}
