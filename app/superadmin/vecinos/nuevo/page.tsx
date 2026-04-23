import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import UserCreateForm from "@/app/superadmin/_components/user-create-form";
import { createVecinoAction } from "@/app/superadmin/actions";

export const metadata: Metadata = {
  title: "Nuevo departamento",
};

type Props = {
  searchParams: Promise<{ bloqueId?: string; departamentoId?: string }>;
};

export default async function NuevoVecinoPage({ searchParams }: Props) {
  const { bloqueId, departamentoId } = await searchParams;
  const supabase = await createClient();

  const [{ data: bloques }, { data: departamentos }] = await Promise.all([
    supabase
      .from("bloques")
      .select("id, nombre, codigo")
      .order("nombre", { ascending: true }),
    supabase
      .from("departamentos")
      .select("id, numero, bloque_id")
      .order("numero", { ascending: true }),
  ]);

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Crear nuevo departamento
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          El registro del departamento queda vinculado al bloque y a su código interno.
        </p>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <UserCreateForm
          mode="departamento"
          blocks={bloques ?? []}
          departamentos={departamentos ?? []}
          action={createVecinoAction}
          initialValues={{
            bloque_id: bloqueId,
            departamento_numero: departamentoId,
          }}
        />
      </section>
    </main>
  );
}
