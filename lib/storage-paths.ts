import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_OBJECT_MARKER = "/storage/v1/object/public/";
const COMPROBANTES_BUCKET = "comprobantes";

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function isSafeStoragePath(value: string | null | undefined) {
  if (!value) return false;
  const path = normalizeSlashes(value.trim());
  if (!path) return false;
  if (path.startsWith("http://") || path.startsWith("https://")) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("../") || path.includes("..\\")) return false;
  if (path.split("/").some((part) => part === "." || part === ".." || part === "")) return false;
  return /^[a-zA-Z0-9/_.,=@+:-]+$/.test(path);
}

export function extractStoragePathFromPublicUrl(value: string | null | undefined, bucket = COMPROBANTES_BUCKET) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (isSafeStoragePath(raw)) {
    return normalizeSlashes(raw);
  }

  try {
    const url = new URL(raw);
    const marker = `${PUBLIC_OBJECT_MARKER}${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    const decodedPath = decodeURIComponent(encodedPath);
    const normalizedPath = normalizeSlashes(decodedPath);
    return isSafeStoragePath(normalizedPath) ? normalizedPath : null;
  } catch {
    return null;
  }
}

export function resolveStoragePath(pathValue?: string | null, urlValue?: string | null) {
  return extractStoragePathFromPublicUrl(pathValue) ?? extractStoragePathFromPublicUrl(urlValue);
}

export async function createComprobantesSignedUrl(path: string, expiresIn = 120) {
  if (!isSafeStoragePath(path)) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(COMPROBANTES_BUCKET)
    .createSignedUrl(normalizeSlashes(path), expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function redirectToComprobantesSignedUrl(path: string) {
  const signedUrl = await createComprobantesSignedUrl(path);
  if (!signedUrl) {
    return new Response("Archivo no disponible.", { status: 404 });
  }

  return Response.redirect(signedUrl, 302);
}
