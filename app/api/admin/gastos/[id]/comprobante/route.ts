import { requireBlockAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirectToComprobantesSignedUrl } from "@/lib/storage-paths";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireBlockAdmin();
  if (!usuario) return new Response("No autorizado.", { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("gastos")
    .select("id, bloque_id, comprobante_path")
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();
  const row = data as { comprobante_path?: string | null } | null;

  if (!row?.comprobante_path) return new Response("Archivo no disponible.", { status: 404 });
  return redirectToComprobantesSignedUrl(row.comprobante_path);
}
