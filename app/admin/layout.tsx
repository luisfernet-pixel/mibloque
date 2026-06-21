import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/app/logout-button";
import CuboLogo from "@/components/branding/cubo-logo";
import ActiveNav from "@/components/navigation/active-nav";
import AdminSidebarNav, { type AdminSidebarItem } from "@/components/admin/admin-sidebar-nav";

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
  const [pendientesRes, bloqueRes, sugerenciasRes, sugerenciasEstadoRes, auditoriaRes] = await Promise.all([
    supabase.from("confirmaciones_pago").select("id").eq("bloque_id", usuario.perfil.bloque_id).eq("estado", "pendiente"),
    supabase.from("bloques").select("nombre, codigo, activo").eq("id", usuario.perfil.bloque_id).maybeSingle(),
    supabase.from("buzon_sugerencias").select("id").eq("bloque_id", usuario.perfil.bloque_id).eq("visto_admin", false),
    supabase.from("buzon_sugerencias").select("id").eq("bloque_id", usuario.perfil.bloque_id).eq("estado", "pendiente"),
    supabase
      .from("auditoria_diaria")
      .select("fecha_control, tiene_diferencia, detalle")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("fecha_control", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const comprobantesPendientes = pendientesRes.data?.length ?? 0;
  let sugerenciasPendientes = Math.max(sugerenciasRes.data?.length ?? 0, sugerenciasEstadoRes.data?.length ?? 0);
  if (sugerenciasRes.error) {
    const { data: fallbackData } = await supabase
      .from("buzon_sugerencias")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("estado", "pendiente");
    sugerenciasPendientes = fallbackData?.length ?? 0;
  }

  const nombreAdmin = normalizarNombreAdmin(usuario.perfil.nombre);
  const bloqueNombre = bloqueRes.data?.nombre || null;
  const bloqueCodigo = bloqueRes.data?.codigo || null;
  const bloqueDisplay = bloqueNombre ? String(bloqueNombre) : bloqueCodigo ? String(bloqueCodigo) : "sin asignar";
  const bloqueActivo = bloqueRes.data?.activo !== false;

  if (!bloqueActivo) {
    return (
      <div className="theme-shell min-h-screen">
        <header className="theme-hero-alt border-b border-white/10">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-4 py-4 md:px-6">
            <div>
              <CuboLogo className="h-auto w-[170px] max-w-full md:w-[210px]" />
              <p className="mt-2 text-sm text-slate-200">
                Bloque <span className="font-semibold text-white">{bloqueDisplay}</span>
              </p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
          <section className="rounded-2xl border border-orange-300/30 bg-orange-500/10 p-6 text-orange-100">
            <h1 className="text-xl font-bold text-white">Servicio temporalmente suspendido</h1>
            <p className="mt-3 text-sm leading-6">
              La administracion de este bloque tiene el servicio en pausa por temas de facturacion.
            </p>
            <p className="mt-2 text-sm leading-6">
              Para restablecer el acceso, por favor contacta al equipo comercial de KUBO.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const auditoria = auditoriaRes.data;

  const menu: AdminSidebarItem[] = [
    { href: "/admin", label: "Inicio" },
    {
      href: "/admin/pagos",
      label: "Pagos",
      badge: comprobantesPendientes,
      children: [
        { href: "/admin/pagos/registrar", label: "Registrar pago" },
        { href: "/admin/pagos/comprobantes", label: "Comprobantes" },
        { href: "/admin/confirmaciones", label: "Confirmaciones", badge: comprobantesPendientes },
        { href: "/admin/pagos/deudas", label: "Deudas" },
        { href: "/admin/pagos/historial", label: "Historial" },
        { href: "/admin/validar-pagos", label: "Validar pagos" },
        { href: "/admin/vecinos-pagos", label: "Vecinos y pagos" },
        { href: "/admin/recibos", label: "Recibos" },
        { href: "/admin/cuotas", label: "Cuotas" },
      ],
    },
    {
      href: "/admin/gastos",
      label: "Gastos",
      children: [
        { href: "/admin/gastos/nuevo", label: "Nuevo gasto" },
        { href: "/admin/gastos/categorias", label: "Categorias" },
      ],
    },
    {
      href: "/admin/comunicacion",
      label: "Avisos",
      badge: sugerenciasPendientes,
    },
    {
      href: "/admin/reportes",
      label: "Reportes",
      children: [
        { href: "/admin/reportes/cuadro", label: "Cuadro" },
        { href: "/admin/reportes/morosos", label: "Morosos" },
        { href: "/admin/reportes/departamento", label: "Por departamento" },
        { href: "/admin/auditoria", label: "Auditoria simple" },
      ],
    },
  ];

  const bottomMenu: AdminSidebarItem[] = [
    {
      href: "/admin/configuracion",
      label: "Ajustes",
      children: [
        { href: "/admin/configuracion", label: "Configuracion" },
        { href: "/admin/departamentos", label: "Departamentos" },
      ],
    },
  ];

  return (
    <div className="theme-shell min-h-screen md:flex">
      <aside className="theme-hero-alt hidden h-screen w-[220px] shrink-0 flex-col border-r border-white/10 px-3 py-3 md:sticky md:top-0 md:flex">
        <div className="min-w-0 border-b border-white/10 pb-3">
          <CuboLogo className="h-auto w-[150px] max-w-full" />
          <p className="mt-2 text-[11px] leading-4 text-slate-300">
            Admin <span className="font-semibold text-white">{nombreAdmin}</span>
          </p>
          <p className="text-[11px] leading-4 text-slate-300">
            Bloque <span className="font-semibold text-white">{bloqueDisplay}</span>
          </p>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
          <AdminSidebarNav items={menu} />
        </div>

        <div className="space-y-1.5 border-t border-white/10 pt-2">
          <AdminSidebarNav items={bottomMenu} />
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="theme-hero-alt sticky top-0 z-40 border-b border-white/10 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl px-3 py-2 md:px-6 md:py-4 [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:md:py-2">
          <div className="flex items-start justify-between gap-2 md:items-center md:gap-3 [@media(max-height:820px)]:gap-1.5">
            <div className="min-w-0">
              <CuboLogo className="h-auto w-[170px] max-w-full md:w-[210px] [@media(max-height:820px)]:w-[120px] [@media(max-height:820px)]:md:w-[140px]" />
              <p className="mt-1 text-xs text-slate-200 md:text-sm">
                Administrador: <span className="font-semibold text-white">{nombreAdmin}</span> - Bloque{" "}
                <span className="font-semibold text-white">{bloqueDisplay}</span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 [@media(max-height:820px)]:gap-1.5">
              <LogoutButton />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 [@media(max-height:820px)]:mt-1.5">
            <ActiveNav
              items={menu.map(({ href, label, badge }) => ({ href, label, badge }))}
              className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 [@media(max-height:820px)]:gap-1.5 [@media(max-height:820px)]:pb-0.5"
            />

            <ActiveNav
              items={[{ href: "/admin/configuracion", label: "Ajustes" }]}
              className="shrink-0"
            />
          </div>

          {auditoria?.tiene_diferencia ? (
            <div className="mt-2 rounded-2xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 md:px-4 md:py-3 md:text-sm [@media(max-height:820px)]:mt-1 [@media(max-height:820px)]:px-2 [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:text-[11px]">
              Alerta de auditoria: el ultimo control detecto diferencia en montos. Revisa Reportes - Auditoria simple.
            </div>
          ) : null}
        </div>
        </header>

        {auditoria?.tiene_diferencia ? (
          <div className="mx-auto hidden max-w-7xl px-5 pt-4 md:block">
            <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              Alerta de auditoria: el ultimo control detecto diferencia en montos. Revisa Reportes - Auditoria simple.
            </div>
          </div>
        ) : null}

        <main className="mx-auto max-w-7xl px-4 py-3 md:px-5 md:py-4">{children}</main>
      </div>
    </div>
  );
}





