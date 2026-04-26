import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { requireVecino } from "@/lib/auth";

type AvisoRow = {
  id: string;
  titulo: string;
  mensaje: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function VecinoAvisosPage() {
  const usuario = await requireVecino();

  if (!usuario) {
    redirect("/login");
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  if (usuario.perfil.departamento_id) {
    await adminSupabase
      .from("notificaciones_vecino")
      .update({ leida: true })
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("departamento_id", usuario.perfil.departamento_id)
      .in("tipo", ["aviso_admin", "rechazo_pago"])
      .eq("leida", false);
  }

  const { data } = await supabase
    .from("avisos")
    .select("id, titulo, mensaje, created_at")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("publicado", true)
    .order("created_at", { ascending: false });

  const avisos = (data ?? []) as AvisoRow[];
  const ultimoAviso = avisos[0]?.created_at ?? null;

  return (
    <main className="space-y-4 md:space-y-6">
      <section className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:rounded-[30px]">
        <div className="grid gap-4 p-4 md:grid-cols-[1.35fr_0.65fr] md:gap-5 md:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300 md:text-xs md:tracking-[0.3em]">
              Avisos del bloque
            </p>

            <h1 className="mt-1 text-lg font-bold text-white md:mt-2 md:text-3xl">
              Comunicados recientes
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Aqui puedes ver los mensajes importantes enviados por la administracion.
            </p>
          </div>

          <div className="rounded-xl border border-white/15 bg-[#2f4b6c] p-3 text-slate-100 md:rounded-2xl md:p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200 md:text-[11px] md:tracking-[0.24em]">
              Resumen
            </p>

            <div className="mt-3 space-y-2.5 text-sm md:mt-4 md:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Avisos publicados</span>
                <span className="font-semibold text-white">{avisos.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Ultimo aviso</span>
                <span className="font-semibold text-white">
                  {ultimoAviso ? formatDate(ultimoAviso) : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2.5 md:space-y-4">
        {avisos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-[#2b4768] p-4 text-slate-200 shadow-xl md:p-6">
            <p className="text-base font-semibold md:text-lg">No hay avisos publicados.</p>
            <p className="mt-2 text-sm text-slate-300">
              Cuando la administracion publique novedades, apareceran aqui.
            </p>
          </div>
        ) : (
          avisos.map((item, index) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-3.5 shadow-xl md:p-5 ${
                index === 0
                  ? "border-cyan-400/30 bg-gradient-to-br from-[#2c587f] to-[#3b678f] text-slate-100"
                  : "border-white/10 bg-[#2d4a6c] text-slate-100"
              }`}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">Aviso</p>

                  <h2 className="mt-1 text-lg font-bold text-white md:text-xl">{item.titulo}</h2>
                </div>

                <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                  {formatDate(item.created_at)}
                </span>
              </div>

              <div className="mt-2.5 rounded-xl border border-white/15 bg-[#1d3551] p-3 md:mt-4 md:rounded-2xl md:p-4">
                <p className="whitespace-pre-line text-sm leading-6 text-slate-100 md:leading-7">
                  {item.mensaje}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
