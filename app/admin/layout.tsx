import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/app/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireAdmin();

  if (!usuario) redirect("/login");

  const supabase = createAdminClient();
  const { data: pendientesConfirmacion } = await supabase
    .from("confirmaciones_pago")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("estado", "pendiente");

  const comprobantesPendientes = pendientesConfirmacion?.length ?? 0;

  const menu = [
    { href: "/admin", label: "Inicio" },
    { href: "/admin/cuotas", label: "Cobros" },
    { href: "/admin/confirmaciones", label: "Confirmaciones" },
    { href: "/admin/gastos", label: "Gastos" },
    { href: "/admin/avisos", label: "Avisos" },
    { href: "/admin/reportes", label: "Reportes" },
    { href: "/admin/configuracion", label: "Ajustes" },
  ];

  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">MiBloque Admin</h1>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-cyan-100">
                Acceso privado
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
                <span className="inline-flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/admin/confirmaciones" && comprobantesPendientes > 0 ? (
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                      {comprobantesPendientes}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>

          {comprobantesPendientes > 0 ? (
            <div className="mt-4 rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100">
              Tienes {comprobantesPendientes} comprobante(s) pendiente(s) por revisar.
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
