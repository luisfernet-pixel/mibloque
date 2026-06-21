import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirectToComprobantesSignedUrl, resolveStoragePath } from "@/lib/storage-paths";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireAdmin();
  if (!usuario) return new Response("No autorizado.", { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const isSuperadmin = usuario.perfil.rol === "superadmin";

  let query = supabase
    .from("pagos")
    .select("id, bloque_id, comprobante_path, comprobante_url")
    .eq("id", id);

  if (!isSuperadmin) query = query.eq("bloque_id", usuario.perfil.bloque_id);

  const { data, error } = await query.maybeSingle();
  let row = data as { comprobante_path?: string | null; comprobante_url?: string | null } | null;

  if (error && String(error.message || "").includes("comprobante_path")) {
    let fallbackQuery = supabase
      .from("pagos")
      .select("id, bloque_id, comprobante_url")
      .eq("id", id);
    if (!isSuperadmin) fallbackQuery = fallbackQuery.eq("bloque_id", usuario.perfil.bloque_id);
    const fallback = await fallbackQuery.maybeSingle();
    row = fallback.data as { comprobante_url?: string | null } | null;
  }

  const path = resolveStoragePath(row?.comprobante_path, row?.comprobante_url);
  if (!path) return new Response("Archivo no disponible.", { status: 404 });
  return redirectToComprobantesSignedUrl(path);
}
