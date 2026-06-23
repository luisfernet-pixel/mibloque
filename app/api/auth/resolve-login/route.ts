import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";

const MAX_IDENTIFIER_LENGTH = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.toLowerCase();
}

function fallbackInternalEmail(identifier: string) {
  return `${identifier.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

function getClientKey(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

function isRateLimited(req: Request) {
  const now = Date.now();
  const key = getClientKey(req);
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { identifier?: unknown } | null;
  const identifier = normalizeIdentifier(body?.identifier);

  if (!identifier || identifier.length > MAX_IDENTIFIER_LENGTH) {
    return NextResponse.json({ error: "invalid_identifier" }, { status: 400 });
  }

  if (EMAIL_PATTERN.test(identifier)) {
    return NextResponse.json({ email: normalizeEmail(identifier) });
  }

  if (identifier.includes("@") || !USERNAME_PATTERN.test(identifier)) {
    return NextResponse.json({ error: "invalid_identifier" }, { status: 400 });
  }

  if (isRateLimited(req)) {
    return NextResponse.json({ email: fallbackInternalEmail(identifier) });
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("usuarios")
      .select("email")
      .eq("username", identifier)
      .maybeSingle();

    return NextResponse.json({ email: data?.email || fallbackInternalEmail(identifier) });
  } catch {
    return NextResponse.json({ email: fallbackInternalEmail(identifier) });
  }
}
