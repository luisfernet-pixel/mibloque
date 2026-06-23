import { NextResponse } from "next/server";
import { requireBlockAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const usuario = await requireBlockAdmin();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  return NextResponse.redirect(new URL("/admin/confirmaciones", req.url), 303);
}