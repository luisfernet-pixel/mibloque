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
  const [bloqueRes, deptoRes, avisosPendientesRes, buzonPendientesRes] = await Promise.all([
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
    usuario.perfil.departamento_id
      ? supabase
          .from("notificaciones_vecino")
          .select("id")
          .eq("bloque_id", usuario.perfil.bloque_id)
          .eq("departamento_id", usuario.perfil.departamento_id)
          .in("tipo", ["aviso_admin", "rechazo_pago"])
          .eq("leida", false)
      : Promise.resolve({ data: [], error: null }),
    usuario.perfil.departamento_id
      ? supabase
          .from("notificaciones_vecino")
          .select("id")
          .eq("bloque_id", usuario.perfil.bloque_id)
          .eq("departamento_id", usuario.perfil.departamento_id)
          .eq("tipo", "respuesta_buzon")
          .eq("leida", false)
      : Promise.resolve({ data: [], error: null }),
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
  const avisosPendientes = avisosPendientesRes.data?.length ?? 0;
  const buzonPendientes = buzonPendientesRes.data?.length ?? 0;

  const menu = [
    { href: "/vecino", label: "Inicio" },
    { href: "/vecino/avisos", label: "Avisos" },
    { href: "/vecino/sugerencias", label: "Sugerencias" },
    { href: "/vecino/transparencia", label: "Transparencia" },
  ];

  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3 md:items-center md:gap-4">
            <div>
              <h1 className="text-base font-bold leading-tight md:text-2xl">MiBloque Vecino</h1>
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

          <nav className="hide-scrollbar mt-2 hidden gap-2 overflow-x-auto pb-1 md:mt-3 md:flex">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border border-orange-400/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 hover:text-white md:rounded-xl md:px-4 md:py-2 md:text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/vecino/avisos" && avisosPendientes > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white">
                      {avisosPendientes}
                    </span>
                  ) : null}
                  {item.href === "/vecino/sugerencias" && buzonPendientes > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white">
                      {buzonPendientes}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>

          {avisosPendientes > 0 ? (
            <div className="mt-3 hidden rounded-2xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 md:mt-4 md:block md:px-4 md:py-3 md:text-sm">
              Tienes {avisosPendientes} aviso(s) nuevo(s).
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-3 pb-20 md:px-6 md:py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0f2740]/95 px-2 py-1.5 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
          {menu.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-white"
            >
              <span>{item.label}</span>
              {item.href === "/vecino/avisos" && avisosPendientes > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white">
                  {avisosPendientes}
                </span>
              ) : null}
              {item.href === "/vecino/sugerencias" && buzonPendientes > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white">
                  {buzonPendientes}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
