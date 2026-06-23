import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireVecino } from "@/lib/auth";

export async function GET(request: Request) {
  const usuario = await requireVecino();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const cookieStore = await cookies();
  cookieStore.set("vecino_avisos_vistos_at", new Date().toISOString(), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  const url = new URL("/vecino/comunicacion", request.url);
  return NextResponse.redirect(url);
}
