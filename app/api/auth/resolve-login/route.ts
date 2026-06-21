import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";

const MAX_IDENTIFIER_LENGTH = 120;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.toLowerCase();
}

function fallbackInternalEmail(identifier: string) {
  return `${identifier.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
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
