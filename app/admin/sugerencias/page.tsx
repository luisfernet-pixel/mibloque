import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = {
  ok?: string;
  error?: string;
};

type BuzonAdminRow = {
  id: string;
  tipo: string;
  asunto: string;
  mensaje: string;
  estado: string;
  respuesta: string | null;
  created_at: string;
  respondido_at: string | null;
  departamento_id: string;
  vecino_id: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function responderBuzon(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) {
    redirect("/login");
  }

  const id = String(formData.get("id") || "");
  const respuesta = String(formData.get("respuesta") || "").trim();
  if (!id || !respuesta) {
    redirect("/admin/sugerencias?error=datos");
  }

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("buzon_sugerencias")
    .select("id, bloque_id, departamento_id, vecino_id, asunto")
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();

  if (!current) {
    redirect("/admin/sugerencias?error=notfound");
  }

  const ahora = new Date().toISOString();
  await supabase
    .from("buzon_sugerencias")
    .update({
      estado: "respondido",
      respuesta,
      respondido_at: ahora,
      respondido_por: usuario.perfil.id,
    })
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  await supabase.from("notificaciones_vecino").insert({
    bloque_id: current.bloque_id,
    departamento_id: current.departamento_id,
    tipo: "respuesta_buzon",
    titulo: "Respuesta del admin",
    mensaje: `Tu mensaje "${current.asunto}" ya tiene respuesta.`,
    metadata: {
      buzon_id: current.id,
    },
  });

  revalidatePath("/admin/sugerencias");
  revalidatePath("/vecino/sugerencias");
  revalidatePath("/vecino");
  redirect("/admin/sugerencias?ok=1");
}

export default async function AdminSugerenciasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("buzon_sugerencias")
    .select("id, tipo, asunto, mensaje, estado, respuesta, created_at, respondido_at, departamento_id, vecino_id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = (data ?? []) as BuzonAdminRow[];
  const pendientes = rows.filter((item) => item.estado !== "respondido").length;

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Comunicacion</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Buzon de sugerencias
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Aqui puedes revisar reclamos y sugerencias de vecinos, y responder en el mismo flujo.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Resumen</p>
            <p className="mt-3 text-sm text-slate-200">Pendientes por responder</p>
            <p className="mt-1 text-4xl font-bold text-white">{pendientes}</p>
            {params.ok === "1" ? (
              <p className="mt-4 text-sm font-semibold text-cyan-200">Respuesta enviada al vecino.</p>
            ) : null}
            {params.error ? (
              <p className="mt-4 text-sm font-semibold text-red-200">No se pudo procesar la respuesta.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <h2 className="text-2xl font-bold text-white">Mensajes recibidos</h2>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          {rows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] p-6 text-center text-slate-300">
              Aun no hay mensajes de vecinos.
            </div>
          ) : (
            rows.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                      {item.tipo === "reclamo" ? "Reclamo" : "Sugerencia"}
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-white">{item.asunto}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Enviado: {formatDate(item.created_at)} - Depto: {item.departamento_id}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                      item.estado === "respondido"
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "bg-orange-500/20 text-orange-100"
                    }`}
                  >
                    {item.estado === "respondido" ? "Respondido" : "Pendiente"}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-[#1d3551] p-4 ring-1 ring-white/10">
                  <p className="whitespace-pre-line text-slate-100">{item.mensaje}</p>
                </div>

                {item.respuesta ? (
                  <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                      Respuesta enviada - {formatDate(item.respondido_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-cyan-50">{item.respuesta}</p>
                  </div>
                ) : (
                  <form action={responderBuzon} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={item.id} />
                    <label className="block text-sm font-semibold text-white">Responder al vecino</label>
                    <textarea
                      name="respuesta"
                      rows={3}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none focus:border-cyan-400/40"
                      placeholder="Escribe una respuesta clara y accionable."
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Enviar respuesta
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
