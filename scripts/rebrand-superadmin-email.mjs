import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function findAuthUserIdByEmail(supabase, email) {
  let page = 1;
  const targetEmail = String(email || "").toLowerCase();

  while (page <= 100) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const match = (data?.users ?? []).find(
      (user) => String(user.email || "").toLowerCase() === targetEmail
    );
    if (match) return match.id;
    if (!data?.nextPage) return null;
    page = data.nextPage;
  }

  return null;
}

async function main() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }

  const oldDomain = `${"mi"}${"bloque"}.app`;
  const oldEmail = `superadmin@${oldDomain}`;
  const newEmail = "superadmin@kubo.app";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const newEmailUserId = await findAuthUserIdByEmail(supabase, newEmail);
  const oldEmailUserId = await findAuthUserIdByEmail(supabase, oldEmail);

  if (newEmailUserId && !oldEmailUserId) {
    console.log("Auth ya está en superadmin@kubo.app");
  } else if (!oldEmailUserId) {
    throw new Error("No encontré el superadmin anterior en Auth.");
  } else {
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(oldEmailUserId, {
      email: newEmail,
      email_confirm: true,
    });
    if (authUpdateError) throw authUpdateError;
    console.log("Auth actualizado a superadmin@kubo.app");
  }

  const { data: superadmins, error: superadminReadError } = await supabase
    .from("usuarios")
    .select("id,email")
    .eq("rol", "superadmin");
  if (superadminReadError) throw superadminReadError;

  let updatedInUsuarios = 0;
  for (const row of superadmins ?? []) {
    const currentEmail = String(row.email || "").toLowerCase();
    if (currentEmail === oldEmail) {
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ email: newEmail })
        .eq("id", row.id);
      if (updateError) throw updateError;
      updatedInUsuarios += 1;
    }
  }

  if (updatedInUsuarios === 0) {
    console.log("Tabla usuarios ya estaba en superadmin@kubo.app");
  } else {
    console.log(`Tabla usuarios actualizada (${updatedInUsuarios})`);
  }

  const { data: adminRows, error: adminRowsError } = await supabase
    .from("usuarios")
    .select("id,email,rol")
    .in("rol", ["admin", "superadmin"]);
  if (adminRowsError) throw adminRowsError;

  let adminAuthUpdated = 0;
  let adminTableUpdated = 0;

  for (const row of adminRows ?? []) {
    const email = String(row.email || "").toLowerCase();
    if (!email.endsWith(`@${oldDomain}`)) continue;
    const targetEmail = email.replace(
      new RegExp(`@${oldDomain.replace(".", "\\.")}$`, "i"),
      "@kubo.app"
    );

    let authUpdated = false;
    if (row.id) {
      const { error: updateByIdError } = await supabase.auth.admin.updateUserById(String(row.id), {
        email: targetEmail,
        email_confirm: true,
      });
      if (!updateByIdError) {
        authUpdated = true;
      }
    }

    if (!authUpdated) {
      const authIdByOldEmail = await findAuthUserIdByEmail(supabase, email);
      if (authIdByOldEmail) {
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
          authIdByOldEmail,
          {
            email: targetEmail,
            email_confirm: true,
          }
        );
        if (authUpdateError) throw authUpdateError;
        authUpdated = true;
      }
    }

    if (authUpdated) {
      adminAuthUpdated += 1;
    }

    const { error: tableUpdateError } = await supabase
      .from("usuarios")
      .update({ email: targetEmail })
      .eq("id", row.id);
    if (tableUpdateError) throw tableUpdateError;
    adminTableUpdated += 1;
  }

  console.log(`Admins/superadmin en Auth actualizados: ${adminAuthUpdated}`);
  console.log(`Admins/superadmin en usuarios actualizados: ${adminTableUpdated}`);

  console.log("Listo");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
