import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/logout-button";

const navItems = [{ href: "/superadmin", label: "Panel" }];

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="theme-shell min-h-screen text-slate-100">
      <header className="theme-shell sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-white md:text-2xl">MiBloque Superadmin</p>
              <p className="hidden truncate text-xs text-slate-300 sm:block md:text-sm">
                {perfil.nombre} - {perfil.rol}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 sm:block">
                Control total
              </div>
              <LogoutButton />
            </div>
          </div>

          <nav className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border border-white/10 bg-slate-900/30 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-400/30 hover:bg-slate-800/70 hover:text-white md:rounded-2xl md:px-3 md:py-2 md:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</div>
    </div>
  );
}
