import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserSafe } from "@/lib/auth";
import LogoutButton from "@/app/logout-button";
import CuboLogo from "@/components/branding/cubo-logo";
import ActiveNav from "@/components/navigation/active-nav";
import AdminSidebarNav, { type AdminSidebarItem } from "@/components/admin/admin-sidebar-nav";

const navItems: AdminSidebarItem[] = [
  { href: "/superadmin", label: "Inicio" },
  {
    href: "/superadmin/bloques",
    label: "Bloques",
    children: [
      { href: "/superadmin/bloques", label: "Lista de bloques" },
      { href: "/superadmin/bloques/nuevo", label: "Nuevo bloque" },
    ],
  },
  {
    href: "/superadmin/admins",
    label: "Administradores",
    children: [
      { href: "/superadmin/admins", label: "Lista de admins" },
      { href: "/superadmin/admins/nuevo", label: "Nuevo admin" },
    ],
  },
  {
    href: "/superadmin/vecinos",
    label: "Departamentos",
    children: [
      { href: "/superadmin/vecinos", label: "Departamentos" },
      { href: "/superadmin/vecinos/nuevo", label: "Nuevo departamento" },
    ],
  },
];

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getAuthUserSafe(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();

  if (!perfil || perfil.rol !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="theme-shell min-h-screen text-slate-100 md:flex">
      <aside className="theme-hero-alt hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/10 px-3 py-3 md:sticky md:top-0 md:flex">
        <div className="min-w-0 border-b border-white/10 pb-3">
          <CuboLogo className="h-auto w-[150px] max-w-full" />
          <p className="mt-2 text-[11px] font-semibold leading-4 text-white">Superadmin</p>
          <p className="text-[11px] leading-4 text-slate-300">Control general de KUBO</p>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
          <AdminSidebarNav items={navItems} />
        </div>

        <div className="space-y-1.5 border-t border-white/10 pt-2">
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="theme-shell sticky top-0 z-40 border-b border-white/10 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-2 sm:px-5 sm:py-4 lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <CuboLogo className="h-auto w-[170px] max-w-full md:w-[210px]" />
                <p className="mt-2 text-lg font-bold tracking-tight text-white md:text-2xl">KUBO Superadmin</p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="flex shrink-0 items-center gap-2">
                  <LogoutButton />
                </div>

                <ActiveNav className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1 lg:justify-end" items={navItems.map(({ href, label, badge }) => ({ href, label, badge }))} />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}


