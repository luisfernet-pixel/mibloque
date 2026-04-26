import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/app/logout-button";

function normalizarNombreAdmin(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Administrador";

  const sinSufijoBloque = raw.replace(/\s+bloque\s+.+$/i, "").trim();
  return sinSufijoBloque || raw;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireAdmin();

  if (!usuario) redirect("/login");

  const supabase = createAdminClient();
  const [pendientesRes, bloqueRes, sugerenciasRes] = await Promise.all([
    supabase
      .from("confirmaciones_pago")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("estado", "pendiente"),
    supabase
      .from("bloques")
      .select("nombre, codigo")
      .eq("id", usuario.perfil.bloque_id)
      .maybeSingle(),
    supabase
      .from("buzon_sugerencias")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("estado", "pendiente"),
  ]);

  const comprobantesPendientes = pendientesRes.data?.length ?? 0;
  const sugerenciasPendientes = sugerenciasRes.data?.length ?? 0;
  const nombreAdmin = normalizarNombreAdmin(usuario.perfil.nombre);
  const bloqueNombre = bloqueRes.data?.nombre || null;
  const bloqueCodigo = bloqueRes.data?.codigo || null;
  const bloqueDisplay = bloqueNombre
    ? String(bloqueNombre)
    : bloqueCodigo
      ? String(bloqueCodigo)
      : "sin asignar";

  const menu = [
    { href: "/admin", label: "Inicio" },
    { href: "/admin/cuotas", label: "Cobros" },
    { href: "/admin/confirmaciones", label: "Confirmaciones" },
    { href: "/admin/sugerencias", label: "Sugerencias" },
    { href: "/admin/gastos", label: "Gastos" },
    { href: "/admin/avisos", label: "Avisos" },
    { href: "/admin/reportes", label: "Reportes" },
    { href: "/admin/configuracion", label: "Ajustes" },
  ];

  return (
    <div className="theme-shell min-h-screen">
      <header className="theme-hero-alt sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div>
              <h1 className="text-lg font-bold leading-tight md:text-2xl">MiBloque Admin</h1>
              <p className="mt-1 hidden text-xs text-slate-200 sm:block md:text-sm">
                Administrador: <span className="font-semibold text-white">{nombreAdmin}</span> - Bloque{" "}
                <span className="font-semibold text-white">{bloqueDisplay}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-cyan-100 sm:inline-flex">
                Acceso privado
              </span>
              <LogoutButton />
            </div>
          </div>

          <nav className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border border-orange-400/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 hover:text-white md:rounded-xl md:px-4 md:py-2 md:text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/admin/confirmaciones" && comprobantesPendientes > 0 ? (
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                      {comprobantesPendientes}
                    </span>
                  ) : null}
                  {item.href === "/admin/sugerencias" && sugerenciasPendientes > 0 ? (
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                      {sugerenciasPendientes}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>

          {comprobantesPendientes > 0 ? (
            <div className="mt-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 md:mt-4 md:px-4 md:py-3 md:text-sm">
              Tienes {comprobantesPendientes} comprobante(s) pendiente(s) por revisar.
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
