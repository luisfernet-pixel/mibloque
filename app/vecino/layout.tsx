import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVecino } from "@/lib/auth";
import LogoutButton from "@/app/logout-button";

export default async function VecinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireVecino();

  if (!usuario) redirect("/login");

  const menu = [
    { href: "/vecino", label: "Inicio" },
    { href: "/vecino/transparencia", label: "Transparencia" },
  ];

  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">MiBloque Vecino</h1>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-cyan-100">
                Portal activo
              </span>
              <LogoutButton />
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-orange-400/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {children}
      </main>
    </div>
  );
}
