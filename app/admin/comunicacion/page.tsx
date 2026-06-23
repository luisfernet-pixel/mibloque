import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isBloqueActivo, requireBlockAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{
  ok?: string;
  error?: string;
  sent?: string;
}>;

type AvisoRow = {
  id: string;
  titulo: string;
  mensaje: string;
  created_at: string;
};

type BuzonRow = {
  id: string;
  tipo: string;
  asunto: string;
  mensaje: string;
  estado: string;
  respuesta: string | null;
  created_at: string;
  respondido_at: string | null;
  departamento_id: string;
  departamento_numero: string | null;
  vecino_nombre: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isCurrentMonth(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

async function crearAviso(formData: FormData) {
  "use server";

  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/comunicacion?error=servicio_suspendido");

  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!titulo || !mensaje) redirect("/admin/comunicacion?error=datos_aviso");

  const supabase = await createClient();
  const { error: avisoError } = await supabase
    .from("avisos")
    .insert({
      bloque_id: usuario.perfil.bloque_id,
      titulo,
      mensaje,
      publicado: true,
    })
    .select("id")
    .maybeSingle();

  if (avisoError) redirect("/admin/comunicacion?error=save_aviso");
  revalidatePath("/admin");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/admin/avisos");
  revalidatePath("/vecino");
  revalidatePath("/vecino/avisos");
  revalidatePath("/vecino/comunicacion");
  redirect("/admin/comunicacion?sent=1");
}

async function responderBuzon(formData: FormData) {
  "use server";

  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/comunicacion?error=servicio_suspendido");

  const id = String(formData.get("id") || "");
  const respuesta = String(formData.get("respuesta") || "").trim();
  if (!id || !respuesta) redirect("/admin/comunicacion?error=datos");

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("buzon_sugerencias")
    .select("id, bloque_id, departamento_id, asunto")
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();

  if (!current) redirect("/admin/comunicacion?error=notfound");

  const ahora = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("buzon_sugerencias")
    .update({
      estado: "respondido",
      respuesta,
      respuesta_leida: false,
      respondido_at: ahora,
      respondido_por: usuario.perfil.id,
    })
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  if (updateError) redirect("/admin/comunicacion?error=save");


  revalidatePath("/admin");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/admin/sugerencias");
  revalidatePath("/vecino");
  revalidatePath("/vecino/sugerencias");
  revalidatePath("/vecino/comunicacion");
  redirect("/admin/comunicacion?ok=1");
}

async function editarAviso(formData: FormData) {
  "use server";
  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/comunicacion?error=servicio_suspendido");
  const id = String(formData.get("id") || "").trim();
  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!id || !titulo || !mensaje) redirect("/admin/comunicacion?error=editar_aviso_datos");
  const supabase = createAdminClient();
  const { error } = await supabase.from("avisos").update({ titulo, mensaje }).eq("id", id).eq("bloque_id", usuario.perfil.bloque_id);
  if (error) redirect("/admin/comunicacion?error=editar_aviso");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/vecino/comunicacion");
  redirect("/admin/comunicacion?ok=aviso_editado");
}

async function eliminarAviso(formData: FormData) {
  "use server";
  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/comunicacion?error=servicio_suspendido");
  const id = String(formData.get("id") || "").trim();
  if (!id) redirect("/admin/comunicacion?error=eliminar_aviso_datos");
  const supabase = createAdminClient();
  const { error } = await supabase.from("avisos").delete().eq("id", id).eq("bloque_id", usuario.perfil.bloque_id);
  if (error) redirect("/admin/comunicacion?error=eliminar_aviso");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/vecino/comunicacion");
  redirect("/admin/comunicacion?ok=aviso_eliminado");
}

export default async function AdminComunicacionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/comunicacion?error=servicio_suspendido");

  const params = await searchParams;
  const supabase = createAdminClient();

  await supabase
    .from("buzon_sugerencias")
    .update({ visto_admin: true })
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("visto_admin", false);

  const [{ data: avisosData }, { data: buzonData, error: buzonError }] = await Promise.all([
    supabase
      .from("avisos")
      .select("id, titulo, mensaje, created_at")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("buzon_sugerencias")
      .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at, departamento_id, departamentos(numero), usuarios!buzon_sugerencias_vecino_id_fkey(nombre)")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const avisos = (avisosData ?? []) as AvisoRow[];
  const avisosMesActual = avisos.filter((item) => isCurrentMonth(item.created_at));
  const avisosHistorial = avisos.filter((item) => !isCurrentMonth(item.created_at));
  const buzon = buzonError
    ? []
    : ((buzonData ?? []).map((item: any) => ({
        ...item,
        departamento_numero: item.departamentos?.numero ? String(item.departamentos.numero) : null,
        vecino_nombre: item.usuarios?.nombre ? String(item.usuarios.nombre) : null,
      })) as BuzonRow[]);
  const pendientes = buzon.filter((item) => item.estado !== "respondido").length;
  const buzonPendiente = buzon.filter((item) => item.estado !== "respondido");
  const buzonHistorial = buzon.filter((item) => item.estado === "respondido");

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Comunicacion</p>
            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">Avisos y mensajes</h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Gestiona en una sola pantalla los avisos del bloque y las sugerencias/reclamos de vecinos.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Resumen</p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              <p>Avisos publicados: <span className="font-bold text-white">{avisos.length}</span></p>
              <p>Pendientes por responder: <span className="font-bold text-white">{pendientes}</span></p>
            </div>
            {params.sent === "1" ? <p className="mt-4 text-sm font-semibold text-cyan-200">Aviso publicado.</p> : null}
            {params.ok === "1" ? <p className="mt-2 text-sm font-semibold text-cyan-200">Respuesta enviada.</p> : null}
            {params.error ? (
              <p className="mt-2 text-sm font-semibold text-red-200">No se pudo procesar la accion ({params.error}).</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-xl font-bold text-white">Avisos</h2>
            <p className="mt-1 text-sm text-slate-300">Publica y revisa los ultimos comunicados.</p>
          </div>

          <div className="space-y-3 p-4">
            <form action={crearAviso} className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#2d4a6c] p-2.5">
              <input
                name="titulo"
                placeholder="Titulo"
                required
                className="h-9 w-[180px] rounded-lg border border-white/10 bg-[#173454] px-3 text-sm text-white outline-none focus:border-cyan-400/40"
              />
              <textarea
                name="mensaje"
                rows={1}
                placeholder="Mensaje del aviso"
                required
                className="h-9 min-h-[36px] flex-1 resize-none rounded-lg border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none transition-[height] duration-150 focus:h-[72px] focus:border-cyan-400/40"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
              >
                Publicar
              </button>
            </form>

            <div className="space-y-2 rounded-xl border border-white/15 bg-[#2d4a6c] p-2.5">
              {avisosMesActual.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/20 bg-[#1d3551] px-3 py-2 text-sm text-slate-300">
                  No hay avisos de este mes.
                </div>
              ) : (
                avisosMesActual.map((item) => (
                  <details key={item.id} className="group rounded-lg border border-white/10 bg-[#1d3551]">
                    <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-3">
                      <span className="h-2 w-2 rounded-full bg-cyan-300" />
                      <p className="truncate text-sm font-bold text-white">{item.titulo}</p>
                      <p className="ml-auto text-xs text-slate-300">{formatDate(item.created_at)}</p>
                      <span className="ml-2 text-sm text-cyan-100 transition-transform duration-200 group-open:rotate-90">{">"}</span>
                    </summary>
                    <div className="border-t border-white/10 px-3 py-2">
                      <p className="mb-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>
                      <form action={editarAviso} className="space-y-2">
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          name="titulo"
                          defaultValue={item.titulo}
                          required
                          className="h-9 w-full rounded-lg border border-white/10 bg-[#173454] px-3 text-sm text-white"
                        />
                        <textarea
                          name="mensaje"
                          defaultValue={item.mensaje}
                          rows={2}
                          required
                          className="w-full rounded-lg border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="submit" className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">Guardar</button>
                          <button formAction={eliminarAviso} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">Eliminar</button>
                        </div>
                      </form>
                    </div>
                  </details>
                ))
              )}
            </div>

            <details className="group rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
              <summary className="list-none cursor-pointer text-sm font-semibold text-cyan-100">
                <span className="inline-flex items-center gap-2">
                  <span className="group-open:hidden">{">"}</span>
                  <span className="hidden group-open:inline">v</span>
                  <span>Historial de avisos ({avisosHistorial.length})</span>
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                {avisosHistorial.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/20 bg-[#1d3551] p-3 text-sm text-slate-300">
                    No hay avisos en historial.
                  </div>
                ) : (
                  avisosHistorial.map((item) => (
                    <details key={item.id} className="group rounded-lg border border-white/10 bg-[#1d3551]">
                      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-3">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                        <p className="truncate text-sm font-bold text-white">{item.titulo}</p>
                        <p className="ml-auto text-xs text-slate-300">{formatDate(item.created_at)}</p>
                        <span className="ml-2 text-sm text-cyan-100 transition-transform duration-200 group-open:rotate-90">{">"}</span>
                      </summary>
                      <div className="border-t border-white/10 px-3 py-2">
                        <p className="mb-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>
                        <form action={editarAviso} className="space-y-2">
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            name="titulo"
                            defaultValue={item.titulo}
                            required
                            className="h-9 w-full rounded-lg border border-white/10 bg-[#173454] px-3 text-sm text-white"
                          />
                          <textarea
                            name="mensaje"
                            defaultValue={item.mensaje}
                            rows={2}
                            required
                            className="w-full rounded-lg border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button type="submit" className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">Guardar</button>
                            <button formAction={eliminarAviso} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">Eliminar</button>
                          </div>
                        </form>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </details>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-xl font-bold text-white">Mensajes de vecinos</h2>
            <p className="mt-1 text-sm text-slate-300">Responde solicitudes de vecinos desde aqui.</p>
          </div>
          <div className="space-y-3 p-4">
            {buzon.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                No hay mensajes en el buzon.
              </div>
            ) : (
              <div className="space-y-1 rounded-xl border border-white/15 bg-[#2d4a6c] p-1.5">
              {buzonPendiente.map((item) => (
                <details key={item.id} className="group rounded-lg border border-white/10 bg-[#1d3551]">
                  <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-2">
                    <span className={`h-2 w-2 rounded-full ${item.tipo === "reclamo" ? "bg-orange-300" : "bg-cyan-300"}`} />
                    <p className="truncate text-sm font-bold text-white">{item.asunto}</p>
                    <p className="ml-auto text-[11px] text-slate-300">{formatDate(item.created_at)}</p>
                    <span className="text-sm text-cyan-100 transition-transform duration-200 group-open:rotate-90">{">"}</span>
                  </summary>
                    <div className="border-t border-white/10 px-2 py-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                      {item.tipo === "reclamo" ? "Reclamo" : "Sugerencia"} - Depto {item.departamento_numero || "-"} - {item.vecino_nombre || "Vecino"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        item.estado === "respondido" ? "bg-cyan-500/20 text-cyan-100" : "bg-orange-500/20 text-orange-100"
                      }`}
                    >
                      {item.estado === "respondido" ? "Respondido" : "Pendiente"}
                    </span>
                  </div>

                  <div className="mb-1 ml-auto max-w-[94%] rounded-xl bg-[#173454] px-2 py-1 text-sm text-slate-100">
                    <p className="whitespace-pre-line">{item.mensaje}</p>
                  </div>

                  {!item.respuesta ? (
                    <form action={responderBuzon} className="mb-1 space-y-1">
                      <input type="hidden" name="id" value={item.id} />
                      <textarea
                        name="respuesta"
                        rows={1}
                        required
                        className="h-8 min-h-[32px] w-full rounded-lg border border-white/10 bg-[#173454] px-2 py-1 text-sm text-white"
                        placeholder="Responder..."
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="h-7 rounded-lg bg-[#ff5a3d] px-3 text-xs font-bold text-white">Enviar</button>
                      </div>
                    </form>
                  ) : null}

                  {item.respuesta ? (
                    <div className="mt-1 max-w-[94%] rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-2 py-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                        Respondido {formatDate(item.respondido_at)}
                      </p>
                      <p className="mt-1 text-sm text-cyan-50">{item.respuesta}</p>
                    </div>
                  ) : null}
                  </div>
                </details>
              ))
              }
              </div>
            )}
            {buzonPendiente.length === 0 && buzon.length > 0 ? (
              <div className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3 text-sm text-slate-200">
                No tienes pendientes por responder.
              </div>
            ) : null}
            {buzonHistorial.length > 0 ? (
                  <details className="group rounded-xl border border-white/15 bg-[#2d4a6c] p-2">
                <summary className="list-none cursor-pointer text-sm font-semibold text-cyan-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="group-open:hidden">{">"}</span>
                    <span className="hidden group-open:inline">v</span>
                    <span>Historial respondido ({buzonHistorial.length})</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2">
                  {buzonHistorial.map((item) => (
                    <details key={item.id} className="group rounded-lg border border-white/10 bg-[#1d3551]">
                      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-2">
                        <span className={`h-2 w-2 rounded-full ${item.tipo === "reclamo" ? "bg-orange-300" : "bg-cyan-300"}`} />
                        <p className="truncate text-sm font-bold text-white">{item.asunto}</p>
                        <p className="ml-auto text-[11px] text-slate-300">{formatDate(item.respondido_at || item.created_at)}</p>
                        <span className="text-sm text-cyan-100 transition-transform duration-200 group-open:rotate-90">{">"}</span>
                      </summary>
                      <div className="border-t border-white/10 px-2 py-1 space-y-1">
                      <div className="mt-1.5 ml-auto max-w-[94%] rounded-xl bg-[#173454] px-2 py-1 text-sm text-slate-100">
                        <p className="line-clamp-2">{item.mensaje}</p>
                      </div>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}





