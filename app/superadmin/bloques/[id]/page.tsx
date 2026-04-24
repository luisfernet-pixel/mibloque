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
  title: "Bloque",
};

export default async function BlockDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: bloque },
    { data: admins },
    { data: departamentosRegistrados },
    { data: departamentos },
  ] = await Promise.all([
    supabase
      .from("bloques")
      .select("id, nombre, codigo, activo, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("usuarios")
      .select("id, nombre, email, activo, created_at")
      .eq("rol", "admin")
      .eq("bloque_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("usuarios")
      .select("id, nombre, username, email, activo, departamento_id, created_at")
      .eq("rol", "vecino")
      .eq("bloque_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("bloque_id", id)
      .order("numero", { ascending: true }),
  ]);

  if (!bloque) notFound();

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          {bloque.nombre}
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Aqui editas el bloque y administras sus cuentas sin salir de la ficha.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/superadmin/admins/nuevo?bloqueId=${bloque.id}`}
            className="btn-primary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
          >
            Crear admin
          </Link>
          <Link
            href={`/superadmin/vecinos/nuevo?bloqueId=${bloque.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Crear departamento
          </Link>
          <Link
            href="/superadmin/bloques"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Volver a bloques
          </Link>
        </div>
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
            <button
              type="submit"
              className="rounded-2xl bg-[#ff5a3d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Desactivar bloque
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Admins del bloque</h2>
              <p className="mt-1 text-sm text-slate-300">
                {admins?.length ?? 0} administrador(es)
              </p>
            </div>
            <Link
              href={`/superadmin/admins/nuevo?bloqueId=${bloque.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Agregar
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {admins?.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.nombre}</p>
                    <p className="text-sm text-slate-300">{item.email}</p>
                  </div>
                  <Link
                    href={`/superadmin/admins/${item.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}

            {(!admins || admins.length === 0) && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300">
                No hay admins para este bloque.
              </div>
            )}
          </div>
        </div>

        <div className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Departamentos del bloque</h2>
              <p className="mt-1 text-sm text-slate-300">
                {departamentosRegistrados?.length ?? 0} departamento(s)
              </p>
            </div>
            <Link
              href={`/superadmin/vecinos/nuevo?bloqueId=${bloque.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Agregar departamento
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {departamentosRegistrados?.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.nombre}</p>
                    <p className="text-sm text-slate-300">
                      {item.username} · {item.email}
                    </p>
                  </div>
                  <Link
                    href={`/superadmin/vecinos/${item.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}

            {(!departamentosRegistrados || departamentosRegistrados.length === 0) && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300">
                No hay departamentos para este bloque.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <h2 className="text-2xl font-bold text-white">Departamentos</h2>
        <p className="mt-1 text-sm text-slate-300">
          {departamentos?.length ?? 0} departamento(s) dentro de este bloque
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {departamentos?.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
            >
              {item.numero}
            </div>
          ))}

          {(!departamentos || departamentos.length === 0) && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300 sm:col-span-2 xl:col-span-3">
              No hay departamentos cargados para este bloque.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
