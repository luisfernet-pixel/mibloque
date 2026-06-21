import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/app/logout-button";
import CuboLogo from "@/components/branding/cubo-logo";
import ActiveNav from "@/components/navigation/active-nav";
import AdminSidebarNav, { type AdminSidebarItem } from "@/components/admin/admin-sidebar-nav";

export default async function VecinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const usuario = await requireVecino();
  const cookieStore = await cookies();
  const avisosVistosAt = cookieStore.get("vecino_avisos_vistos_at")?.value || null;
  const avisosVistosDate = avisosVistosAt ? new Date(avisosVistosAt) : null;
  const avisosVistosIso = avisosVistosDate && !Number.isNaN(avisosVistosDate.getTime()) ? avisosVistosDate.toISOString() : "1970-01-01T00:00:00.000Z";

  if (!usuario) redirect("/login");
  const supabase = createAdminClient();
  const [bloqueRes, deptoRes, avisosNuevosRes, respuestasPendientesRes] = await Promise.all([
    supabase.from("bloques").select("nombre, codigo, activo").eq("id", usuario.perfil.bloque_id).maybeSingle(),
    usuario.perfil.departamento_id
      ? supabase.from("departamentos").select("numero").eq("id", usuario.perfil.departamento_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    usuario.perfil.departamento_id
      ? supabase
          .from("avisos")
          .select("id")
          .eq("bloque_id", usuario.perfil.bloque_id)
          .eq("publicado", true)
          .gt("created_at", avisosVistosIso)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    usuario.perfil.departamento_id
      ? supabase.from("buzon_sugerencias").select("id").eq("vecino_id", usuario.perfil.id).eq("estado", "respondido").eq("respuesta_leida", false)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const nombreVecino = usuario.perfil.nombre || "Vecino";
  const numeroDepto = deptoRes.data?.numero ? String(deptoRes.data.numero) : "-";
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
              <CuboLogo className="h-auto w-[150px] max-w-full md:w-[185px]" />
              <p className="mt-2 text-sm text-slate-200">
                Bloque <span className="font-semibold text-white">{bloqueDisplay}</span>
              </p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
          <section className="rounded-2xl border border-orange-300/30 bg-orange-500/10 p-6 text-orange-100">
            <h1 className="text-xl font-bold text-white">Acceso temporalmente suspendido</h1>
            <p className="mt-3 text-sm leading-6">
              Este edificio tiene el servicio en pausa por facturacion pendiente.
            </p>
            <p className="mt-2 text-sm leading-6">
              Cuando se regularice el estado del servicio, tu acceso se habilitara automaticamente.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const comunicacionPendientes = (avisosNuevosRes.data?.length ?? 0) + (respuestasPendientesRes.data?.length ?? 0);

  const menu: AdminSidebarItem[] = [
    { href: "/vecino", label: "Inicio" },
    {
      href: "/vecino/comunicacion",
      label: "Avisos",
      badge: comunicacionPendientes,
    },
    {
      href: "/vecino/transparencia",
      label: "Cuentas del bloque",
      children: [
        { href: "/vecino/transparencia", label: "Resumen" },
        { href: "/vecino/transparencia/cuadro", label: "Cuadro" },
      ],
    },
  ];

  return (
    <div className="theme-shell min-h-screen md:flex">
      <aside className="theme-hero-alt hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/10 px-3 py-3 md:sticky md:top-0 md:flex">
        <div className="min-w-0 border-b border-white/10 pb-3">
          <CuboLogo className="h-auto w-[150px] max-w-full" />
          <p className="mt-2 text-[11px] leading-4 text-slate-300">
            Vecino <span className="font-semibold text-white">{nombreVecino}</span>
          </p>
          <p className="text-[11px] leading-4 text-slate-300">
            Depto <span className="font-semibold text-white">{numeroDepto}</span> - Bloque <span className="font-semibold text-white">{bloqueDisplay}</span>
          </p>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
          <AdminSidebarNav items={menu} />
        </div>

        <div className="space-y-1.5 border-t border-white/10 pt-2">
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="theme-hero-alt sticky top-0 z-40 border-b border-white/10 backdrop-blur md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-2 md:px-6 md:py-4 [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:md:py-2">
            <div className="flex items-start justify-between gap-3 md:items-center md:gap-3 [@media(max-height:820px)]:gap-1.5">
              <div>
                <CuboLogo className="h-auto w-[150px] max-w-full md:w-[185px] [@media(max-height:820px)]:w-[120px] [@media(max-height:820px)]:md:w-[140px]" />
                <p className="mt-1 text-xs text-slate-200 sm:hidden">
                  {nombreVecino} - Depto {numeroDepto} - Bloque {bloqueDisplay}
                </p>
                <p className="mt-1 hidden text-xs text-slate-200 sm:block md:text-sm [@media(max-height:820px)]:text-[11px]">
                  Vecino: <span className="font-semibold text-white">{nombreVecino}</span> - Depto{" "}
                  <span className="font-semibold text-white">{numeroDepto}</span> - Bloque{" "}
                  <span className="font-semibold text-white">{bloqueDisplay}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2 [@media(max-height:820px)]:gap-1.5">
                <LogoutButton />
              </div>
            </div>

            <ActiveNav
              className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1 md:mt-3 [@media(max-height:820px)]:mt-1.5 [@media(max-height:820px)]:gap-1.5 [@media(max-height:820px)]:pb-0.5"
              items={menu.map(({ href, label, badge }) => ({ href, label, badge }))}
            />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-3 py-2 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}



