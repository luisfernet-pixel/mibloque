import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

async function crearCategoria(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

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
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Gastos
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Categorías
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Crea, edita y organiza las categorías usadas en los gastos del bloque.
            </p>

            <div className="mt-8">
              <Link
                href="/admin/gastos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Volver a gastos
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">
              Resumen
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Estado actual
            </p>

            <div className="mt-5 grid gap-3">
              <InfoBox
                label="Categorías registradas"
                value={String(categorias.length)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Nueva categoría
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Crear categoría
          </h2>
        </div>

        <div className="p-5 md:p-6">
          <form action={crearCategoria} className="flex flex-col gap-4 md:flex-row">
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ejemplo: Ascensor"
              className="flex-1 rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
            />

            <button
              type="submit"
              className="rounded-2xl bg-[#ff5a3d] px-6 py-3 font-bold text-white transition hover:brightness-110"
            >
              Guardar
            </button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Lista actual
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Categorías registradas
            </h2>
          </div>

          <div className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {categorias.length} categoría(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {categorias.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] p-6 text-center text-slate-300">
              No hay categorías registradas.
            </div>
          ) : (
            <div className="space-y-4">
              {categorias.map((item) => {
                const enEdicion = editarId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 shadow-lg"
                  >
                    {enEdicion ? (
                      <form action={editarCategoria} className="space-y-4">
                        <input type="hidden" name="id" value={item.id} />

                        <input
                          type="text"
                          name="nombre"
                          defaultValue={item.nombre}
                          required
                          className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                        />

                        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
                          <a
                            href="/admin/gastos/categorias"
                            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                          >
                            Cancelar
                          </a>

                          <button
                            type="submit"
                            className="rounded-2xl bg-[#ff5a3d] px-5 py-3 font-bold text-white transition hover:brightness-110"
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xl font-bold text-white">
                            {item.nombre}
                          </p>

                          <p className="mt-1 text-sm text-slate-300">
                            Creada el{" "}
                            {new Date(item.created_at).toLocaleDateString("es-BO")}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <a
                            href={`/admin/gastos/categorias?editar=${item.id}`}
                            className="rounded-2xl bg-cyan-500 px-4 py-2 font-bold text-white transition hover:bg-cyan-400"
                          >
                            Editar
                          </a>

                          <form action={eliminarCategoria}>
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
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
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}