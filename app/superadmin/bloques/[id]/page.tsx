import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BlockCreateForm from "@/app/superadmin/_components/block-create-form";
import ConfirmActionButton from "@/app/superadmin/_components/confirm-action-button";
import {
  deleteAdminActionForm,
  deleteBlockActionForm,
  deleteVecinoActionForm,
  updateBlockAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
};

function deptoNumeroFromUsername(username: string) {
  const raw = String(username || "").trim();
  const parte = raw.includes("-") ? raw.split("-").pop() ?? "" : raw;
  const numero = Number(parte.trim());
  if (!Number.isFinite(numero)) return null;
  return numero;
}

export const metadata: Metadata = {
  title: "Bloque",
};

export default async function BlockDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: bloque }, { data: admins }, { data: departamentosRegistrados }] =
    await Promise.all([
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
    ]);

  if (!bloque) notFound();

  const deptosOrdenados = [...(departamentosRegistrados ?? [])].sort((a, b) => {
    const aNum = deptoNumeroFromUsername(a.username);
    const bNum = deptoNumeroFromUsername(b.username);
    if (aNum !== null && bNum !== null) return bNum - aNum;
    if (aNum !== null) return -1;
    if (bNum !== null) return 1;
    return String(a.username || "").localeCompare(String(b.username || ""), "es", {
      numeric: true,
      sensitivity: "base",
    });
  });

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Superadmin</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">{bloque.nombre}</h1>
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
            href="/superadmin"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Volver al panel
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
            <ConfirmActionButton
              confirmText="Borrar este bloque? Esta accion lo dejara inactivo."
              className="rounded-2xl bg-[#ff5a3d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Borrar bloque
            </ConfirmActionButton>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Admins del bloque</h2>
              <p className="mt-1 text-sm text-slate-300">{admins?.length ?? 0} administrador(es)</p>
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
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.nombre}</p>
                    <p className="text-sm text-slate-300">{item.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/superadmin/admins/${item.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Editar
                    </Link>
                    {item.activo ? (
                      <form action={deleteAdminActionForm}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmActionButton
                          confirmText="Borrar este admin? Perdera acceso al sistema."
                          className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                        >
                          Borrar
                        </ConfirmActionButton>
                      </form>
                    ) : null}
                  </div>
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
            {deptosOrdenados.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-cyan-200">
                      Depto {item.username?.includes("-") ? item.username.split("-").pop() : item.username}
                    </p>
                    <p className="text-sm text-white/90">{item.nombre}</p>
                    <p className="text-sm text-slate-300">{item.username} - {item.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/superadmin/vecinos/${item.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Editar
                    </Link>
                    {item.activo ? (
                      <form action={deleteVecinoActionForm}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmActionButton
                          confirmText="Borrar este departamento? Perdera acceso al sistema."
                          className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                        >
                          Borrar
                        </ConfirmActionButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {deptosOrdenados.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300">
                No hay departamentos para este bloque.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
