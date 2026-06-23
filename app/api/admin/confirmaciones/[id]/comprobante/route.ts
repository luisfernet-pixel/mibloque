import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirectToComprobantesSignedUrl } from "@/lib/storage-paths";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireAdmin();
  if (!usuario) return new Response("No autorizado.", { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const isSuperadmin = usuario.perfil.rol === "superadmin";

  let query = supabase
    .from("confirmaciones_pago")
    .select("id, bloque_id, comprobante_path")
    .eq("id", id);

  if (!isSuperadmin) query = query.eq("bloque_id", usuario.perfil.bloque_id);

  const { data } = await query.maybeSingle();
  const row = data as { comprobante_path?: string | null } | null;

  if (!row?.comprobante_path) return new Response("Archivo no disponible.", { status: 404 });
  return redirectToComprobantesSignedUrl(row.comprobante_path);
}
