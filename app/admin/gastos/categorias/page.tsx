import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isBloqueActivo, requireAdmin } from "@/lib/auth";

async function crearCategoria(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/categorias");

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/admin/gastos/categorias");

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("categorias_gasto")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .ilike("nombre", nombre)
    .maybeSingle();

  if (!existente) {
    await supabase.from("categorias_gasto").insert({
      bloque_id: usuario.perfil.bloque_id,
      nombre,
    });
  }

  redirect("/admin/gastos/categorias");
}

async function editarCategoria(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/categorias");

  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (!id || !nombre) redirect("/admin/gastos/categorias");

  const supabase = await createClient();

  await supabase
    .from("categorias_gasto")
    .update({
      nombre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/gastos/categorias");
}

async function eliminarCategoria(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/categorias");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/gastos/categorias");

  const supabase = await createClient();

  await supabase
    .from("categorias_gasto")
    .delete()
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/gastos/categorias");
}

type CategoriaRow = {
  id: string;
  nombre: string;
  created_at: string;
};

export default async function CategoriasGastoPage({
  searchParams,
}: {
  searchParams?: Promise<{ editar?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/categorias");

  const params = (await searchParams) ?? {};
  const editarId = params.editar || "";

  const supabase = await createClient();

  const { data } = await supabase
    .from("categorias_gasto")
    .select("id, nombre, created_at")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .order("nombre", { ascending: true });

  const categorias = (data ?? []) as CategoriaRow[];

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                  Gastos
                </p>
                <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
                  Categorias
                </h1>
              </div>

              <Link
                href="/admin/gastos"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Volver a gastos
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-sm font-semibold text-white">Resumen</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Estado actual
            </p>

            <div className="mt-3">
              <InfoBox label="Categorias registradas" value={String(categorias.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3 md:px-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Nueva categoria
          </p>
          <h2 className="mt-1.5 text-lg font-bold text-white">Crear categoria</h2>
        </div>

        <div className="p-3 md:p-3">
          <form action={crearCategoria} className="flex items-center gap-2">
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ejemplo: Ascensor"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-[#173454] px-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
            />

            <button
              type="submit"
              className="h-11 rounded-xl bg-[#ff5a3d] px-5 text-sm font-bold text-white transition hover:brightness-110"
            >
              Guardar
            </button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Lista actual
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-white">Categorias registradas</h2>
          </div>

          <div className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
            {categorias.length} categoria(s)
          </div>
        </div>

        <div className="p-3 md:p-3">
          {categorias.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-5 text-center text-slate-300">
              No hay categorias registradas.
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((item) => {
                const enEdicion = editarId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/20 bg-[#2d4a6c] px-3 py-2 shadow-lg"
                  >
                    {enEdicion ? (
                      <form action={editarCategoria} className="space-y-2">
                        <input type="hidden" name="id" value={item.id} />

                        <input
                          type="text"
                          name="nombre"
                          defaultValue={item.nombre}
                          required
                          className="h-10 w-full rounded-xl border border-white/10 bg-[#173454] px-3 text-white outline-none transition focus:border-cyan-400/40"
                        />

                        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                          <a
                            href="/admin/gastos/categorias"
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                          >
                            Cancelar
                          </a>

                          <button
                            type="submit"
                            className="rounded-lg bg-[#ff5a3d] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-white">{item.nombre}</p>
                          <p className="mt-0.5 text-xs text-slate-300">
                            {new Date(item.created_at).toLocaleDateString("es-BO")}
                          </p>
                        </div>

                        <div className="flex flex-nowrap gap-2">
                          <a
                            href={`/admin/gastos/categorias?editar=${item.id}`}
                            className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cyan-400"
                          >
                            Editar
                          </a>

                          <form action={eliminarCategoria}>
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                            >
                              Eliminar
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#3a5879] p-3 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}


