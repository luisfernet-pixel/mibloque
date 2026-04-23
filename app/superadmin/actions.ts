"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  ok: boolean;
  message: string;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

async function requireSuperadmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Debes iniciar sesión.");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "superadmin") {
    throw new Error("No tienes permisos para hacer esto.");
  }
}

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function deleteAuthUserIfNeeded(userId?: string) {
  if (!userId) return;

  try {
    const supabase = createAdminClient();
    await supabase.auth.admin.deleteUser(userId);
  } catch {
    // Intencionalmente silencioso: si el rollback falla, no bloqueamos el flujo.
  }
}

export async function createBlockAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const nombre = safeString(formData.get("nombre"));
    const codigo = safeString(formData.get("codigo")).toUpperCase();

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del bloque." };
    }

    if (!codigo) {
      return { ok: false, message: "Escribe el código del bloque." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("bloques").insert({
      nombre,
      codigo,
      activo: true,
    });

    if (error) {
      throw error;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/bloques");
    return { ok: true, message: `Bloque ${nombre} creado.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo crear el bloque.",
    };
  }
}

export async function updateBlockAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    const nombre = safeString(formData.get("nombre"));
    const codigo = safeString(formData.get("codigo")).toUpperCase();
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el bloque a editar." };
    }

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del bloque." };
    }

    if (!codigo) {
      return { ok: false, message: "Escribe el código del bloque." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("bloques")
      .update({
        nombre,
        codigo,
        activo,
      })
      .eq("id", id);

    if (error) {
      throw error;
    }

    revalidatePath("/superadmin/bloques");
    revalidatePath("/superadmin");
    return { ok: true, message: `Bloque ${nombre} actualizado.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo actualizar el bloque.",
    };
  }
}

export async function deleteBlockAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    if (!id) {
      return { ok: false, message: "Falta el bloque a eliminar." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("bloques")
      .update({ activo: false })
      .eq("id", id);

    if (error) {
      throw error;
    }

    revalidatePath("/superadmin/bloques");
    revalidatePath("/superadmin");
    return { ok: true, message: "Bloque desactivado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo eliminar el bloque.",
    };
  }
}

export async function deleteBlockActionForm(formData: FormData) {
  await deleteBlockAction(initialState, formData);
}

export async function createAdminAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  let createdUserId: string | undefined;

  try {
    await requireSuperadmin();

    const nombre = safeString(formData.get("nombre"));
    const email = safeString(formData.get("email")).toLowerCase();
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del admin." };
    }

    if (!email) {
      return { ok: false, message: "Escribe el email del admin." };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres.",
      };
    }

    if (!bloqueId) {
      return { ok: false, message: "Selecciona un bloque." };
    }

    const supabase = createAdminClient();
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        rol: "admin",
        bloque_id: bloqueId,
      },
    });

    if (authError || !data.user) {
      throw authError ?? new Error("No se pudo crear el usuario de Auth.");
    }

    createdUserId = data.user.id;

    const { error: perfilError } = await supabase.from("usuarios").insert({
      id: data.user.id,
      nombre,
      email,
      rol: "admin",
      bloque_id: bloqueId,
      departamento_id: null,
      username: null,
      activo: true,
    });

    if (perfilError) {
      throw perfilError;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/admins");
    return { ok: true, message: `Admin ${nombre} creado.` };
  } catch (error) {
    await deleteAuthUserIfNeeded(createdUserId);
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo crear el admin.",
    };
  }
}

export async function updateAdminAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    const nombre = safeString(formData.get("nombre"));
    const email = safeString(formData.get("email")).toLowerCase();
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el admin a editar." };
    }

    if (!nombre || !email || !bloqueId) {
      return { ok: false, message: "Completa nombre, email y bloque." };
    }

    const supabase = createAdminClient();
    const updatePayload: Record<string, unknown> = {
      nombre,
      email,
      rol: "admin",
      bloque_id: bloqueId,
      departamento_id: null,
      username: null,
      activo,
    };

    const { error } = await supabase.from("usuarios").update(updatePayload).eq("id", id);
    if (error) {
      throw error;
    }

    if (password) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email,
        password,
        user_metadata: {
          nombre,
          rol: "admin",
          bloque_id: bloqueId,
        },
      });

      if (authError) {
        throw authError;
      }
    } else {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email,
        user_metadata: {
          nombre,
          rol: "admin",
          bloque_id: bloqueId,
        },
      });

      if (authError) {
        throw authError;
      }
    }

    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin");
    return { ok: true, message: `Admin ${nombre} actualizado.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo actualizar el admin.",
    };
  }
}

export async function deleteAdminAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    if (!id) {
      return { ok: false, message: "Falta el admin a eliminar." };
    }

    const supabase = createAdminClient();
    const { error: perfilError } = await supabase
      .from("usuarios")
      .update({ activo: false })
      .eq("id", id);

    if (perfilError) {
      throw perfilError;
    }

    await deleteAuthUserIfNeeded(id);

    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin");
    return { ok: true, message: "Admin desactivado y acceso retirado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo eliminar el admin.",
    };
  }
}

export async function deleteAdminActionForm(formData: FormData) {
  await deleteAdminAction(initialState, formData);
}

export async function createVecinoAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  let createdUserId: string | undefined;

  try {
    await requireSuperadmin();

    const nombre = safeString(formData.get("nombre"));
    const username = safeString(formData.get("username")).toLowerCase();
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const departamentoId = safeString(formData.get("departamento_id"));

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del vecino." };
    }

    if (!username) {
      return { ok: false, message: "Escribe el usuario del vecino." };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres.",
      };
    }

    if (!bloqueId) {
      return { ok: false, message: "Selecciona un bloque." };
    }

    if (!departamentoId) {
      return { ok: false, message: "Selecciona un departamento." };
    }

    const email = `${username}@mibloque.local`;
    const supabase = createAdminClient();
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        rol: "vecino",
        bloque_id: bloqueId,
        departamento_id: departamentoId,
        username,
      },
    });

    if (authError || !data.user) {
      throw authError ?? new Error("No se pudo crear el usuario de Auth.");
    }

    createdUserId = data.user.id;

    const { error: perfilError } = await supabase.from("usuarios").insert({
      id: data.user.id,
      nombre,
      email,
      username,
      rol: "vecino",
      bloque_id: bloqueId,
      departamento_id: departamentoId,
      activo: true,
    });

    if (perfilError) {
      throw perfilError;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/vecinos");
    return {
      ok: true,
      message: `Vecino ${nombre} creado con usuario ${username}.`,
    };
  } catch (error) {
    await deleteAuthUserIfNeeded(createdUserId);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo crear el vecino.",
    };
  }
}

export async function updateVecinoAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    const nombre = safeString(formData.get("nombre"));
    const username = safeString(formData.get("username")).toLowerCase();
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const departamentoId = safeString(formData.get("departamento_id"));
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el vecino a editar." };
    }

    if (!nombre || !username || !bloqueId || !departamentoId) {
      return {
        ok: false,
        message: "Completa nombre, usuario, bloque y departamento.",
      };
    }

    const email = `${username}@mibloque.local`;
    const supabase = createAdminClient();
    const { error } = await supabase.from("usuarios").update({
      nombre,
      email,
      username,
      rol: "vecino",
      bloque_id: bloqueId,
      departamento_id: departamentoId,
      activo,
    }).eq("id", id);

    if (error) {
      throw error;
    }

    const authPayload: {
      email: string;
      user_metadata: Record<string, unknown>;
      password?: string;
    } = {
      email,
      user_metadata: {
        nombre,
        rol: "vecino",
        bloque_id: bloqueId,
        departamento_id: departamentoId,
        username,
      },
    };

    if (password) {
      authPayload.password = password;
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(
      id,
      authPayload
    );

    if (authError) {
      throw authError;
    }

    revalidatePath("/superadmin/vecinos");
    revalidatePath("/superadmin");
    return { ok: true, message: `Vecino ${nombre} actualizado.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo actualizar el vecino.",
    };
  }
}

export async function deleteVecinoAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    if (!id) {
      return { ok: false, message: "Falta el vecino a eliminar." };
    }

    const supabase = createAdminClient();
    const { error: perfilError } = await supabase
      .from("usuarios")
      .update({ activo: false })
      .eq("id", id);

    if (perfilError) {
      throw perfilError;
    }

    await deleteAuthUserIfNeeded(id);

    revalidatePath("/superadmin/vecinos");
    revalidatePath("/superadmin");
    return { ok: true, message: "Vecino desactivado y acceso retirado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el vecino.",
    };
  }
}

export async function deleteVecinoActionForm(formData: FormData) {
  await deleteVecinoAction(initialState, formData);
}
