import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isBloqueActivo, requireVecino } from "@/lib/auth";

export async function GET(request: Request) {
  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.bloque_id || !usuario.perfil.departamento_id) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) {
    return NextResponse.redirect(new URL("/vecino/comunicacion?error=servicio_suspendido", request.url), 303);
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
