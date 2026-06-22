"use server";

import { revalidatePath } from "next/cache";
import { extname } from "node:path";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";
import { getAuthUserSafe } from "@/lib/auth";
import { parseAdminPaymentDetails, serializeAdminPaymentDetails } from "@/lib/admin-payment";

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
  const user = await getAuthUserSafe(supabase);

  if (!user) {
    throw new Error("Debes iniciar sesion.");
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

function parseNumericInput(value: FormDataEntryValue | null, fallback = 0) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}
async function uploadAdminQrImage(file: File, bloqueId: string) {
  const adminSupabase = createAdminClient();
  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);
  const extension = extname(file.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
  const safeName = `${Date.now()}-${crypto.randomUUID()}${extension || ""}`;
  const fileName = `admin-qr/${bloqueId}/${safeName}`;

  const { error: uploadError } = await adminSupabase.storage
    .from("comprobantes")
    .upload(fileName, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicFile } = adminSupabase.storage
    .from("comprobantes")
    .getPublicUrl(fileName);

  return { url: String(publicFile.publicUrl || ""), path: fileName };
}

async function updateBlockPaymentStorageFields({
  supabase,
  bloqueId,
  qrPath,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  bloqueId: string;
  qrPath: string;
}) {
  if (!qrPath) return;

  const { error } = await supabase
    .from("bloques")
    .update({ pago_qr_path: qrPath })
    .eq("id", bloqueId);
  if (!error) return;

  if (String(error.message || "").includes("pago_qr_path")) {
    return;
  }

  throw error;
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
type BloqueLite = {
  id: string;
  codigo: string;
};

async function resolveBlockForAdmin(
  supabase: ServerSupabaseClient,
  bloqueInput: string
): Promise<BloqueLite> {
  const raw = String(bloqueInput || "").trim();
  if (!raw) {
    throw new Error("Selecciona un bloque.");
  }

  const byId = await supabase
    .from("bloques")
    .select("id, codigo")
    .eq("id", raw)
    .maybeSingle();

  if (byId.data) {
    return byId.data as BloqueLite;
  }

  const byCodigo = await supabase
    .from("bloques")
    .select("id, codigo")
    .eq("codigo", raw)
    .maybeSingle();

  if (byCodigo.data) {
    return byCodigo.data as BloqueLite;
  }

  const byNombre = await supabase
    .from("bloques")
    .select("id, codigo")
    .eq("nombre", raw)
    .maybeSingle();

  if (byNombre.data) {
    return byNombre.data as BloqueLite;
  }

  throw new Error("No se encontro el bloque seleccionado.");
}

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
}): Promise<{ userId: string; usedServiceRole: boolean; createdAuthUser: boolean }> {
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

      return { userId: existingUserId, usedServiceRole: true, createdAuthUser: false };
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

    return { userId: data.user.id, usedServiceRole: true, createdAuthUser: true };
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
      throw error ?? new Error("No se encontro el departamento seleccionado.");
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

async function deleteProfileUserIfNeeded(userId?: string) {
  if (!userId) return;

  try {
    const supabase = createAdminClient();
    await supabase.from("usuarios").delete().eq("id", userId);
  } catch {
    // Intencionalmente silencioso: evita dejar el flujo bloqueado por el rollback.
  }
}

async function ensureUniqueVecinoIdentity({
  supabase,
  bloqueId,
  departamentoId,
  username,
  excludeUserId,
}: {
  supabase: ServerSupabaseClient;
  bloqueId: string;
  departamentoId: string;
  username: string;
  excludeUserId?: string;
}) {
  const normalizedUsername = String(username || "").trim().toLowerCase();

  const { data: byDepartamento, error: byDepartamentoError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("rol", "vecino")
    .eq("activo", true)
    .eq("bloque_id", bloqueId)
    .eq("departamento_id", departamentoId)
    .limit(1)
    .maybeSingle();

  if (byDepartamentoError) {
    throw byDepartamentoError;
  }

  if (byDepartamento && byDepartamento.id !== excludeUserId) {
    throw new Error(
      "Este departamento ya tiene un vecino activo en este bloque."
    );
  }

  const { data: byUsername, error: byUsernameError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("rol", "vecino")
    .eq("activo", true)
    .eq("username", normalizedUsername)
    .limit(1)
    .maybeSingle();

  if (byUsernameError) {
    throw byUsernameError;
  }

  if (byUsername && byUsername.id !== excludeUserId) {
    throw new Error(
      "El codigo de departamento ya esta en uso por otro vecino activo."
    );
  }
}

async function findActiveAdminInBlock({
  supabase,
  bloqueId,
  excludeId,
}: {
  supabase: ServerSupabaseClient;
  bloqueId: string;
  excludeId?: string;
}) {
  let query = supabase
    .from("usuarios")
    .select("id")
    .eq("rol", "admin")
    .eq("bloque_id", bloqueId)
    .eq("activo", true)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
    const activo = formData.get("activo") === "on";
    const cuotaMensual = parseNumericInput(formData.get("cuota_mensual"), 0);
    const diaVencimiento = parseNumericInput(formData.get("dia_vencimiento"), 15);
    const valorMora = parseNumericInput(formData.get("valor_mora"), 0);
    const saldoInicial = parseNumericInput(formData.get("saldo_inicial"), 0);


    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del bloque." };
    }

    if (!codigo) {
      return { ok: false, message: "Escribe el codigo del bloque." };
    }

    const supabase = await createClient();
    const { data: bloque, error } = await supabase
      .from("bloques")
      .insert({
        nombre,
        codigo,
        activo,
      })
      .select("id")
      .single();

    if (error || !bloque?.id) {
      throw error ?? new Error("No se pudo crear el bloque.");
    }

    const { error: configError } = await supabase.from("configuracion_bloque").insert({
      bloque_id: bloque.id,
      moneda: "BOB",
      cuota_mensual: cuotaMensual,
      dia_vencimiento: diaVencimiento,
      tipo_mora: "fija_mensual",
      valor_mora: valorMora,
      saldo_inicial: saldoInicial,
      qr_texto_pago: "",
    });

    if (configError) {
      throw configError;
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
    const cuotaMensual = parseNumericInput(formData.get("cuota_mensual"), 0);
    const diaVencimiento = parseNumericInput(formData.get("dia_vencimiento"), 15);
    const valorMora = parseNumericInput(formData.get("valor_mora"), 0);
    const saldoInicial = parseNumericInput(formData.get("saldo_inicial"), 0);

    if (!id) {
      return { ok: false, message: "Falta el bloque a editar." };
    }

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del bloque." };
    }

    if (!codigo) {
      return { ok: false, message: "Escribe el codigo del bloque." };
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

    const { data: existingConfig } = await supabase
      .from("configuracion_bloque")
      .select("bloque_id")
      .eq("bloque_id", id)
      .maybeSingle();

    const configPayload = {
      bloque_id: id,
      moneda: "BOB",
      cuota_mensual: cuotaMensual,
      dia_vencimiento: diaVencimiento,
      tipo_mora: "fija_mensual",
      valor_mora: valorMora,
      saldo_inicial: saldoInicial,
      qr_texto_pago: "",
    };

    const configQuery = existingConfig
      ? supabase.from("configuracion_bloque").update(configPayload).eq("bloque_id", id)
      : supabase.from("configuracion_bloque").insert(configPayload);

    const { error: configError } = await configQuery;

    if (configError) {
      throw configError;
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

function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/")) return fallback;
  return raw;
}

function withFeedbackUrl(path: string, result: ActionState) {
  const query = new URLSearchParams({
    blockok: result.ok ? "1" : "0",
    blockmsg: result.message,
  });
  return path + (path.includes("?") ? "&" : "?") + query.toString();
}
export async function deleteBlockActionForm(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("return_to"), "/superadmin");
  const result = await deleteBlockAction(initialState, formData);
  redirect(withFeedbackUrl(returnTo, result));
}

export async function activateBlockAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    if (!id) {
      return { ok: false, message: "Falta el bloque a activar." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("bloques")
      .update({ activo: true })
      .eq("id", id);

    if (error) {
      throw error;
    }

    revalidatePath("/superadmin/bloques");
    revalidatePath("/superadmin");
    return { ok: true, message: "Bloque activado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo activar el bloque.",
    };
  }
}

export async function activateBlockActionForm(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("return_to"), "/superadmin");
  const result = await activateBlockAction(initialState, formData);
  redirect(withFeedbackUrl(returnTo, result));
}

function buildDuplicateBlockName(baseName: string, existingNames: Set<string>) {
  const cleanBaseName = `Copia de ${String(baseName || "bloque").trim()}`;
  let candidate = cleanBaseName;
  let index = 2;

  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${cleanBaseName} ${index}`;
    index += 1;
  }

  return candidate;
}

function buildDuplicateBlockCode(baseCode: string, existingCodes: Set<string>) {
  const cleanBaseCode = `${String(baseCode || "BLOQUE").trim().toUpperCase()}-COPIA`;
  let candidate = cleanBaseCode;
  let index = 2;

  while (existingCodes.has(candidate.toLowerCase())) {
    candidate = `${cleanBaseCode}-${index}`;
    index += 1;
  }

  return candidate;
}

export async function duplicateBlockAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    if (!id) {
      return { ok: false, message: "Falta el bloque a duplicar." };
    }

    const supabase = createAdminClient();

    const [{ data: originalBlock, error: blockError }, { data: existingBlocks, error: existingBlocksError }, { data: originalDeptos, error: deptosError }] =
      await Promise.all([
        supabase.from("bloques").select("id, nombre, codigo, activo").eq("id", id).maybeSingle(),
        supabase.from("bloques").select("nombre, codigo"),
        supabase.from("departamentos").select("numero, activo").eq("bloque_id", id).order("numero", { ascending: true }),
      ]);

    if (blockError) throw blockError;
    if (existingBlocksError) throw existingBlocksError;
    if (deptosError) throw deptosError;

    if (!originalBlock) {
      return { ok: false, message: "No se encontro el bloque a duplicar." };
    }

    const existingNames = new Set((existingBlocks ?? []).map((item) => String(item.nombre || "").trim().toLowerCase()));
    const existingCodes = new Set((existingBlocks ?? []).map((item) => String(item.codigo || "").trim().toLowerCase()));

    const duplicateName = buildDuplicateBlockName(String(originalBlock.nombre || ""), existingNames);
    const duplicateCode = buildDuplicateBlockCode(String(originalBlock.codigo || ""), existingCodes);

    const { data: newBlock, error: insertBlockError } = await supabase
      .from("bloques")
      .insert({
        nombre: duplicateName,
        codigo: duplicateCode,
        activo: true,
      })
      .select("id")
      .single();

    if (insertBlockError || !newBlock) {
      throw insertBlockError ?? new Error("No se pudo crear el bloque duplicado.");
    }

    const deptosToInsert = (originalDeptos ?? []).map((item) => ({
      bloque_id: newBlock.id,
      numero: item.numero,
      activo: item.activo ?? true,
    }));

    if (deptosToInsert.length > 0) {
      const { error: insertDeptosError } = await supabase.from("departamentos").insert(deptosToInsert);
      if (insertDeptosError) {
        throw insertDeptosError;
      }
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/bloques");
    return {
      ok: true,
      message: `Bloque duplicado: ${duplicateName}. Se copiaron ${deptosToInsert.length} departamentos sin vecinos ni datos.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(error, "No se pudo duplicar el bloque."),
    };
  }
}

export async function duplicateBlockActionForm(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("return_to"), "/superadmin");
  const result = await duplicateBlockAction(initialState, formData);
  redirect(withFeedbackUrl(returnTo, result));
}

export async function purgeBlockAction(
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

    const { data: block } = await supabase
      .from("bloques")
      .select("id, nombre")
      .eq("id", id)
      .maybeSingle();

    if (!block) {
      return { ok: false, message: "No se encontro el bloque." };
    }

    const { data: usersInBlock, error: usersError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("bloque_id", id)
      .in("rol", ["admin", "vecino"]);

    if (usersError) {
      throw usersError;
    }

    const userIds = (usersInBlock ?? []).map((item) => item.id);

    const isMissingTableError = (error: unknown) => {
      if (!error || typeof error !== "object") return false;
      const e = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
      const code = String(e.code || "");
      const message = String(e.message || "").toLowerCase();
      const details = String(e.details || "").toLowerCase();
      const hint = String(e.hint || "").toLowerCase();
      return (
        code === "42P01" ||
        code === "PGRST204" ||
        message.includes("does not exist") ||
        message.includes("no existe") ||
        message.includes("schema cache") ||
        details.includes("schema cache") ||
        hint.includes("schema cache")
      );
    };

    const deleteByBloqueId = async (table: string) => {
      const { error } = await supabase.from(table).delete().eq("bloque_id", id);
      if (error && !isMissingTableError(error)) throw error;
    };

    // Children first (FK dependencies). Some tables may not exist in older DBs.
    await deleteByBloqueId("notificaciones_vecino");
    await deleteByBloqueId("buzon_sugerencias");
    await deleteByBloqueId("avisos");
    await deleteByBloqueId("auditoria_diaria");
    await deleteByBloqueId("gastos_cierres_mensuales");
    await deleteByBloqueId("confirmaciones_pago");
    await deleteByBloqueId("pagos");
    await deleteByBloqueId("cuotas");
    await deleteByBloqueId("gastos");
    await deleteByBloqueId("categorias_gasto");
    await deleteByBloqueId("configuracion_bloque");

    // Remove users before departments, because vecinos can reference departamento_id.
    const { error: perfilError } = await supabase
      .from("usuarios")
      .delete()
      .eq("bloque_id", id)
      .in("rol", ["admin", "vecino"]);
    if (perfilError) throw perfilError;

    await deleteByBloqueId("departamentos");

    const parseFkTable = (message: string) => {
      const match = message.match(/referenced from table "([^"]+)"/i);
      return match?.[1] || null;
    };

    let deleteAttempts = 0;
    while (deleteAttempts < 8) {
      deleteAttempts += 1;
      const { error: bloqueError } = await supabase.from("bloques").delete().eq("id", id);
      if (!bloqueError) {
        break;
      }

      const code = String((bloqueError as { code?: unknown }).code || "");
      const message = String((bloqueError as { message?: unknown }).message || "");
      if (code !== "23503") {
        throw bloqueError;
      }

      const fkTable = parseFkTable(message);
      if (!fkTable) {
        throw new Error("No se pudo eliminar el bloque por datos relacionados. Tabla no identificada.");
      }

      const { error: fkDeleteError } = await supabase.from(fkTable).delete().eq("bloque_id", id);
      if (fkDeleteError) {
        throw new Error("No se pudo limpiar la tabla relacionada: " + fkTable + ". " + String((fkDeleteError as { message?: unknown }).message || ""));
      }
    }

    const { data: stillExists } = await supabase.from("bloques").select("id").eq("id", id).maybeSingle();
    if (stillExists) {
      throw new Error("No se pudo eliminar el bloque despues de varios intentos.");
    }

    for (const userId of userIds) {
      await deleteAuthUserIfNeeded(userId);
    }

    revalidatePath("/superadmin/bloques");
    revalidatePath("/superadmin");
    return { ok: true, message: "Bloque eliminado: " + String(block.nombre || "") };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(error, "No se pudo eliminar el bloque."),
    };
  }
}

export async function purgeBlockActionForm(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("return_to"), "/superadmin");
  const result = await purgeBlockAction(initialState, formData);
  redirect(withFeedbackUrl(returnTo, result));
}


export async function createAdminAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  let createdUserId: string | undefined;
  let createdProfileId: string | undefined;
  let shouldDeleteAuthUser = false;

  try {
    await requireSuperadmin();

    const nombre = safeString(formData.get("nombre"));
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const telefono = safeString(formData.get("telefono"));
    const banco = safeString(formData.get("banco"));
    const numeroCuenta = safeString(formData.get("numero_cuenta"));
    const qrUrl = safeString(formData.get("qr_url"));
    const qrFile = formData.get("qr_file");

    if (!nombre) {
      return { ok: false, message: "Escribe el nombre del admin." };
    }

    if (!password || password.length < 6) {
      return {
        ok: false,
        message: "La contrasena debe tener al menos 6 caracteres.",
      };
    }

    const supabase = await createClient();
    const bloque = await resolveBlockForAdmin(supabase, bloqueId);
    const canonicalBloqueId = String(bloque.id || "");

    const activeAdmin = await findActiveAdminInBlock({
      supabase,
      bloqueId: canonicalBloqueId,
    });

    if (activeAdmin) {
      return {
        ok: false,
        message: "Este bloque ya tiene un admin activo. Solo puede haber uno por bloque.",
      };
    }

    const generatedEmail = adminEmailFromBlockCode(bloque.codigo);

    let finalQrUrl = qrUrl;
    let finalQrPath = "";
    if (qrFile instanceof File && qrFile.size > 0) {
      const uploadedQr = await uploadAdminQrImage(qrFile, canonicalBloqueId);
      finalQrUrl = uploadedQr.url;
      finalQrPath = uploadedQr.path;
    }

    const paymentDetails = serializeAdminPaymentDetails({
      banco,
      numeroCuenta,
      qrUrl: finalQrUrl,
      qrPath: finalQrPath,
    });

    const authResult = await createAuthUser({
      email: generatedEmail,
      password,
      userMetadata: {
        nombre,
        rol: "admin",
        bloque_id: canonicalBloqueId,
      },
    });

    createdUserId = authResult.userId;
    shouldDeleteAuthUser = authResult.createdAuthUser;

    const profileSupabase = authResult.usedServiceRole
      ? createAdminClient()
      : await createClient();

    const { data: existingProfile } = await profileSupabase
      .from("usuarios")
      .select("id")
      .eq("id", authResult.userId)
      .maybeSingle();

    const { error: perfilError } = await profileSupabase.from("usuarios").upsert(
      {
        id: authResult.userId,
        nombre,
        email: generatedEmail,
        telefono: telefono || null,
        rol: "admin",
        bloque_id: canonicalBloqueId,
        departamento_id: null,
        username: paymentDetails,
        activo: true,
      },
      { onConflict: "id" }
    );

    if (perfilError) {
      throw perfilError;
    }


    if (!existingProfile) {
      createdProfileId = authResult.userId;
    }

    await updateBlockPaymentStorageFields({
      supabase: createAdminClient(),
      bloqueId: canonicalBloqueId,
      qrPath: finalQrPath,
    });

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/admins");
    return { ok: true, message: `Admin ${nombre} creado.` };
  } catch (error) {
    await deleteProfileUserIfNeeded(createdProfileId);
    if (shouldDeleteAuthUser) {
      await deleteAuthUserIfNeeded(createdUserId);
    }
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
    const password = safeString(formData.get("password"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const telefono = safeString(formData.get("telefono"));
    const banco = safeString(formData.get("banco"));
    const numeroCuenta = safeString(formData.get("numero_cuenta"));
    const qrUrl = safeString(formData.get("qr_url"));
    const qrFile = formData.get("qr_file");
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el admin a editar." };
    }

    if (!nombre) {
      return { ok: false, message: "Completa nombre." };
    }

    const adminSupabase = createAdminClient();
    const bloque = await resolveBlockForAdmin(adminSupabase, bloqueId);
    const canonicalBloqueId = String(bloque.id || "");

    const generatedEmail = adminEmailFromBlockCode(bloque.codigo);

    const { data: currentAdmin } = await adminSupabase
      .from("usuarios")
      .select("username")
      .eq("id", id)
      .maybeSingle();
    const previousPaymentDetails = parseAdminPaymentDetails(currentAdmin?.username);

    let finalQrUrl = qrUrl;
    let finalQrPath = previousPaymentDetails.qrPath;
    if (qrFile instanceof File && qrFile.size > 0) {
      const uploadedQr = await uploadAdminQrImage(qrFile, canonicalBloqueId);
      finalQrUrl = uploadedQr.url;
      finalQrPath = uploadedQr.path;
    }

    if (activo) {
      const activeAdmin = await findActiveAdminInBlock({
        supabase: adminSupabase,
        bloqueId: canonicalBloqueId,
        excludeId: id,
      });

      if (activeAdmin) {
        return {
          ok: false,
          message: "Este bloque ya tiene un admin activo. Solo puede haber uno por bloque.",
        };
      }
    }

    const updatePayload: Record<string, unknown> = {
      nombre,
      email: generatedEmail,
      telefono: telefono || null,
      rol: "admin",
      bloque_id: canonicalBloqueId,
      departamento_id: null,
      username: serializeAdminPaymentDetails({ banco, numeroCuenta, qrUrl: finalQrUrl, qrPath: finalQrPath }),
      activo,
    };

    const { error } = await adminSupabase
      .from("usuarios")
      .update(updatePayload)
      .eq("id", id)
      .eq("rol", "admin");
    if (error) {
      throw error;
    }
    await updateBlockPaymentStorageFields({
      supabase: adminSupabase,
      bloqueId: canonicalBloqueId,
      qrPath: finalQrPath,
    });

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminSupabase = createAdminClient();
      const authPayload: {
        email: string;
        user_metadata: Record<string, unknown>;
        password?: string;
      } = {
        email: generatedEmail,
        user_metadata: {
          nombre,
          rol: "admin",
          bloque_id: canonicalBloqueId,
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
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(error, "No se pudo actualizar el admin."),
    };
  }

  redirect("/superadmin/admins?updated=1");
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
      .delete()
      .eq("id", id)
      .eq("rol", "admin");

    if (perfilError) {
      throw perfilError;
    }

    await deleteAuthUserIfNeeded(id);

    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin");
    return { ok: true, message: "Admin eliminado por completo." };
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

export async function updateDepartmentStructureAction(
  state: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void state;

  try {
    await requireSuperadmin();

    const id = safeString(formData.get("id"));
    const bloqueId = safeString(formData.get("bloque_id"));
    const numero = normalizeDepartamentoNumero(safeString(formData.get("numero")));
    const activo = formData.get("activo") === "on";

    if (!id) {
      return { ok: false, message: "Falta el departamento a editar." };
    }

    if (!bloqueId) {
      return { ok: false, message: "Selecciona un bloque." };
    }

    if (!numero) {
      return { ok: false, message: "Escribe el numero del departamento." };
    }

    const supabase = createAdminClient();

    const [{ data: departamentoActual, error: currentError }, { data: numeroOcupado, error: uniqueError }, { data: vecinoAsignado, error: vecinoError }] =
      await Promise.all([
        supabase.from("departamentos").select("id, bloque_id, numero").eq("id", id).maybeSingle(),
        supabase.from("departamentos").select("id").eq("bloque_id", bloqueId).eq("numero", numero).neq("id", id).maybeSingle(),
        supabase.from("usuarios").select("id").eq("rol", "vecino").eq("departamento_id", id).limit(1).maybeSingle(),
      ]);

    if (currentError) throw currentError;
    if (uniqueError) throw uniqueError;
    if (vecinoError) throw vecinoError;

    if (!departamentoActual) {
      return { ok: false, message: "No se encontro el departamento." };
    }

    if (numeroOcupado) {
      return { ok: false, message: "Ya existe un departamento con ese numero en ese bloque." };
    }

    if (vecinoAsignado) {
      return { ok: false, message: "Este departamento ya tiene un vecino asignado. Editalo desde la ficha del departamento con vecino." };
    }

    const { error: updateError } = await supabase
      .from("departamentos")
      .update({
        bloque_id: bloqueId,
        numero,
        activo,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/bloques");
    revalidatePath(`/superadmin/bloques/${departamentoActual.bloque_id}`);
    revalidatePath(`/superadmin/bloques/${bloqueId}`);
    revalidatePath(`/superadmin/departamentos/${id}`);
    return { ok: true, message: `Departamento ${numero} actualizado.` };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(error, "No se pudo actualizar el departamento."),
    };
  }
}

export async function deleteDepartmentStructureAction(
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

    const supabase = createAdminClient();
    const [{ data: departamentoActual, error: currentError }, { data: vecinoAsignado, error: vecinoError }] =
      await Promise.all([
        supabase.from("departamentos").select("id, bloque_id, numero").eq("id", id).maybeSingle(),
        supabase.from("usuarios").select("id").eq("rol", "vecino").eq("departamento_id", id).limit(1).maybeSingle(),
      ]);

    if (currentError) throw currentError;
    if (vecinoError) throw vecinoError;

    if (!departamentoActual) {
      return { ok: false, message: "No se encontro el departamento." };
    }

    if (vecinoAsignado) {
      return { ok: false, message: "No puedes borrar este departamento porque ya tiene un vecino asignado." };
    }

    const { error: deleteError } = await supabase.from("departamentos").delete().eq("id", id);
    if (deleteError) {
      throw deleteError;
    }

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/bloques");
    revalidatePath(`/superadmin/bloques/${departamentoActual.bloque_id}`);
    return { ok: true, message: `Departamento ${departamentoActual.numero} eliminado.` };
  } catch (error) {
    return {
      ok: false,
      message: formatActionError(error, "No se pudo eliminar el departamento."),
    };
  }
}

export async function deleteDepartmentStructureActionForm(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("return_to"), "/superadmin");
  const result = await deleteDepartmentStructureAction(initialState, formData);
  redirect(withFeedbackUrl(returnTo, result));
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
        message: "La contrasena debe tener al menos 6 caracteres.",
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
      throw bloqueError ?? new Error("No se encontro el bloque seleccionado.");
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

    await ensureUniqueVecinoIdentity({
      supabase,
      bloqueId,
      departamentoId: departamento.id,
      username: departmentCode,
    });
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

    const { error: perfilError } = await profileSupabase.from("usuarios").upsert(
      {
        id: authResult.userId,
        nombre,
        email,
        username: departmentCode,
        rol: "vecino",
        bloque_id: bloqueId,
        departamento_id: departamento.id,
        activo: true,
      },
      { onConflict: "id" }
    );

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
      throw bloqueError ?? new Error("No se encontro el bloque seleccionado.");
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

    await ensureUniqueVecinoIdentity({
      supabase,
      bloqueId,
      departamentoId: departamento.id,
      username: departmentCode,
      excludeUserId: id,
    });

    const { error } = await supabase
      .from("usuarios")
      .update({
        nombre,
        email,
        username: departmentCode,
        rol: "vecino",
        bloque_id: bloqueId,
        departamento_id: departamento.id,
        activo,
      })
      .eq("id", id);

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
    return { ok: true, message: "Departamento borrado y acceso retirado." };
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

































