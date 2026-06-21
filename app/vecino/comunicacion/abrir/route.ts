import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
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
