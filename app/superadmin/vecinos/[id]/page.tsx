import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import UserCreateForm from "@/app/superadmin/_components/user-create-form";
import {
  deleteVecinoActionForm,
  updateVecinoAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Editar vecino",
};

export default async function EditVecinoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vecino }, { data: bloques }, { data: departamentos }] =
    await Promise.all([
      supabase
        .from("usuarios")
        .select(
          "id, nombre, username, email, bloque_id, departamento_id, activo"
        )
        .eq("id", id)
        .eq("rol", "vecino")
        .single(),
      supabase.from("bloques").select("id, nombre, codigo"),
      supabase
        .from("departamentos")
        .select("id, numero, bloque_id")
        .order("numero", { ascending: true }),
    ]);

  if (!vecino) notFound();

  const departamentoActual = departamentos?.find(
    (item) => item.id === vecino.departamento_id
  );

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Editar vecino
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Cambia usuario, departamento, contraseña o estado.
        </p>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <UserCreateForm
          mode="vecino"
          blocks={bloques ?? []}
          departamentos={departamentos ?? []}
          action={updateVecinoAction}
          submitLabel="Guardar cambios"
          initialValues={{
            id: vecino.id,
            nombre: vecino.nombre,
            username: vecino.username,
            bloque_id: vecino.bloque_id,
            departamento_id: vecino.departamento_id,
            departamento_numero: departamentoActual?.numero ?? "",
            activo: vecino.activo,
          }}
          showActive
          allowPassword
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <form action={deleteVecinoActionForm} className="flex flex-wrap gap-3">
            <input type="hidden" name="id" value={vecino.id} />
            <Link
              href="/superadmin/vecinos"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver
            </Link>
            <button
              type="submit"
              className="rounded-2xl bg-[#ff5a3d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Desactivar vecino
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
