import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "kubo-admin-payment:";
const BUCKET = "comprobantes";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const apply = process.argv.includes("--apply");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parsePaymentDetails(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(PREFIX.length));
    return {
      banco: String(parsed.banco || ""),
      numeroCuenta: String(parsed.numeroCuenta || ""),
      qrUrl: String(parsed.qrUrl || ""),
      qrPath: String(parsed.qrPath || ""),
    };
  } catch {
    return null;
  }
}

function serializePaymentDetails(details) {
  return `${PREFIX}${JSON.stringify({
    banco: details.banco,
    numeroCuenta: details.numeroCuenta,
    qrUrl: details.qrUrl,
    qrPath: details.qrPath,
  })}`;
}

function derivePathFromPublicUrl(value) {
  const raw = String(value || "").trim();
  const index = raw.indexOf(PUBLIC_MARKER);
  if (index === -1) return null;
  const encodedPath = raw.slice(index + PUBLIC_MARKER.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

function isExpectedQrPath(value, bloqueId) {
  const pathValue = String(value || "");
  if (!pathValue.startsWith(`admin-qr/${bloqueId}/`)) return false;
  if (pathValue.includes("../") || pathValue.includes("..\\")) return false;
  return /^[a-zA-Z0-9/_.,=@+:-]+$/.test(pathValue);
}

function redactPath(value) {
  const raw = String(value || "");
  if (raw.length <= 70) return raw;
  return `${raw.slice(0, 58)}...${raw.slice(-10)}`;
}

async function storageObjectExists(supabase, objectPath) {
  const parts = String(objectPath || "").split("/");
  const name = parts.pop();
  const folder = parts.join("/");
  if (!name || !folder) return { exists: false, error: "invalid_path" };
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, search: name });
  if (error) return { exists: false, error: error.message || "storage_list_error" };
  return { exists: (data || []).some((item) => item.name === name), error: null };
}

loadEnv(path.join(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

if (apply) {
  console.log("MODO APPLY ACTIVADO: este script actualizaria datos.");
} else {
  console.log("DRY-RUN: no se modificaran datos. Para aplicar en una fase futura, usar --apply.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const { data: admins, error } = await supabase
  .from("usuarios")
  .select("id, bloque_id, username, rol, activo")
  .eq("rol", "admin")
  .order("created_at", { ascending: true });

if (error) {
  console.error("No se pudieron leer admins:", error.message);
  process.exit(1);
}

const summary = {
  adminsRead: admins?.length || 0,
  candidates: 0,
  valid: 0,
  skipped: 0,
  errors: 0,
  wouldUpdate: 0,
  updated: 0,
};

const rows = [];

for (const admin of admins || []) {
  const details = parsePaymentDetails(admin.username);
  if (!details) {
    summary.skipped += 1;
    continue;
  }

  if (!details.qrUrl || details.qrPath) {
    summary.skipped += 1;
    continue;
  }

  summary.candidates += 1;
  const derivedPath = derivePathFromPublicUrl(details.qrUrl);
  const patternOk = Boolean(derivedPath && isExpectedQrPath(derivedPath, admin.bloque_id));
  const storage = patternOk ? await storageObjectExists(supabase, derivedPath) : { exists: false, error: "pattern_not_ok" };
  const valid = patternOk && storage.exists;

  if (valid) summary.valid += 1;
  else summary.errors += 1;

  rows.push({
    admin: String(admin.id || "").slice(0, 8),
    bloque: String(admin.bloque_id || "").slice(0, 8),
    activo: admin.activo === true,
    path: redactPath(derivedPath),
    patternOk,
    storageExists: storage.exists,
    error: storage.error,
  });

  if (!valid) continue;

  const nextUsername = serializePaymentDetails({ ...details, qrPath: derivedPath });
  if (nextUsername === admin.username) continue;

  if (apply) {
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ username: nextUsername })
      .eq("id", admin.id)
      .eq("rol", "admin");
    if (updateError) {
      summary.errors += 1;
      rows[rows.length - 1].error = updateError.message;
    } else {
      summary.updated += 1;
    }
  } else {
    summary.wouldUpdate += 1;
  }
}

console.table(rows);
console.log(JSON.stringify(summary, null, 2));

if (!apply) {
  console.log("DRY-RUN finalizado sin modificar datos.");
}
