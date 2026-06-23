import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getAuthUserSafe(supabase?: SupabaseServerClient) {
  const client = supabase ?? (await createClient());

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error) {
      return null;
    }

    return user ?? null;
  } catch {
    return null;
  }
}

export async function getUsuarioActual() {
  const supabase = await createClient();
  const user = await getAuthUserSafe(supabase);

  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, bloque_id, departamento_id, email, username, activo")
    .eq("id", user.id)
    .single();

  if (error || !perfil || !perfil.activo) return null;

  return {
    authUser: user,
    perfil,
  };
}

export async function requireAdmin() {
  const usuario = await getUsuarioActual();

  if (!usuario) return null;

  if (
    usuario.perfil.rol === "admin" ||
    usuario.perfil.rol === "superadmin"
  ) {
    return usuario;
  }

  return null;
}

export async function requireBlockAdmin() {
  const usuario = await getUsuarioActual();

  if (!usuario) return null;

  if (usuario.perfil.rol === "admin") {
    return usuario;
  }

  return null;
}

export async function requireVecino() {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (usuario.perfil.rol === "vecino") {
    return usuario;
  }

  return null;
}

export async function isBloqueActivo(
  bloqueId: string | null | undefined,
  supabase?: SupabaseServerClient
) {
  if (!bloqueId) return false;
  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("bloques")
    .select("activo")
    .eq("id", bloqueId)
    .maybeSingle();

  if (error) return false;
  return data?.activo !== false;
}
