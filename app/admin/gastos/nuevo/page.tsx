import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

async function crearGasto(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = await createClient();

  const fecha = String(formData.get("fecha_gasto") || "");
  const categoria = String(formData.get("categoria") || "").trim();
  const concepto = String(formData.get("concepto") || "").trim();
  const monto = Number(formData.get("monto") || 0);

  if (!fecha || !categoria || !concepto || monto <= 0) {
    redirect("/admin/gastos/nuevo");
  }

  await supabase.from("gastos").insert({
    bloque_id: usuario.perfil.bloque_id,
    fecha_gasto: fecha,
    categoria,
    concepto,
    monto,
  });

  redirect("/admin/gastos");
}

type CategoriaRow = {
  id: string;
  nombre: string;
};

const inputStyle = {
  color: "white",
  WebkitTextFillColor: "white",
  opacity: 1,
} as React.CSSProperties;

export default async function NuevoGastoPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = await createClient();

  const { data: categorias } = await supabase
    .from("categorias_gasto")
    .select("id, nombre")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .order("nombre", { ascending: true });

  const categoriasRows = (categorias ?? []) as CategoriaRow[];
  const hoy = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Registro de egresos
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Nuevo gasto
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Registra un gasto del bloque de forma clara, rápida y ordenada.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/gastos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Volver a gastos
              </Link>

              <Link
                href="/admin/gastos/categorias"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Categorías
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">
              Recomendaciones
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Antes de guardar
            </p>

            <div className="mt-5 space-y-3">
              <TipBox text="Usa una categoría correcta para mejorar reportes." />
              <TipBox text="Escribe un concepto claro y fácil de entender." />
              <TipBox text="Registra el monto exacto pagado." />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Formulario
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Registrar gasto
          </h2>
        </div>

        <div className="p-5 md:p-6">
          <form action={crearGasto} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="date-white">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Fecha
                </label>

                <input
                  type="date"
                  name="fecha_gasto"
                  defaultValue={hoy}
                  required
                  style={inputStyle}
                  className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Categoría
                </label>

                <select
                  name="categoria"
                  defaultValue=""
                  required
                  style={inputStyle}
                  className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                >
                  <option value="">Selecciona una categoría</option>
                  {categoriasRows.map((categoria) => (
                    <option key={categoria.id} value={categoria.nombre}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-100">
                Concepto
              </label>

              <input
                type="text"
                name="concepto"
                required
                placeholder="Ejemplo: Pago de agua abril"
                style={inputStyle}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-100">
                Monto
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                  Bs
                </span>

                <input
                  type="number"
                  name="monto"
                  step="0.01"
                  required
                  style={inputStyle}
                  className="w-full rounded-2xl border border-white/10 bg-[#173454] py-3 pl-12 pr-4 text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
              <Link
                href="/admin/gastos"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                className="rounded-2xl bg-[#ff5a3d] px-6 py-3 font-bold text-white transition hover:brightness-110"
              >
                Guardar gasto
              </button>
            </div>
          </form>
        </div>

        <style>{`
          .date-white input::-webkit-calendar-picker-indicator {
            filter: invert(1);
            opacity: 1;
            cursor: pointer;
          }
        `}</style>
      </section>
    </main>
  );
}

function TipBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-100">{text}</p>
    </div>
  );
}