import { createClient } from "@/lib/supabase/server";

export async function getUsuarioActual() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export async function requireVecino() {
  const usuario = await getUsuarioActual();

  if (!usuario) return null;

  if (usuario.perfil.rol === "vecino") {
    return usuario;
  }

  return null;
}