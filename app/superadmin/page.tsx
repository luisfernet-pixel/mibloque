import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfirmActionButton from "@/app/superadmin/_components/confirm-action-button";
import { deleteBlockActionForm } from "@/app/superadmin/actions";

type AdminBrief = {
  id: string;
  nombre: string;
  email: string;
  bloque_id: string;
  activo: boolean;
};

type DeptoBrief = {
  id: string;
  nombre: string;
  username: string;
  email: string;
  bloque_id: string;
  activo: boolean;
};

function extractDeptoNumero(username: string) {
  const raw = String(username || "").trim();
  const segmento = raw.includes("-") ? raw.split("-").pop() ?? "" : raw;
  const limpio = segmento.trim();
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export default async function SuperadminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [{ data: bloques }, { data: departamentos }, { data: adminsData }, { data: deptosData }] =
    await Promise.all([
      supabase.from("bloques").select("id, nombre, codigo, activo, created_at"),
      supabase.from("departamentos").select("id"),
      supabase
        .from("usuarios")
        .select("id, nombre, email, bloque_id, activo")
        .eq("rol", "admin"),
      supabase
        .from("usuarios")
        .select("id, nombre, username, email, bloque_id, activo")
        .eq("rol", "vecino"),
    ]);

  const totalBloques = bloques?.length || 0;
  const totalDeptos = departamentos?.length || 0;
  const admins = (adminsData ?? []) as AdminBrief[];
  const deptos = (deptosData ?? []) as DeptoBrief[];

  const bloquesOrdenados = [...(bloques ?? [])].sort((a, b) => {
    const codigoA = String(a.codigo ?? "").trim();
    const codigoB = String(b.codigo ?? "").trim();
    const numeroA = Number(codigoA);
    const numeroB = Number(codigoB);
    const esNumeroA = codigoA !== "" && Number.isFinite(numeroA);
    const esNumeroB = codigoB !== "" && Number.isFinite(numeroB);

    if (esNumeroA && esNumeroB) return numeroA - numeroB;
    if (esNumeroA) return -1;
    if (esNumeroB) return 1;

    return codigoA.localeCompare(codigoB, "es", {
      numeric: true,
      sensitivity: "base",
    });
  });

  const adminsPorBloque = new Map<string, AdminBrief[]>();
  for (const admin of admins) {
    const key = String(admin.bloque_id || "");
    if (!key) continue;
    const list = adminsPorBloque.get(key) ?? [];
    list.push(admin);
    adminsPorBloque.set(key, list);
  }

  const deptosPorBloque = new Map<string, DeptoBrief[]>();
  for (const depto of deptos) {
    const key = String(depto.bloque_id || "");
    if (!key) continue;
    const list = deptosPorBloque.get(key) ?? [];
    list.push(depto);
    deptosPorBloque.set(key, list);
  }

  return (
    <main className="min-h-screen bg-[#324359] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-[#071426] p-8">
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PANEL MAESTRO</p>
              <h1 className="mt-3 text-4xl font-bold text-white">SuperAdmin MiBloque</h1>
              <p className="mt-4 max-w-2xl text-slate-300">
                Control total de bloques, administradores y crecimiento comercial de la
                plataforma.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Estado general</p>
              <div className="mt-4 text-4xl font-bold text-white">{totalBloques}</div>
              <p className="text-slate-300">Bloques activos en sistema</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card titulo="Bloques" valor={String(totalBloques)} />
          <Card titulo="Departamentos" valor={String(totalDeptos)} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/10">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">BLOQUES REGISTRADOS</p>
              <h2 className="text-2xl font-bold text-white">Lista operativa</h2>
            </div>

            <Link
              href="/superadmin/bloques/nuevo"
              className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-black"
            >
              Nuevo bloque
            </Link>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {bloquesOrdenados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center text-slate-300">
                No hay bloques registrados todavia.
              </div>
            ) : (
              bloquesOrdenados.map((item) => {
                const adminsDelBloque = adminsPorBloque.get(item.id) ?? [];
                const deptosDelBloque = deptosPorBloque.get(item.id) ?? [];
                const deptosOrdenados = [...deptosDelBloque].sort((a, b) => {
                  const numA = extractDeptoNumero(a.username);
                  const numB = extractDeptoNumero(b.username);
                  if (numA !== null && numB !== null) return numB - numA;
                  if (numA !== null) return -1;
                  if (numB !== null) return 1;
                  return String(a.username).localeCompare(String(b.username), "es", {
                    numeric: true,
                    sensitivity: "base",
                  });
                });

                return (
                  <details
                    key={item.id}
                    className="group rounded-2xl border border-white/15 bg-[#2d4a6c] p-4 md:p-5"
                  >
                    <summary className="list-none cursor-pointer">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
                        <div>
                          <p className="text-sm text-slate-300">Bloque</p>
                          <p className="mt-1 text-xl font-bold text-white">{item.nombre}</p>
                          <p className="text-sm text-slate-300">Codigo: {item.codigo}</p>
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

                        <div className="self-center md:justify-self-end">
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
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/superadmin/bloques/${item.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Editar bloque
                        </Link>
                        {item.activo ? (
                          <form action={deleteBlockActionForm}>
                            <input type="hidden" name="id" value={item.id} />
                            <ConfirmActionButton
                              confirmText="Borrar este bloque? Esta accion lo dejara inactivo."
                              className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                            >
                              Borrar bloque
                            </ConfirmActionButton>
                          </form>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-bold text-white">
                            Admins del bloque ({adminsDelBloque.length})
                          </p>
                          <div className="mt-3 space-y-2">
                            {adminsDelBloque.length === 0 ? (
                              <p className="text-sm text-slate-300">Sin admins registrados.</p>
                            ) : (
                              adminsDelBloque.map((admin) => (
                                <div
                                  key={admin.id}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                                >
                                  <p className="text-sm font-semibold text-white">{admin.nombre}</p>
                                  <p className="text-xs text-slate-300">{admin.email}</p>
                                </div>
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
                                const numeroDepto = depto.username.includes("-")
                                  ? depto.username.split("-").pop()
                                  : depto.username;
                                return (
                                <div
                                  key={depto.id}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                                >
                                  <p className="text-lg font-extrabold text-cyan-200">
                                    Depto {numeroDepto}
                                  </p>
                                  <p className="text-sm text-white/90">{depto.nombre}</p>
                                  <p className="text-xs text-slate-300">
                                    {depto.username} - {depto.email}
                                  </p>
                                </div>
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
    <div className="rounded-3xl border border-cyan-400/20 bg-[#20354d] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{titulo}</p>
      <p className="mt-3 text-4xl font-bold text-white">{valor}</p>
    </div>
  );
}
