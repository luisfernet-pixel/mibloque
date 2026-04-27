import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
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
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function crearAviso(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  if (!titulo || !mensaje) redirect("/admin/comunicacion?error=datos_aviso");

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: avisoCreado, error: avisoError } = await supabase
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

  const { data: departamentos } = await adminSupabase
    .from("departamentos")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id);

  const rows = (departamentos ?? []).map((item) => ({
    bloque_id: usuario.perfil.bloque_id,
    departamento_id: item.id,
    tipo: "aviso_admin",
    titulo,
    mensaje,
    metadata: { aviso_id: avisoCreado?.id ?? null },
  }));

  if (rows.length > 0) {
    const { error: notifyErrorWithMetadata } = await adminSupabase
      .from("notificaciones_vecino")
      .insert(rows);
    if (notifyErrorWithMetadata) {
      const fallbackRows = rows.map((item) => ({
        bloque_id: item.bloque_id,
        departamento_id: item.departamento_id,
        tipo: item.tipo,
        titulo: item.titulo,
        mensaje: item.mensaje,
      }));
      await adminSupabase.from("notificaciones_vecino").insert(fallbackRows);
    }
  }

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

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

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

  const notifyPayload = {
    bloque_id: current.bloque_id,
    departamento_id: current.departamento_id,
    tipo: "respuesta_buzon",
    titulo: "Respuesta del admin",
    mensaje: `Tu mensaje "${current.asunto}" ya tiene respuesta.`,
    metadata: { buzon_id: current.id },
  };

  const { error: notifyErrorWithMetadata } = await supabase
    .from("notificaciones_vecino")
    .insert(notifyPayload);
  if (notifyErrorWithMetadata) {
    await supabase.from("notificaciones_vecino").insert({
      bloque_id: current.bloque_id,
      departamento_id: current.departamento_id,
      tipo: "respuesta_buzon",
      titulo: "Respuesta del admin",
      mensaje: `Tu mensaje "${current.asunto}" ya tiene respuesta.`,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/comunicacion");
  revalidatePath("/admin/sugerencias");
  revalidatePath("/vecino");
  revalidatePath("/vecino/sugerencias");
  revalidatePath("/vecino/comunicacion");
  redirect("/admin/comunicacion?ok=1");
}

export default async function AdminComunicacionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

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
      .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at, departamento_id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const avisos = (avisosData ?? []) as AvisoRow[];
  const buzon = buzonError ? [] : ((buzonData ?? []) as BuzonRow[]);
  const pendientes = buzon.filter((item) => item.estado !== "respondido").length;
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
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">Avisos y sugerencias</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Gestiona en una sola pantalla los avisos del bloque y las sugerencias/reclamos de vecinos.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
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

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[28px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-bold text-white">Avisos</h2>
            <p className="mt-1 text-sm text-slate-300">Publica y revisa los ultimos comunicados.</p>
          </div>
          <div className="space-y-4 p-5">
            <form action={crearAviso} className="space-y-3 rounded-2xl border border-white/15 bg-[#2d4a6c] p-4">
              <input
                name="titulo"
                placeholder="Titulo del aviso"
                required
                className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none focus:border-cyan-400/40"
              />
              <textarea
                name="mensaje"
                rows={3}
                placeholder="Mensaje del aviso"
                required
                className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none focus:border-cyan-400/40"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Publicar
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {avisos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                  No hay avisos publicados.
                </div>
              ) : (
                avisosRecientes.map((item) => (
                  <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                    <p className="text-sm font-bold text-white">{item.titulo}</p>
                    <p className="mt-1 text-xs text-slate-300">{formatDate(item.created_at)}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-100">{item.mensaje}</p>
                  </article>
                ))
              )}
            </div>
            {avisosHistorial.length > 0 ? (
              <details className="group rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                <summary className="list-none cursor-pointer text-sm font-semibold text-cyan-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="group-open:hidden">▸</span>
                    <span className="hidden group-open:inline">▾</span>
                    <span>Historial de avisos ({avisosHistorial.length})</span>
                  </span>
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
            <p className="mt-1 text-sm text-slate-300">Responde solicitudes de vecinos desde aqui.</p>
          </div>
          <div className="space-y-3 p-5">
            {buzon.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
                No hay mensajes en el buzon.
              </div>
            ) : (
              buzonPendiente.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                        {item.tipo === "reclamo" ? "Reclamo" : "Sugerencia"} · Depto {item.departamento_id}
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
                        Respondido {formatDate(item.respondido_at)}
                      </p>
                      <p className="mt-1 text-sm text-cyan-50">{item.respuesta}</p>
                    </div>
                  ) : (
                    <form action={responderBuzon} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={item.id} />
                      <textarea
                        name="respuesta"
                        rows={2}
                        required
                        className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                        placeholder="Responder..."
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-[#ff5a3d] px-3 text-xs font-bold text-white transition hover:brightness-110"
                        >
                          Enviar respuesta
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))
            )}
            {buzonPendiente.length === 0 && buzon.length > 0 ? (
              <div className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3 text-sm text-slate-200">
                No tienes pendientes por responder.
              </div>
            ) : null}
            {buzonHistorial.length > 0 ? (
              <details className="group rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                <summary className="list-none cursor-pointer text-sm font-semibold text-cyan-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="group-open:hidden">▸</span>
                    <span className="hidden group-open:inline">▾</span>
                    <span>Historial respondido ({buzonHistorial.length})</span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2">
                  {buzonHistorial.map((item) => (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-[#1d3551] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                        {item.tipo === "reclamo" ? "Reclamo" : "Sugerencia"} · Depto {item.departamento_id}
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
      </section>
    </main>
  );
}
