import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

export default async function HomePage() {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }

  if (
    usuario.perfil.rol === "admin" ||
    usuario.perfil.rol === "superadmin"
  ) {
    redirect("/admin");
  }

  redirect("/vecino");
}