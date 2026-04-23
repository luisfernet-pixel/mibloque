import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BlockCreateForm from "@/app/superadmin/_components/block-create-form";
import {
  deleteBlockActionForm,
  updateBlockAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Editar bloque",
};

export default async function EditBlockPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bloque } = await supabase
    .from("bloques")
    .select("id, nombre, codigo, activo")
    .eq("id", id)
    .single();

  if (!bloque) notFound();

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Editar bloque
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Cambia nombre, código o estado del bloque.
        </p>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <BlockCreateForm
          action={updateBlockAction}
          submitLabel="Guardar cambios"
          initialValues={{
            id: bloque.id,
            nombre: bloque.nombre,
            codigo: bloque.codigo,
            activo: bloque.activo,
          }}
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <form action={deleteBlockActionForm} className="flex flex-wrap gap-3">
            <input type="hidden" name="id" value={bloque.id} />
            <Link
              href="/superadmin/bloques"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver
            </Link>
            <button
              type="submit"
              className="rounded-2xl bg-[#ff5a3d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Desactivar bloque
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
