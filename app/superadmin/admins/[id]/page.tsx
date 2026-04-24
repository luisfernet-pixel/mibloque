import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import UserCreateForm from "@/app/superadmin/_components/user-create-form";
import {
  deleteAdminActionForm,
  updateAdminAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Editar admin",
};

export default async function EditAdminPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const serviceRoleAvailable = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: admin }, { data: bloques }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, email, bloque_id, activo")
      .eq("id", id)
      .eq("rol", "admin")
      .single(),
    supabase.from("bloques").select("id, nombre, codigo"),
  ]);

  if (!admin) notFound();

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Editar admin
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Update the account data, assigned block, password or status.
        </p>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <UserCreateForm
          mode="admin"
          blocks={bloques ?? []}
          departamentos={[]}
          action={updateAdminAction}
          submitLabel="Guardar cambios"
          initialValues={{
            id: admin.id,
            nombre: admin.nombre,
            email: admin.email,
            bloque_id: admin.bloque_id,
            activo: admin.activo,
          }}
          showActive
          allowPassword
          serviceRoleAvailable={serviceRoleAvailable}
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <form action={deleteAdminActionForm} className="flex flex-wrap gap-3">
            <input type="hidden" name="id" value={admin.id} />
            <Link
              href="/superadmin/admins"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver
            </Link>
            <button
              type="submit"
              className="rounded-2xl bg-[#ff5a3d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Desactivar admin
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
