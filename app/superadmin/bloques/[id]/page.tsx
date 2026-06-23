import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BlockCreateForm from "@/app/superadmin/_components/block-create-form";
import ConfirmActionButton from "@/app/superadmin/_components/confirm-action-button";
import {
  deleteAdminActionForm,
  activateBlockActionForm,
  deleteBlockActionForm,
  purgeBlockActionForm,
  deleteVecinoActionForm,
  updateBlockAction,
} from "@/app/superadmin/actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ blockok?: string | string[]; blockmsg?: string | string[] }>;
};

type DepartamentoRow = {
  id: string;
  numero: string;
  activo: boolean;
};

type VecinoRow = {
  id: string;
  nombre: string;
  username: string;
  email: string;
  activo: boolean;
  departamento_id: string | null;
  created_at: string | null;
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

export const metadata: Metadata = {
  title: "Bloque",
};

export default async function BlockDetailPage({ params, searchParams }: Props) {
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

  const [{ data: bloque }, { data: blockConfig }, { data: admins }, { data: departamentosData }, { data: vecinosData }] =
    await Promise.all([
      supabase
        .from("bloques")
        .select("id, nombre, codigo, activo, created_at")
        .eq("id", id)
        .single(),
      supabase
        .from("configuracion_bloque")
        .select("cuota_mensual, dia_vencimiento, valor_mora, saldo_inicial")
        .eq("bloque_id", id)
        .maybeSingle(),
      supabase
        .from("usuarios")
        .select("id, nombre, email, activo, created_at")
        .eq("rol", "admin")
        .eq("bloque_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("departamentos")
        .select("id, numero, activo")
        .eq("bloque_id", id),
      supabase
        .from("usuarios")
        .select("id, nombre, username, email, activo, departamento_id, created_at")
        .eq("rol", "vecino")
        .eq("bloque_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!bloque) notFound();

  const departamentosRegistrados = (departamentosData ?? []) as DepartamentoRow[];
  const vecinosRegistrados = (vecinosData ?? []) as VecinoRow[];

  const deptosOrdenados = [...departamentosRegistrados].sort(
    (a, b) => deptoSortValue(String(b.numero || "")) - deptoSortValue(String(a.numero || ""))
  );

  const vecinoPorDepartamento = new Map<string, VecinoRow>();
  for (const vecino of vecinosRegistrados) {
    const key = String(vecino.departamento_id || "");
    if (!key || vecinoPorDepartamento.has(key)) continue;
    vecinoPorDepartamento.set(key, vecino);
  }

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
        <h1 className="mt-2 text-lg font-bold text-white md:text-3xl">{bloque.nombre}</h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Aqui editas el bloque y administras sus cuentas sin salir de la ficha.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/superadmin/admins/nuevo?bloqueId=${bloque.id}`}
            className="btn-primary inline-flex rounded-2xl px-3.5 py-2 text-sm font-bold"
          >
            Crear admin
          </Link>
          <Link
            href={`/superadmin/vecinos/nuevo?bloqueId=${bloque.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Crear departamento
          </Link>
          <Link
            href="/superadmin"
            className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Volver al panel
          </Link>
        </div>
      </section>

      <section className="theme-panel rounded-[24px] p-6 shadow-xl ring-1 ring-white/10">
        <BlockCreateForm
          action={updateBlockAction}
          submitLabel="Guardar cambios"
          initialValues={{
            id: bloque.id,
            nombre: bloque.nombre,
            codigo: bloque.codigo,
            activo: bloque.activo,
            cuota_mensual: Number(blockConfig?.cuota_mensual ?? 0),
            dia_vencimiento: Number(blockConfig?.dia_vencimiento ?? 15),
            valor_mora: Number(blockConfig?.valor_mora ?? 0),
            saldo_inicial: Number(blockConfig?.saldo_inicial ?? 0),
          }}
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="flex flex-wrap gap-3">
            {bloque.activo ? (
              <form action={deleteBlockActionForm}>
                <input type="hidden" name="id" value={bloque.id} />
                <input type="hidden" name="return_to" value={`/superadmin/bloques/${bloque.id}`} />
                <ConfirmActionButton
                  confirmText="Desactivar este bloque? Dejara de aparecer para vecinos y admins."
                  className="rounded-2xl border border-red-300/30 bg-red-500/10 px-3.5 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20"
                >
                  Desactivar bloque
                </ConfirmActionButton>
              </form>
            ) : (
              <form action={activateBlockActionForm}>
                <input type="hidden" name="id" value={bloque.id} />
                <input type="hidden" name="return_to" value={`/superadmin/bloques/${bloque.id}`} />
                <ConfirmActionButton
                  confirmText="Activar este bloque? Volvera a aparecer para vecinos y admins."
                  className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-3.5 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Activar bloque
                </ConfirmActionButton>
              </form>
            )}

            <form action={purgeBlockActionForm}>
              <input type="hidden" name="id" value={bloque.id} />
              <input type="hidden" name="return_to" value={`/superadmin/bloques/${bloque.id}`} />
              <ConfirmActionButton
                confirmText="Eliminar este bloque y borrar todos sus datos (vecinos, admins, departamentos, cuotas, pagos y avisos). Esta accion no se puede deshacer. Continuar?"
                secondConfirmText="Confirmacion final: se eliminara todo el edificio y toda su informacion. Deseas borrarlo definitivamente?"
                className="rounded-2xl bg-[#ff5a3d] px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-110"
              >
                Eliminar bloque
              </ConfirmActionButton>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="theme-panel rounded-[24px] p-6 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Admins del bloque</h2>
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

        <div className="theme-panel rounded-[24px] p-6 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Departamentos del bloque</h2>
              <p className="mt-1 text-sm text-slate-300">{departamentosRegistrados.length} departamento(s)</p>
            </div>
            <Link
              href={`/superadmin/vecinos/nuevo?bloqueId=${bloque.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Agregar departamento
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {deptosOrdenados.map((item) => {
              const vecinoAsignado = vecinoPorDepartamento.get(item.id);

              return (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-cyan-200">Depto {item.numero}</p>
                      {vecinoAsignado ? (
                        <>
                          <p className="text-sm text-white/90">{vecinoAsignado.nombre}</p>
                          <p className="text-sm text-slate-300">
                            {vecinoAsignado.username} - {vecinoAsignado.email}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-white/90">Sin vecino asignado</p>
                          <p className="text-sm text-slate-300">Estructura copiada, lista para usar.</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {vecinoAsignado ? (
                        <>
                          <Link
                            href={`/superadmin/vecinos/${vecinoAsignado.id}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            Editar
                          </Link>
                          {vecinoAsignado.activo ? (
                            <form action={deleteVecinoActionForm}>
                              <input type="hidden" name="id" value={vecinoAsignado.id} />
                              <ConfirmActionButton
                                confirmText="Borrar este departamento? Perdera acceso al sistema."
                                className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                              >
                                Borrar
                              </ConfirmActionButton>
                            </form>
                          ) : null}
                        </>
                      ) : (
                        <Link
                          href={`/superadmin/departamentos/${item.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Editar depto
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

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