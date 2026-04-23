import { createClient } from "@/lib/supabase/server";
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

  const { data } = await supabase
    .from("avisos")
    .select("id, titulo, mensaje, created_at")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("publicado", true)
    .order("created_at", { ascending: false });

  const avisos = (data ?? []) as AvisoRow[];
  const ultimoAviso = avisos[0]?.created_at ?? null;

  return (
    <main className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(2,6,23,0.72)] text-slate-100 shadow-2xl">
        <div className="grid gap-5 p-5 md:grid-cols-[1.35fr_0.65fr] md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Avisos del bloque
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
              Comunicados recientes
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Aquí puedes ver los mensajes importantes enviados por la
              administración.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              Resumen
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Avisos publicados</span>
                <span className="font-semibold text-white">
                  {avisos.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Último aviso</span>
                <span className="font-semibold text-white">
                  {ultimoAviso ? formatDate(ultimoAviso) : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {avisos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/20 p-6 text-slate-800 shadow-xl">
            <p className="text-lg font-semibold">No hay avisos publicados.</p>
            <p className="mt-2 text-sm text-slate-600">
              Cuando la administración publique novedades, aparecerán aquí.
            </p>
          </div>
        ) : (
          avisos.map((item, index) => (
            <article
              key={item.id}
              className={`rounded-3xl border p-5 shadow-xl ${
                index === 0
                  ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-white/20 text-slate-800"
                  : "border-white/10 bg-white/20 text-slate-800"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                    Aviso
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {item.titulo}
                  </h2>
                </div>

                <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-800">
                  {formatDate(item.created_at)}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/20 bg-white/20 p-4">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
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