import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import UserCreateForm from "@/app/superadmin/_components/user-create-form";
import { createAdminAction } from "@/app/superadmin/actions";

export const metadata: Metadata = {
  title: "Nuevo admin",
};

type Props = {
  searchParams: Promise<{ bloqueId?: string }>;
};

export default async function NuevoAdminPage({ searchParams }: Props) {
  const { bloqueId } = await searchParams;
  const supabase = await createClient();
  const serviceRoleAvailable = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: bloques }, { data: adminsActivos }] = await Promise.all([
    supabase
      .from("bloques")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("usuarios")
      .select("bloque_id")
      .eq("rol", "admin")
      .eq("activo", true),
  ]);

  const bloquesConAdminActivo = new Set(
    (adminsActivos ?? []).map((item) => String(item.bloque_id || ""))
  );

  const bloquesDisponibles = (bloques ?? []).filter(
    (item) => !bloquesConAdminActivo.has(item.id)
  );

  return (
    <main className="space-y-3">
      <section className="theme-hero rounded-[24px] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Superadmin</p>
        <h1 className="mt-2 text-lg font-bold text-white md:text-3xl">Crear nuevo admin</h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Crea una cuenta nueva para el administrador del bloque.
        </p>
      </section>

      <section className="theme-panel rounded-[24px] p-4 shadow-xl ring-1 ring-white/10 md:p-6">
        {bloquesDisponibles.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-50">
            Todos los bloques ya tienen un admin activo. Para crear uno nuevo,
            primero borra el admin actual del bloque.
          </div>
        ) : null}

        <UserCreateForm
          mode="admin"
          blocks={bloquesDisponibles}
          departamentos={[]}
          action={createAdminAction}
          initialValues={{ bloque_id: bloqueId }}
          autoGenerateAdminEmail
          serviceRoleAvailable={serviceRoleAvailable}
        />
      </section>
    </main>
  );
}

