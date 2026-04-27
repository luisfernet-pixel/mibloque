import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVecino } from "@/lib/auth";
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

async function enviarBuzon(formData: FormData) {
  "use server";

  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) redirect("/login");

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

export default async function VecinoComunicacionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) redirect("/login");

  const params = await searchParams;
  const supabase = createAdminClient();

  await Promise.all([
    supabase
      .from("notificaciones_vecino")
      .update({ leida: true })
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("departamento_id", usuario.perfil.departamento_id)
      .in("tipo", ["aviso_admin", "rechazo_pago", "respuesta_buzon"])
      .eq("leida", false),
    supabase
      .from("buzon_sugerencias")
      .update({ respuesta_leida: true })
      .eq("vecino_id", usuario.perfil.id)
      .eq("estado", "respondido")
      .eq("respuesta_leida", false),
  ]);

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
      .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at")
      .eq("vecino_id", usuario.perfil.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const avisos = (avisosData ?? []) as AvisoRow[];
  const buzon = buzonError ? [] : ((buzonData ?? []) as BuzonRow[]);
  const avisosRecientes = avisos.slice(0, 3);
  const avisosHistorial = avisos.slice(3);
  const buzonPendiente = buzon.filter((item) => item.estado !== "respondido");
  const buzonHistorial = buzon.filter((item) => item.estado === "respondido");

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Comunicacion</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Avisos y sugerencias
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Revisa avisos del bloque y envía reclamos/sugerencias en una sola pantalla.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Resumen</p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              <p>Avisos visibles: <span className="font-bold text-white">{avisos.length}</span></p>
              <p>Mensajes enviados: <span className="font-bold text-white">{buzon.length}</span></p>
            </div>
            {params.sent === "1" ? <p className="mt-4 text-sm font-semibold text-cyan-200">Mensaje enviado.</p> : null}
            {params.error ? (
              <p className="mt-2 text-sm font-semibold text-red-200">No se pudo procesar la accion ({params.error}).</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[28px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-bold text-white">Avisos del bloque</h2>
          </div>
          <div className="space-y-3 p-5">
            {avisos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                No hay avisos publicados.
              </div>
            ) : (
              avisosRecientes.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                  <p className="text-sm font-bold text-white">{item.titulo}</p>
                  <p className="mt-1 text-xs text-slate-300">{formatDate(item.created_at)}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>
                </article>
              ))
            )}
            {avisosHistorial.length > 0 ? (
              <details className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
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

        <div className="overflow-hidden rounded-[28px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-bold text-white">Sugerencias y reclamos</h2>
          </div>
          <div className="space-y-4 p-5">
            <form action={enviarBuzon} className="space-y-3 rounded-2xl border border-white/15 bg-[#2d4a6c] p-4">
              <div className="grid gap-3 md:grid-cols-[170px_1fr]">
                <select
                  name="tipo"
                  className="rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="sugerencia">Sugerencia</option>
                  <option value="reclamo">Reclamo</option>
                </select>
                <input
                  name="asunto"
                  required
                  maxLength={120}
                  placeholder="Asunto"
                  className="rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                />
              </div>
              <textarea
                name="mensaje"
                rows={3}
                required
                placeholder="Describe claramente tu mensaje."
                className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Enviar
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {buzon.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                  Aun no enviaste mensajes.
                </div>
              ) : (
                buzonPendiente.map((item) => (
                  <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                          {tipoLabel(item.tipo)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-white">{item.asunto}</p>
                        <p className="mt-1 text-xs text-slate-300">Enviado: {formatDate(item.created_at)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.estado === "respondido" ? "bg-cyan-500/20 text-cyan-100" : "bg-orange-500/20 text-orange-100"
                        }`}
                      >
                        {item.estado === "respondido" ? "Respondido" : "Pendiente"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>
                    {item.respuesta ? (
                      <div className="mt-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                          Respuesta {formatDate(item.respondido_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-cyan-50">{item.respuesta}</p>
                      </div>
                    ) : null}
                  </article>
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
