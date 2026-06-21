import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ConfirmActionButton from "@/app/superadmin/_components/confirm-action-button";
import DepartmentStructureForm from "@/app/superadmin/_components/department-structure-form";
import {
  deleteDepartmentStructureActionForm,
  updateDepartmentStructureAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ blockok?: string | string[]; blockmsg?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Editar estructura del departamento",
};

export default async function EditDepartmentStructurePage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const blockokRaw = Array.isArray(query.blockok)
    ? String(query.blockok[0] || "")
    : String(query.blockok || "");
  const blockmsg = Array.isArray(query.blockmsg)
    ? String(query.blockmsg[0] || "")
    : String(query.blockmsg || "");
  const showBlockMsg = blockmsg.trim().length > 0;
  const isBlockOk = blockokRaw === "1";
  const supabase = await createClient();

  const [{ data: departamento }, { data: bloques }, { data: vecinoAsignado }] = await Promise.all([
    supabase.from("departamentos").select("id, numero, bloque_id, activo").eq("id", id).maybeSingle(),
    supabase.from("bloques").select("id, nombre, codigo").order("nombre", { ascending: true }),
    supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("rol", "vecino")
      .eq("departamento_id", id)
      .maybeSingle(),
  ]);

  if (!departamento) notFound();

  return (
    <main className="space-y-3">
      {showBlockMsg ? (
        <section
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            isBlockOk
              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              : "border-orange-300/30 bg-orange-500/10 text-orange-100"
          }`}
        >
          {blockmsg}
        </section>
      ) : null}

      <section className="theme-hero rounded-[24px] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Superadmin</p>
        <h1 className="mt-2 text-lg font-bold text-white md:text-3xl">Editar estructura del departamento</h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Aqui puedes cambiar el numero, el bloque o el estado del departamento aunque todavia este vacio.
        </p>
      </section>

      <section className="theme-panel rounded-[24px] p-6 shadow-xl ring-1 ring-white/10">
        {vecinoAsignado ? (
          <div className="mb-4 rounded-2xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-100">
            Este departamento ya tiene vecino asignado. Para cambiar sus datos completos, usa la ficha del departamento con vecino.
          </div>
        ) : null}

        <DepartmentStructureForm
          blocks={bloques ?? []}
          action={updateDepartmentStructureAction}
          initialValues={{
            id: departamento.id,
            bloque_id: departamento.bloque_id,
            numero: departamento.numero,
            activo: departamento.activo,
          }}
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/superadmin/vecinos/nuevo?bloqueId=${departamento.bloque_id}&departamentoId=${departamento.numero}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Crear vecino para este depto
            </Link>
            <Link
              href={`/superadmin/bloques/${departamento.bloque_id}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Volver al bloque
            </Link>
            <form action={deleteDepartmentStructureActionForm}>
              <input type="hidden" name="id" value={departamento.id} />
              <input type="hidden" name="return_to" value={`/superadmin/bloques/${departamento.bloque_id}`} />
              <ConfirmActionButton
                confirmText="Eliminar este departamento vacio? Solo se borrara la estructura si no tiene vecino asignado."
                className="rounded-2xl bg-[#ff5a3d] px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-110"
              >
                Eliminar departamento
              </ConfirmActionButton>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}