import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVecino } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = {
  sent?: string;
  error?: string;
  read?: string;
  seen?: string;
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
  if (!usuario || !usuario.perfil.departamento_id) {
    redirect("/login");
  }

  const tipoRaw = String(formData.get("tipo") || "sugerencia");
  const tipo = tipoRaw === "reclamo" ? "reclamo" : "sugerencia";
  const asunto = String(formData.get("asunto") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();

  if (!asunto || !mensaje) {
    redirect("/vecino/sugerencias?error=datos");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("buzon_sugerencias").insert({
    bloque_id: usuario.perfil.bloque_id,
    departamento_id: usuario.perfil.departamento_id,
    vecino_id: usuario.perfil.id,
    tipo,
    asunto,
    mensaje,
  });
  if (error) {
    redirect("/vecino/sugerencias?error=save");
  }

  revalidatePath("/vecino/sugerencias");
  revalidatePath("/admin/sugerencias");
  revalidatePath("/admin");
  redirect("/vecino/sugerencias?sent=1");
}

async function marcarRespuestasLeidas() {
  "use server";

  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  await supabase
    .from("notificaciones_vecino")
    .update({ leida: true })
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("departamento_id", usuario.perfil.departamento_id)
    .eq("tipo", "respuesta_buzon")
    .eq("leida", false);

  await supabase
    .from("buzon_sugerencias")
    .update({ respuesta_leida: true })
    .eq("vecino_id", usuario.perfil.id)
    .eq("estado", "respondido")
    .eq("respuesta_leida", false);

  revalidatePath("/vecino");
  revalidatePath("/vecino/sugerencias");
  redirect("/vecino/sugerencias?read=1");
}

export default async function VecinoSugerenciasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const usuario = await requireVecino();
  if (!usuario || !usuario.perfil.departamento_id) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const supabase = createAdminClient();
  const shouldAutoSeen = params.seen !== "1";

  if (shouldAutoSeen) {
    const [{ data: unreadNotif }, { data: unreadRespuestas }] = await Promise.all([
      supabase
        .from("notificaciones_vecino")
        .select("id")
        .eq("bloque_id", usuario.perfil.bloque_id)
        .eq("departamento_id", usuario.perfil.departamento_id)
        .eq("tipo", "respuesta_buzon")
        .eq("leida", false),
      supabase
        .from("buzon_sugerencias")
        .select("id")
        .eq("vecino_id", usuario.perfil.id)
        .eq("estado", "respondido")
        .eq("respuesta_leida", false),
    ]);

    const hasUnread = (unreadNotif?.length ?? 0) > 0 || (unreadRespuestas?.length ?? 0) > 0;

    if (hasUnread) {
      await Promise.all([
        supabase
          .from("notificaciones_vecino")
          .update({ leida: true })
          .eq("bloque_id", usuario.perfil.bloque_id)
          .eq("departamento_id", usuario.perfil.departamento_id)
          .eq("tipo", "respuesta_buzon")
          .eq("leida", false),
        supabase
          .from("buzon_sugerencias")
          .update({ respuesta_leida: true })
          .eq("vecino_id", usuario.perfil.id)
          .eq("estado", "respondido")
          .eq("respuesta_leida", false),
      ]);

      revalidatePath("/vecino");
      revalidatePath("/vecino/sugerencias");
      redirect("/vecino/sugerencias?seen=1");
    }
  }

  const { data, error: listError } = await supabase
    .from("buzon_sugerencias")
    .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at")
    .eq("vecino_id", usuario.perfil.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = listError ? [] : ((data ?? []) as BuzonRow[]);

  return (
    <main className="space-y-4 md:space-y-6">
      <section className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:rounded-[30px]">
        <div className="border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300 md:text-xs md:tracking-[0.3em]">
            Buzon vecino
          </p>
          <h1 className="mt-1 text-lg font-bold text-white md:mt-2 md:text-2xl">
            Sugerencias y reclamos
          </h1>
        </div>

        <div className="p-4 md:p-6">
          <form action={enviarBuzon} className="grid gap-4 md:gap-5">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Tipo</label>
                <select
                  name="tipo"
                  className="w-full rounded-xl border border-white/15 bg-[#173454] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="sugerencia">Sugerencia</option>
                  <option value="reclamo">Reclamo</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Asunto</label>
                <input
                  name="asunto"
                  required
                  maxLength={120}
                  className="w-full rounded-xl border border-white/15 bg-[#173454] px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-cyan-400/40"
                  placeholder="Ej: luz del pasillo, ruido, idea para el bloque"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Mensaje</label>
              <textarea
                name="mensaje"
                rows={4}
                required
                className="w-full rounded-xl border border-white/15 bg-[#173454] px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-cyan-400/40"
                placeholder="Describe claramente tu sugerencia o reclamo."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white transition hover:brightness-110"
              >
                Enviar
              </button>
            </div>
          </form>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="space-y-1">
              {params.sent === "1" ? (
                <p className="text-xs font-semibold text-cyan-200">Mensaje enviado al admin.</p>
              ) : null}
              {params.read === "1" ? (
                <p className="text-xs font-semibold text-cyan-200">Respuestas marcadas como leidas.</p>
              ) : null}
              {params.error === "datos" ? (
                <p className="text-xs font-semibold text-red-200">Completa asunto y mensaje.</p>
              ) : null}
              {params.error === "save" ? (
                <p className="text-xs font-semibold text-red-200">
                  No se pudo enviar. Verifica migracion de BD y vuelve a intentar.
                </p>
              ) : null}
            </div>
            <form action={marcarRespuestasLeidas}>
              <button
                type="submit"
                className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/20"
              >
                Marcar leidas
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:rounded-[30px]">
        <div className="border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
          <h2 className="text-base font-bold text-white md:text-xl">Historial</h2>
        </div>
        <div className="space-y-2 p-3 md:space-y-3 md:p-5">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-sm text-slate-300">
              {listError ? "No se pudo cargar historial de mensajes." : "Aun no enviaste mensajes al admin."}
            </div>
          ) : (
            rows.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/15 bg-[#2d4a6c] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                      {tipoLabel(item.tipo)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">{item.asunto}</p>
                    <p className="mt-1 text-xs text-slate-300">Enviado: {formatDate(item.created_at)}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      item.estado === "respondido"
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "bg-orange-500/20 text-orange-100"
                    }`}
                  >
                    {item.estado === "respondido" ? "Respondido" : "Pendiente"}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-line text-sm text-slate-100">{item.mensaje}</p>

                {item.respuesta ? (
                  <div className="mt-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                      Respuesta del admin - {formatDate(item.respondido_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-cyan-50">{item.respuesta}</p>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
