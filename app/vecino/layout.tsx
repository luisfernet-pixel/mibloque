import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/app/logout-button";

export default async function VecinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireVecino();

  if (!usuario) redirect("/login");
  const supabase = createAdminClient();
  const [bloqueRes, deptoRes] = await Promise.all([
    supabase
      .from("bloques")
      .select("nombre, codigo")
      .eq("id", usuario.perfil.bloque_id)
      .maybeSingle(),
    usuario.perfil.departamento_id
      ? supabase
          .from("departamentos")
          .select("numero")
          .eq("id", usuario.perfil.departamento_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const nombreVecino = usuario.perfil.nombre || "Vecino";
  const numeroDepto = deptoRes.data?.numero ? String(deptoRes.data.numero) : "-";
  const bloqueNombre = bloqueRes.data?.nombre || null;
  const bloqueCodigo = bloqueRes.data?.codigo || null;
  const bloqueDisplay = bloqueNombre
    ? String(bloqueNombre)
    : bloqueCodigo
      ? String(bloqueCodigo)
      : "sin asignar";

  const menu = [
    { href: "/vecino", label: "Inicio" },
    { href: "/vecino/transparencia", label: "Transparencia" },
  ];

  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2.5 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3 md:items-center md:gap-4">
            <div>
              <h1 className="text-lg font-bold leading-tight md:text-2xl">MiBloque Vecino</h1>
              <p className="mt-1 text-xs text-slate-200 md:hidden">
                {nombreVecino} - Depto {numeroDepto}
              </p>
              <p className="mt-1 hidden text-xs text-slate-200 sm:block md:text-sm">
                Vecino: <span className="font-semibold text-white">{nombreVecino}</span> - Depto{" "}
                <span className="font-semibold text-white">{numeroDepto}</span> - Bloque{" "}
                <span className="font-semibold text-white">{bloqueDisplay}</span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-cyan-100 sm:inline-flex">
                Portal activo
              </span>
              <LogoutButton />
            </div>
          </div>

          <nav className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1 md:mt-3">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border border-orange-400/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 hover:text-white md:rounded-xl md:px-4 md:py-2 md:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
