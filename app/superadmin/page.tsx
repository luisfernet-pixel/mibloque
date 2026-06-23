import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfirmActionButton from "@/app/superadmin/_components/confirm-action-button";
import {
  activateBlockActionForm,
  deleteBlockActionForm,
  duplicateBlockActionForm,
  purgeBlockActionForm,
} from "@/app/superadmin/actions";
import { getAuthUserSafe } from "@/lib/auth";

type AdminBrief = {
  id: string;
  nombre: string;
  email: string;
  bloque_id: string;
  activo: boolean;
};

type DepartamentoBrief = {
  id: string;
  numero: string;
  bloque_id: string;
  activo: boolean;
};

type VecinoBrief = {
  id: string;
  nombre: string;
  username: string;
  email: string;
  bloque_id: string;
  departamento_id: string | null;
  activo: boolean;
};

function deptoSortValue(value: string) {
  const raw = String(value || "").trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const digits = raw.match(/\d+/g)?.join("");
  const parsedDigits = Number(digits || "");
  if (Number.isFinite(parsedDigits) && digits) return parsedDigits;
  return Number.MAX_SAFE_INTEGER;
}

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams?: Promise<{ blockok?: string | string[]; blockmsg?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const blockokRaw = Array.isArray(params.blockok)
    ? String(params.blockok[0] || "")
    : String(params.blockok || "");
  const blockmsg = Array.isArray(params.blockmsg)
    ? String(params.blockmsg[0] || "")
    : String(params.blockmsg || "");
  const showBlockMsg = blockmsg.trim().length > 0;
  const isBlockOk = blockokRaw === "1";

  const supabase = await createClient();
  const user = await getAuthUserSafe(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "superadmin") {
    redirect("/login");
  }

  const [{ data: bloques }, { data: departamentosData }, { data: adminsData }, { data: vecinosData }] =
    await Promise.all([
      supabase.from("bloques").select("id, nombre, codigo, activo, created_at"),
      supabase.from("departamentos").select("id, numero, bloque_id, activo"),
      supabase
        .from("usuarios")
        .select("id, nombre, email, bloque_id, activo")
        .eq("rol", "admin"),
      supabase
        .from("usuarios")
        .select("id, nombre, username, email, bloque_id, departamento_id, activo")
        .eq("rol", "vecino"),
    ]);

  const totalBloques = bloques?.length || 0;
  const totalBloquesActivos = (bloques ?? []).filter((item) => item.activo).length;
  const totalDeptos = departamentosData?.length || 0;
  const admins = (adminsData ?? []) as AdminBrief[];
  const departamentos = (departamentosData ?? []) as DepartamentoBrief[];
  const vecinos = (vecinosData ?? []) as VecinoBrief[];

  const bloquesOrdenados = [...(bloques ?? [])].sort((a, b) =>
    String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es", {
      numeric: true,
      sensitivity: "base",
    })
  );

  const adminsPorBloque = new Map<string, AdminBrief[]>();
  for (const admin of admins) {
    const key = String(admin.bloque_id || "");
    if (!key) continue;
    const list = adminsPorBloque.get(key) ?? [];
    list.push(admin);
    adminsPorBloque.set(key, list);
  }

  const deptosPorBloque = new Map<string, DepartamentoBrief[]>();
  for (const depto of departamentos) {
    const key = String(depto.bloque_id || "");
    if (!key) continue;
    const list = deptosPorBloque.get(key) ?? [];
    list.push(depto);
    deptosPorBloque.set(key, list);
  }

  const vecinoPorDepartamento = new Map<string, VecinoBrief>();
  for (const vecino of vecinos) {
    const key = String(vecino.departamento_id || "");
    if (!key || vecinoPorDepartamento.has(key)) continue;
    vecinoPorDepartamento.set(key, vecino);
  }

  return (
    <main className="min-h-screen bg-[#324359] px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-3">
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
        <section className="rounded-2xl border border-white/10 bg-[#071426] p-4 md:hidden">
          <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Panel maestro</p>
          <h1 className="mt-2 text-xl font-bold text-white">SuperAdmin KUBO</h1>
          <p className="mt-2 text-sm text-slate-300">
            Bloques: {totalBloques} - Departamentos: {totalDeptos}
          </p>

          <details className="group mt-3 rounded-2xl border border-white/15 bg-white/5 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-cyan-100">
              Ver detalle
              <span className="inline-flex rounded-full border border-cyan-300/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] group-open:hidden">
                Abrir
              </span>
              <span className="hidden rounded-full border border-white/30 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] group-open:inline-flex">
                Cerrar
              </span>
            </summary>

            <p className="mt-3 text-sm text-slate-200">
              Control total de bloques, administradores y crecimiento de la plataforma.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Card titulo="Bloques" valor={String(totalBloques)} />
              <Card titulo="Departamentos" valor={String(totalDeptos)} />
            </div>

            <div className="mt-3">
              <Link
                href="/superadmin/bloques/nuevo"
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-cyan-500 px-4 text-xs font-semibold text-black sm:w-auto"
              >
                Nuevo bloque
              </Link>
            </div>
          </details>
        </section>

        <section className="hidden rounded-3xl border border-white/10 bg-[#071426] p-8 md:block">
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PANEL MAESTRO</p>
              <h1 className="mt-3 text-4xl font-bold text-white">SuperAdmin KUBO</h1>
              <p className="mt-4 max-w-2xl text-slate-300">
                Control total de bloques, administradores y crecimiento comercial de la plataforma.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Estado general</p>
              <div className="mt-4 text-4xl font-bold text-white">{totalBloquesActivos}</div>
              <p className="text-slate-300">Bloques activos en sistema</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <Card titulo="Bloques" valor={String(totalBloques)} />
          <Card titulo="Departamentos" valor={String(totalDeptos)} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/10">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">BLOQUES REGISTRADOS</p>
              <h2 className="text-xl font-bold text-white">Bloques registrados</h2>
            </div>

            <Link
              href="/superadmin/bloques/nuevo"
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-black sm:w-auto"
            >
              Nuevo bloque
            </Link>
          </div>

          <div className="space-y-3 p-4 md:p-4">
            {bloquesOrdenados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center text-slate-300">
                No hay bloques registrados todavia.
              </div>
            ) : (
              bloquesOrdenados.map((item) => {
                const adminsDelBloque = adminsPorBloque.get(item.id) ?? [];
                const deptosDelBloque = deptosPorBloque.get(item.id) ?? [];
                const deptosOrdenados = [...deptosDelBloque].sort(
                  (a, b) => deptoSortValue(String(b.numero || "")) - deptoSortValue(String(a.numero || ""))
                );

                return (
                  <details
                    key={item.id}
                    className="group rounded-2xl border border-white/15 bg-[#2d4a6c] p-4 md:p-4"
                  >
                    <summary className="list-none cursor-pointer">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] xl:items-end">
                        <div>
                          <p className="text-sm text-slate-300">Bloque</p>
                          <p className="mt-1 text-xl font-bold text-white">{item.nombre}</p>
                          <p className="text-sm text-slate-300">
                            Admin: {adminsDelBloque[0]?.nombre ?? "Sin admin"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-self-start">
                          {item.activo ? (
                            <form action={deleteBlockActionForm}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="return_to" value="/superadmin" />
                              <ConfirmActionButton
                                confirmText="Desactivar este bloque? Dejara de aparecer para vecinos y admins."
                                className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                              >
                                Desactivar
                              </ConfirmActionButton>
                            </form>
                          ) : (
                            <form action={activateBlockActionForm}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="return_to" value="/superadmin" />
                              <ConfirmActionButton
                                confirmText="Activar este bloque? Volvera a aparecer para vecinos y admins."
                                className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                              >
                                Activar
                              </ConfirmActionButton>
                            </form>
                          )}
                          <Link
                            href={`/superadmin/bloques/${item.id}`}
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                          >
                            Editar
                          </Link>
                          <form action={duplicateBlockActionForm}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="return_to" value="/superadmin" />
                            <ConfirmActionButton
                              confirmText="Duplicar este bloque? Se creara un bloque nuevo con la misma numeracion de departamentos, pero sin vecinos ni datos de vecinos."
                              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                            >
                              Duplicar
                            </ConfirmActionButton>
                          </form>
                          <form action={purgeBlockActionForm}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="return_to" value="/superadmin" />
                            <ConfirmActionButton
                              confirmText="Eliminar este bloque y borrar todos sus datos (vecinos, admins, departamentos, cuotas, pagos y avisos). Esta accion no se puede deshacer. Continuar?"
                              secondConfirmText="Confirmacion final: se eliminara todo el edificio y toda su informacion. Deseas borrarlo definitivamente?"
                              className="rounded-xl border border-red-200/30 bg-[#ff5a3d]/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-[#ff5a3d]/20"
                            >
                              Eliminar
                            </ConfirmActionButton>
                          </form>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Estado</p>
                          <p className="mt-1 text-base font-bold text-white">
                            {item.activo ? "Activo" : "Pausado"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Admins</p>
                          <p className="mt-1 text-base font-bold text-white">{adminsDelBloque.length}</p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Deptos</p>
                          <p className="mt-1 text-base font-bold text-white">{deptosDelBloque.length}</p>
                        </div>

                        <div className="self-center xl:justify-self-end">
                          <span className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-sm font-bold text-cyan-100 transition group-open:hidden">
                            Ampliar
                          </span>
                          <span className="hidden min-h-[40px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition group-open:inline-flex">
                            Reducir
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-bold text-white">
                            Admins del bloque ({adminsDelBloque.length})
                          </p>
                          <div className="mt-3 space-y-2">
                            {adminsDelBloque.length === 0 ? (
                              <p className="text-sm text-slate-300">Sin admins registrados.</p>
                            ) : (
                              adminsDelBloque.map((admin) => (
                                <Link
                                  key={admin.id}
                                  href={`/superadmin/admins/${admin.id}`}
                                  className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                                >
                                  <p className="text-sm font-semibold text-white">{admin.nombre}</p>
                                  <p className="text-xs text-slate-300">{admin.email}</p>
                                </Link>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-bold text-white">
                            Departamentos del bloque ({deptosOrdenados.length})
                          </p>
                          <div className="mt-3 space-y-2">
                            {deptosOrdenados.length === 0 ? (
                              <p className="text-sm text-slate-300">Sin departamentos registrados.</p>
                            ) : (
                              deptosOrdenados.map((depto) => {
                                const vecinoAsignado = vecinoPorDepartamento.get(depto.id);

                                if (vecinoAsignado) {
                                  return (
                                    <Link
                                      key={depto.id}
                                      href={`/superadmin/vecinos/${vecinoAsignado.id}`}
                                      className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                                    >
                                      <p className="text-lg font-extrabold text-cyan-200">Depto {depto.numero}</p>
                                      <p className="text-sm text-white/90">{vecinoAsignado.nombre}</p>
                                      <p className="text-xs text-slate-300">
                                        {vecinoAsignado.username} - {vecinoAsignado.email}
                                      </p>
                                    </Link>
                                  );
                                }

                                return (
                                  <Link
                                    key={depto.id}
                                    href={`/superadmin/departamentos/${depto.id}`}
                                    className="block rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                                  >
                                    <p className="text-lg font-extrabold text-cyan-200">Depto {depto.numero}</p>
                                    <p className="text-sm text-white/90">Sin vecino asignado</p>
                                    <p className="text-xs text-slate-300">Abrir estructura del depto.</p>
                                  </Link>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-[#20354d] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{titulo}</p>
      <p className="mt-3 text-4xl font-bold text-white">{valor}</p>
    </div>
  );
}
