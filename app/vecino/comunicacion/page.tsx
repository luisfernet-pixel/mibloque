import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isBloqueActivo, requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{
  sent?: string;
  error?: string;
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
  respuesta_leida?: boolean | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tipoLabel(value: string) {
  return value === "reclamo" ? "Reclamo" : "Sugerencia";
}

function isRecentWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function isCurrentMonth(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

async function enviarBuzon(formData: FormData) {
  "use server";

  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/vecino/comunicacion?error=servicio_suspendido");

  const tipoRaw = String(formData.get("tipo") || "sugerencia");
  const tipo = tipoRaw === "reclamo" ? "reclamo" : "sugerencia";
  const asunto = String(formData.get("asunto") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!asunto || !mensaje) redirect("/vecino/comunicacion?error=datos");

  const supabase = createAdminClient();
  const { error } = await supabase.from("buzon_sugerencias").insert({
    bloque_id: usuario.perfil.bloque_id,
    departamento_id: usuario.perfil.departamento_id,
    vecino_id: usuario.perfil.id,
    tipo,
    asunto,
    mensaje,
  });
  if (error) redirect("/vecino/comunicacion?error=save");

  revalidatePath("/vecino");
  revalidatePath("/vecino/comunicacion");
  revalidatePath("/vecino/sugerencias");
  revalidatePath("/admin");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/admin/sugerencias");
  redirect("/vecino/comunicacion?sent=1");
}

async function limpiarAvisosNuevos() {
  "use server";
  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/vecino/comunicacion?error=servicio_suspendido");
  const supabase = createAdminClient();
  const cookieStore = await cookies();
  cookieStore.set("vecino_avisos_vistos_at", new Date().toISOString(), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  await supabase
    .from("buzon_sugerencias")
    .update({ respuesta_leida: true })
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("departamento_id", usuario.perfil.departamento_id)
    .eq("vecino_id", usuario.perfil.id)
    .eq("estado", "respondido")
    .eq("respuesta_leida", false);
  revalidatePath("/vecino");
  revalidatePath("/vecino/comunicacion");
  redirect("/vecino/comunicacion?ok=leido");
}

export default async function VecinoComunicacionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/vecino/comunicacion?error=servicio_suspendido");

  const params = await searchParams;
  const supabase = createAdminClient();

  await supabase
    .from("buzon_sugerencias")
    .update({ respuesta_leida: true })
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("departamento_id", usuario.perfil.departamento_id)
    .eq("vecino_id", usuario.perfil.id)
    .eq("estado", "respondido")
    .eq("respuesta_leida", false);

  const [{ data: avisosData }, { data: buzonData, error: buzonError }] = await Promise.all([
    supabase
      .from("avisos")
      .select("id, titulo, mensaje, created_at")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("publicado", true)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("buzon_sugerencias")
      .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at, respuesta_leida")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("departamento_id", usuario.perfil.departamento_id)
      .eq("vecino_id", usuario.perfil.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const avisos = (avisosData ?? []) as AvisoRow[];
  const buzon = buzonError ? [] : ((buzonData ?? []) as BuzonRow[]);
  const avisosRecientes = avisos.filter((item) => isRecentWithinDays(item.created_at, 30));
  const avisosHistorial = avisos.filter((item) => !isRecentWithinDays(item.created_at, 30));
  const buzonMesActual = buzon.filter((item) => isCurrentMonth(item.created_at) || isCurrentMonth(item.respondido_at));
  const buzonPendiente = [...buzonMesActual].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );
  const buzonHistorial = buzon.filter((item) => !isCurrentMonth(item.created_at) && !isCurrentMonth(item.respondido_at));
  const openHistorialAvisos = avisosRecientes.length === 0 && avisosHistorial.length > 0;

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Comunicacion</p>
            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
              Anuncios/Mensajes
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Revisa avisos del bloque y envia reclamos/sugerencias en una sola pantalla.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Resumen</p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              <p>Avisos visibles: <span className="font-bold text-white">{avisos.length}</span></p>
              <p>Mensajes enviados: <span className="font-bold text-white">{buzon.length}</span></p>
            </div>
            {params.sent === "1" ? <p className="mt-4 text-sm font-semibold text-cyan-200">Mensaje enviado.</p> : null}
            {params.error ? (
              <p className="mt-2 text-sm font-semibold text-red-200">No se pudo procesar la acción. Intenta nuevamente.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Avisos del bloque</h2>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
                {avisos.length} aviso(s)
              </span>
            </div>
            <form action={limpiarAvisosNuevos} className="mt-3">
              <button
                type="submit"
                className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white transition hover:brightness-110"
              >
                Marcar todo como leido
              </button>
            </form>
          </div>

          <div className="space-y-3 p-4">
            {avisos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                No hay avisos publicados.
              </div>
            ) : null}

            {avisosRecientes.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                <p className="text-sm font-bold text-white">{item.titulo}</p>
                <p className="mt-1 text-xs text-slate-300">{formatDate(item.created_at)}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>
              </article>
            ))}

            {avisosHistorial.length > 0 ? (
              <details
                open={openHistorialAvisos}
                className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                  Historial de avisos ({avisosHistorial.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {avisosHistorial.map((item) => (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-[#1d3551] p-3">
                      <p className="text-sm font-bold text-white">{item.titulo}</p>
                      <p className="mt-1 text-xs text-slate-300">{formatDate(item.created_at)}</p>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-100">{item.mensaje}</p>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-xl font-bold text-white">Sugerencias y reclamos</h2>
          </div>
          <div className="space-y-3 p-4">
            <form action={enviarBuzon} className="space-y-2 rounded-2xl border border-white/15 bg-[#2d4a6c] p-3">
              <div className="grid gap-2 md:grid-cols-[160px_1fr]">
                <select
                  name="tipo"
                  className="h-9 rounded-xl border border-white/10 bg-[#173454] px-3 text-sm text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="sugerencia">Sugerencia</option>
                  <option value="reclamo">Reclamo</option>
                </select>
                <input
                  name="asunto"
                  required
                  maxLength={120}
                  placeholder="Asunto"
                  className="h-9 rounded-xl border border-white/10 bg-[#173454] px-3 text-sm text-white outline-none focus:border-cyan-400/40"
                />
              </div>
              <textarea
                name="mensaje"
                rows={2}
                required
                placeholder="Describe claramente tu mensaje."
                className="min-h-[68px] w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              />
              <div>
                <button
                  type="submit"
                  className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Enviar mensaje
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {buzon.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                  Aun no enviaste mensajes.
                </div>
              ) : (
                buzonPendiente.map((item) => (
                  <details key={item.id} className="group rounded-xl border border-white/15 bg-[#2d4a6c]">
                    <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-2.5">
                      <span className={`h-2 w-2 rounded-full ${item.tipo === "reclamo" ? "bg-orange-300" : "bg-cyan-300"}`} />
                      <p className="truncate text-sm font-bold text-white">{item.asunto}</p>
                      <p className="ml-auto text-[11px] text-slate-300">{formatDate(item.created_at)}</p>
                      <span className="text-sm text-cyan-100 transition-transform duration-200 group-open:rotate-90">{">"}</span>
                    </summary>
                    <div className="space-y-1.5 border-t border-white/10 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">{tipoLabel(item.tipo)}</p>
                      <p className="text-[11px] text-slate-300">{formatDate(item.created_at)}</p>
                    </div>
                    <div className="ml-auto max-w-[92%] rounded-xl bg-[#173454] px-2.5 py-1.5 text-sm text-slate-100">
                      {item.mensaje}
                    </div>
                    {item.respuesta ? (
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1.5 text-sm text-cyan-50 md:ml-auto md:max-w-[92%]">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                          Admin - {formatDate(item.respondido_at)}
                        </p>
                        <p className="whitespace-pre-line">{item.respuesta}</p>
                      </div>
                    ) : null}
                    </div>
                  </details>
                ))
              )}
              {buzonPendiente.length === 0 && buzon.length > 0 ? (
                <div className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3 text-sm text-slate-200">
                  No tienes mensajes pendientes de respuesta.
                </div>
              ) : null}
              {buzonHistorial.length > 0 ? (
                <details className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                    Historial de mensajes ({buzonHistorial.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {buzonHistorial.map((item) => (
                      <article key={item.id} className="rounded-lg border border-white/10 bg-[#1d3551] p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                          {tipoLabel(item.tipo)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-white">{item.asunto}</p>
                        <p className="mt-1 text-xs text-slate-300">Respondido: {formatDate(item.respondido_at)}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-100">{item.mensaje}</p>
                        {item.respuesta ? (
                          <div className="mt-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                              Respuesta del admin
                            </p>
                            <p className="mt-1 whitespace-pre-line text-sm text-cyan-50">{item.respuesta}</p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


