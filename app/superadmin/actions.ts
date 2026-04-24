"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";

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
    throw new Error("Debes iniciar sesiÃ³n.");
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

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const maybeError = error as {
      message?: unknown;
      error_description?: unknown;
      code?: unknown;
    };

    const message = maybeError.message ?? maybeError.error_description;
    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (typeof maybeError.code === "string" && maybeError.code.trim()) {
      return `${fallback} (${maybeError.code})`;
    }
  }

  return fallback;
}

function normalizeDepartamentoNumero(value: string) {
  return String(value || "").trim().toUpperCase();
}

function extractBlockCode(code: string) {
  const digits = String(code || "").match(/\d+/g)?.join("");
  return digits || String(code || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function adminEmailFromBlockCode(code: string) {
  const suffix = extractBlockCode(code);
  return `admin${suffix || "bloque"}@${INTERNAL_EMAIL_DOMAIN}`;
}

function departmentCodeFromBlockAndNumber(blockCode: string, departmentNumber: string) {
  const block = extractBlockCode(blockCode);
  const number = normalizeDepartamentoNumero(departmentNumber).replace(/\s+/g, "");
  return `${block || "bloque"}-${number || "000"}`;
}

function departmentEmailFromCode(code: string) {
  return `${String(code || "").toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function findAuthUserIdByEmail(email: string) {
  const supabase = createAdminClient();
  const targetEmail = String(email || "").toLowerCase();
  let page = 1;

  while (page <= 100) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => String(user.email || "").toLowerCase() === targetEmail
    );

    if (match) {
      return match.id;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }

  return null;
}

async function createAuthUser({
  email,
  password,
  userMetadata,
}: {
  email: string;
  password: string;
  userMetadata: Record<string, unknown>;
}): Promise<{ userId: string; usedServiceRole: boolean }> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createAdminClient();

    const existingUserId = await findAuthUserIdByEmail(email);
    if (existingUserId) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUserId,
        {
          email,
          password,
          email_confirm: true,
          user_metadata: userMetadata,
        }
      );

      if (updateError) {
        throw updateError;
      }

      return { userId: existingUserId, usedServiceRole: true };
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth.");
    }

    return { userId: data.user.id, usedServiceRole: true };
  }

  throw new Error(
    "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno local. Necesaria para crear admins y departamentos sin disparar emails de confirmacion."
  );
}

async function resolveOrCreateDepartamentoId({
  supabase,
  bloqueId,
  departamentoId,
  departamentoNumero,
}: {
  supabase: ServerSupabaseClient;
  bloqueId: string;
  departamentoId?: string;
  departamentoNumero?: string;
}) {
  if (departamentoId) {
    const { data: existente, error } = await supabase
      .from("departamentos")
      .select("id, numero")
      .eq("id", departamentoId)
      .single();

    if (error || !existente) {
      throw error ?? new Error("No se encontrÃ³ el departamento seleccionado.");
    }

    return existente;
  }

  const numero = normalizeDepartamentoNumero(departamentoNumero || "");
  if (!numero) {
    throw new Error("Escribe el departamento.");
  }

  const { data: existente, error: searchError } = await supabase
    .from("departamentos")
    .select("id, numero")
    .eq("bloque_id", bloqueId)
    .eq("numero", numero)
    .maybeSingle();

  if (searchError) {
    throw searchError;
  }

  if (existente) {
    return existente;
  }

  const adminSupabase = createAdminClient();
  const { data: creado, error: insertError } = await adminSupabase
    .from("departamentos")
    .insert({
      bloque_id: bloqueId,
      numero,
      activo: true,
    })
    .select("id, numero")
    .single();

  if (insertError || !creado) {
    throw insertError ?? new Error("No se pudo crear el departamento.");
  }

  return creado;
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
      return { ok: false, message: "Escribe el cÃ³digo del bloque." };
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
      return { ok: false, message: "Escribe el cÃ³digo del bloque." };
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
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del admin." };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        message: "La contraseÃ±a debe tener al menos 6 caracteres.",
      };
    }

    if (!bloqueId) {
      return { ok: false, message: "Selecciona un bloque." };
    }

    const supabase = await createClient();
    const { data: bloque, error: bloqueError } = await supabase
      .from("bloques")
      .select("codigo")
      .eq("id", bloqueId)
      .single();

    if (bloqueError || !bloque) {
      throw bloqueError ?? new Error("No se encontrÃ³ el bloque seleccionado.");
    }

    const generatedEmail = adminEmailFromBlockCode(bloque.codigo);

    const authResult = await createAuthUser({
      email: generatedEmail,
      password,
      userMetadata: {
        nombre,
        rol: "admin",
        bloque_id: bloqueId,
      },
    });

    createdUserId = authResult.userId;

    const profileSupabase = authResult.usedServiceRole
      ? createAdminClient()
      : await createClient();

    const { error: perfilError } = await profileSupabase.from("usuarios").upsert({
      id: authResult.userId,
      nombre,
      email: generatedEmail,
      rol: "admin",
      bloque_id: bloqueId,
      departamento_id: null,
      username: null,
      activo: true,
    }, { onConflict: "id" });

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
      message: formatActionError(error, "No se pudo crear el admin."),
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

    const supabase = await createClient();
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

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminSupabase = createAdminClient();
      const authPayload: {
        email: string;
        user_metadata: Record<string, unknown>;
        password?: string;
      } = {
        email,
        user_metadata: {
          nombre,
          rol: "admin",
          bloque_id: bloqueId,
        },
      };

      if (password) {
        authPayload.password = password;
      }

      const { error: authError } = await adminSupabase.auth.admin.updateUserById(
        id,
        authPayload
      );

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
      message: formatActionError(error, "No se pudo actualizar el admin."),
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

    const supabase = await createClient();
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
      message: formatActionError(error, "No se pudo eliminar el admin."),
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
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const departamentoId = safeString(formData.get("departamento_id"));
    const departamentoNumero = safeString(formData.get("departamento_numero"));

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del departamento." };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        message: "La contraseÃ±a debe tener al menos 6 caracteres.",
      };
    }

    if (!bloqueId) {
      return { ok: false, message: "Selecciona un bloque." };
    }

    const supabase = await createClient();
    const { data: bloque, error: bloqueError } = await supabase
      .from("bloques")
      .select("codigo")
      .eq("id", bloqueId)
      .single();

    if (bloqueError || !bloque) {
      throw bloqueError ?? new Error("No se encontrÃ³ el bloque seleccionado.");
    }

    const departamento = await resolveOrCreateDepartamentoId({
      supabase,
      bloqueId,
      departamentoId,
      departamentoNumero,
    });

    const departmentCode = departmentCodeFromBlockAndNumber(
      bloque.codigo,
      departamento.numero
    );
    const email = departmentEmailFromCode(departmentCode);

    const authResult = await createAuthUser({
      email,
      password,
      userMetadata: {
        nombre,
        rol: "vecino",
        bloque_id: bloqueId,
        departamento_id: departamento.id,
        username: departmentCode,
      },
    });

    createdUserId = authResult.userId;

    const profileSupabase = authResult.usedServiceRole
      ? createAdminClient()
      : await createClient();

    const { error: perfilError } = await profileSupabase.from("usuarios").upsert({
      id: authResult.userId,
      nombre,
      email,
      username: departmentCode,
      rol: "vecino",
      bloque_id: bloqueId,
      departamento_id: departamento.id,
      activo: true,
    }, { onConflict: "id" });

    if (perfilError) {
      throw perfilError;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/vecinos");
    return {
      ok: true,
      message: `Departamento ${departamento.numero} creado.`,
    };
  } catch (error) {
    await deleteAuthUserIfNeeded(createdUserId);
    return {
      ok: false,
      message: formatActionError(
        error,
        "No se pudo crear el departamento."
      ),
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
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const departamentoId = safeString(formData.get("departamento_id"));
    const departamentoNumero = safeString(formData.get("departamento_numero"));
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el departamento a editar." };
    }

    if (!nombre || !bloqueId) {
      return {
        ok: false,
        message: "Completa nombre y bloque.",
      };
    }

    const supabase = await createClient();
    const { data: bloque, error: bloqueError } = await supabase
      .from("bloques")
      .select("codigo")
      .eq("id", bloqueId)
      .single();

    if (bloqueError || !bloque) {
      throw bloqueError ?? new Error("No se encontrÃ³ el bloque seleccionado.");
    }

    const departamento = await resolveOrCreateDepartamentoId({
      supabase,
      bloqueId,
      departamentoId,
      departamentoNumero,
    });

    const departmentCode = departmentCodeFromBlockAndNumber(
      bloque.codigo,
      departamento.numero
    );
    const email = departmentEmailFromCode(departmentCode);

    const { error } = await supabase.from("usuarios").update({
      nombre,
      email,
      username: departmentCode,
      rol: "vecino",
      bloque_id: bloqueId,
      departamento_id: departamento.id,
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
        departamento_id: departamento.id,
        username: departmentCode,
      },
    };

    if (password) {
      authPayload.password = password;
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminSupabase = createAdminClient();
      const { error: authError } = await adminSupabase.auth.admin.updateUserById(
        id,
        authPayload
      );

      if (authError) {
        throw authError;
      }
    }

    revalidatePath("/superadmin/vecinos");
    revalidatePath("/superadmin");
    return { ok: true, message: `Departamento ${departamento.numero} actualizado.` };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(
        error,
        "No se pudo actualizar el departamento."
      ),
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
      return { ok: false, message: "Falta el departamento a eliminar." };
    }

    const supabase = await createClient();
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
    return { ok: true, message: "Departamento desactivado y acceso retirado." };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(
        error,
        "No se pudo eliminar el departamento."
      ),
    };
  }
}

export async function deleteVecinoActionForm(formData: FormData) {
  await deleteVecinoAction(initialState, formData);
}


