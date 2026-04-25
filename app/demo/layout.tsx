import Link from "next/link";

const nav = [
  { href: "/demo", label: "Roles" },
  { href: "/demo/admin", label: "Administradores" },
  { href: "/demo/admin/pagos", label: "Cobros" },
  { href: "/demo/vecino", label: "Vecino" },
  { href: "/demo/vecino/transparencia", label: "Transparencia" },
];

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-lg font-bold text-white">MiBloque Demo</p>
            <p className="text-sm text-slate-300">
              Modo solo lectura con datos ficticios
            </p>
          </div>
          <div className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
            Demo
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
          <nav className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
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
