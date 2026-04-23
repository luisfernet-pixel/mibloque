import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

async function crearAviso(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();

  if (!titulo || !mensaje) {
    redirect("/admin/avisos");
  }

  const supabase = await createClient();

  await supabase.from("avisos").insert({
    bloque_id: usuario.perfil.bloque_id,
    titulo,
    mensaje,
    publicado: true,
  });

  redirect("/admin/avisos");
}

async function editarAviso(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const id = String(formData.get("id") || "");
  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();

  if (!id || !titulo || !mensaje) {
    redirect("/admin/avisos");
  }

  const supabase = await createClient();

  await supabase
    .from("avisos")
    .update({
      titulo,
      mensaje,
    })
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/avisos");
}

async function eliminarAviso(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/avisos");

  const supabase = await createClient();

  await supabase
    .from("avisos")
    .delete()
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/avisos");
}

export default async function AdminAvisosPage({
  searchParams,
}: {
  searchParams?: Promise<{ editar?: string }>;
}) {
  const usuario = await requireAdmin();

  if (!usuario) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const editarId = params.editar || "";

  const supabase = await createClient();

  const { data: avisos } = await supabase
    .from("avisos")
    .select("id, titulo, mensaje, created_at")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Comunicación del bloque
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Avisos
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Publica mensajes importantes para que los vecinos estén informados
              de forma clara, rápida y ordenada.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Recomendación
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Antes de publicar
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <TipBox text="Usa títulos cortos y claros para que el vecino entienda rápido." />
              <TipBox text="Escribe el mensaje con fecha, hora y detalle si aplica." />
              <TipBox text="Publica solo información realmente útil para evitar saturación." />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Nuevo aviso
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Publicar comunicado
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Este aviso se mostrará a los vecinos del bloque.
            </p>
          </div>

          <div className="w-fit rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
            Publicación directa
          </div>
        </div>

        <div className="p-5 md:p-6">
          <form action={crearAviso} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-100">
                Título
              </label>
              <input
                name="titulo"
                placeholder="Ejemplo: Corte de agua este viernes"
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-100">
                Mensaje
              </label>
              <textarea
                name="mensaje"
                placeholder="Escribe aquí el aviso para los vecinos"
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
                required
              />
            </div>

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                type="submit"
                className="rounded-2xl bg-[#ff5a3d] px-6 py-3 font-bold text-white transition hover:brightness-110"
              >
                Publicar aviso
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Historial
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Avisos publicados
            </h2>
          </div>

          <div className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {avisos?.length ?? 0} aviso(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {avisos?.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] p-6 text-center text-slate-300">
              No hay avisos publicados.
            </div>
          ) : (
            <div className="space-y-4">
              {avisos.map((item) => {
                const enEdicion = editarId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 shadow-lg"
                  >
                    {enEdicion ? (
                      <form action={editarAviso} className="space-y-5">
                        <input type="hidden" name="id" value={item.id} />

                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-300">
                              Editando aviso
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              {new Date(item.created_at).toLocaleDateString("es-BO")}
                            </p>
                          </div>

                          <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
                            Edición
                          </span>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Título
                          </label>
                          <input
                            name="titulo"
                            defaultValue={item.titulo}
                            className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Mensaje
                          </label>
                          <textarea
                            name="mensaje"
                            defaultValue={item.mensaje}
                            rows={5}
                            className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                            required
                          />
                        </div>

                        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
                          <a
                            href="/admin/avisos"
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
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-white">
                              {item.titulo}
                            </h3>

                            <p className="mt-2 text-sm text-slate-300">
                              {new Date(item.created_at).toLocaleDateString("es-BO")}
                            </p>
                          </div>

                          <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                            Publicado
                          </span>
                        </div>

                        <div className="mt-4 rounded-2xl bg-[#1d3551] p-4 ring-1 ring-white/10">
                          <p className="whitespace-pre-line text-slate-100">
                            {item.mensaje}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
                          <a
                            href={`/admin/avisos?editar=${item.id}`}
                            className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-white transition hover:bg-cyan-400"
                          >
                            Editar
                          </a>

                          <form action={eliminarAviso}>
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                            >
                              Eliminar
                            </button>
                          </form>
                        </div>
                      </>
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

function TipBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-sm leading-6 text-slate-100">{text}</p>
    </div>
  );
}