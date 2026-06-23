import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { extname } from "node:path";
import { isBloqueActivo, requireAdmin, requireBlockAdmin } from "@/lib/auth";
import ComprobanteImageInput from "../_components/comprobante-image-input";

type CategoriaRow = {
  id: string;
  nombre: string;
};

const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;
const TIPOS_COMPROBANTE_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

async function guardarCategoriaSiCorresponde(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bloqueId: string,
  categoria: string,
  guardarEnCatalogo: boolean
) {
  if (!guardarEnCatalogo || !categoria) return;

  const { data: existente } = await supabase
    .from("categorias_gasto")
    .select("id")
    .eq("bloque_id", bloqueId)
    .ilike("nombre", categoria)
    .maybeSingle();

  if (existente) return;

  await supabase.from("categorias_gasto").insert({
    bloque_id: bloqueId,
    nombre: categoria,
  });
}

function resolverCategoria(formData: FormData) {
  const categoriaSeleccionada = String(formData.get("categoria") || "").trim();
  const categoriaManual = String(formData.get("categoria_manual") || "").trim();
  return categoriaManual || categoriaSeleccionada;
}

function comprobanteEsValido(archivo: File | null) {
  if (!archivo || archivo.size <= 0) return true;
  return archivo.size <= MAX_COMPROBANTE_BYTES && TIPOS_COMPROBANTE_PERMITIDOS.has(archivo.type);
}

function monthKey(fecha: string) {
  const f = new Date(fecha);
  const y = f.getFullYear();
  const m = String(f.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(key: string) {
  const [anioTxt, mesTxt] = key.split("-");
  const anio = Number(anioTxt);
  const mes = Number(mesTxt);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

async function crearGasto(formData: FormData) {
  "use server";

  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/nuevo?error=servicio_suspendido");

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const fecha = String(formData.get("fecha_gasto") || "");
  const categoria = resolverCategoria(formData);
  const concepto = String(formData.get("concepto") || "").trim();
  const monto = Number(formData.get("monto") || 0);
  const archivo = formData.get("comprobante") as File | null;
  const guardarCategoria = String(formData.get("guardar_categoria") || "") === "on";

  if (!fecha || !categoria || !concepto || monto <= 0) {
    redirect("/admin/gastos/nuevo?error=datos");
  }

  if (!comprobanteEsValido(archivo)) {
    redirect("/admin/gastos/nuevo?error=archivo");
  }

  await guardarCategoriaSiCorresponde(
    supabase,
    usuario.perfil.bloque_id,
    categoria,
    guardarCategoria
  );

  const bloqueo = parseMonthKey(monthKey(fecha));
  if (bloqueo) {
    const { data: cierre } = await adminSupabase
      .from("gastos_cierres_mensuales")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("anio", bloqueo.anio)
      .eq("mes", bloqueo.mes)
      .maybeSingle();
    if (cierre) redirect("/admin/gastos/nuevo?error=mes_bloqueado");
  }

  let comprobantePath: string | null = null;

  if (archivo && archivo.size > 0) {
    const adminSupabase = createAdminClient();
    const bytes = await archivo.arrayBuffer();
    const buffer = new Uint8Array(bytes);
    const extension = extname(archivo.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "");
    const safeName = `${Date.now()}-${crypto.randomUUID()}${extension || ".jpg"}`;
    const fileName = `gastos/${usuario.perfil.bloque_id}/${safeName}`;

    const { error: uploadError } = await adminSupabase.storage
      .from("comprobantes")
      .upload(fileName, buffer, {
        contentType: archivo.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      redirect("/admin/gastos/nuevo?error=guardar");
    }

    comprobantePath = fileName;
  }

  const payloadBase = {
    bloque_id: usuario.perfil.bloque_id,
    fecha_gasto: fecha,
    categoria,
    concepto,
    monto,
  };

  const payloadConComprobante = {
    ...payloadBase,
    comprobante_path: comprobantePath,
  };

  const { error: insertError } = await supabase.from("gastos").insert(payloadConComprobante);

  if (insertError) {
    redirect("/admin/gastos/nuevo?error=guardar");
  }

  const mesActual = monthKey(new Date().toISOString());
  if (monthKey(fecha) !== mesActual) {
    redirect("/admin/gastos?notice=mes_distinto");
  }
  redirect("/admin/gastos");
}

export default async function NuevoGastoPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos/nuevo?error=servicio_suspendido");
  const params = (await searchParams) ?? {};

  const supabase = await createClient();

  const { data: categorias } = await supabase
    .from("categorias_gasto")
    .select("id, nombre")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .order("nombre", { ascending: true });

  const categoriasRows = (categorias ?? []) as CategoriaRow[];
  const categoriasSinOtros = categoriasRows.filter(
    (categoria) => categoria.nombre.trim().toLowerCase() !== "otros"
  );
  const hoy = new Date().toISOString().split("T")[0];

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                  Registro de egresos
                </p>

                <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
                  Registrar gasto
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/gastos"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10"
                >
                  Volver
                </Link>

                <Link
                  href="/admin/gastos/categorias"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  Categorias
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <p className="text-sm font-semibold text-white">Antes de guardar</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Antes de guardar
            </p>

            <div className="mt-3 rounded-xl bg-[#3a5879] p-3 ring-1 ring-white/10">
              <p className="text-sm text-slate-100">
                1. Elige una categoria o escribe una nueva. 2. Si se repetira, guardala en tu
                catalogo. 3. Registra un concepto breve y el monto exacto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {params.error === "mes_bloqueado" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Ese mes esta bloqueado. Desbloquealo en la lista de gastos para registrar movimientos.
        </section>
      ) : null}
      {params.error === "datos" ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          Completa fecha, categoria (o otra categoria), concepto y monto valido.
        </section>
      ) : null}
      {params.error === "archivo" ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          El comprobante debe ser JPG, PNG o WEBP y pesar maximo 5 MB.
        </section>
      ) : null}
      {params.error === "guardar" ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          No se pudo guardar el gasto. Intentalo nuevamente.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3 md:px-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Registrar ahora
          </p>
          <h2 className="mt-1.5 text-lg font-bold text-white">Registrar gasto</h2>
        </div>

        <div className="p-3 md:p-4">
          <form action={crearGasto} className="space-y-3.5">
            <div className="grid gap-3 xl:grid-cols-12">
              <div className="date-white xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Fecha
                </label>

                <input
                  type="date"
                  name="fecha_gasto"
                  defaultValue={hoy}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Categoria
                </label>

                <select
                  name="categoria"
                  defaultValue="Otros"
                  className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                >
                  <option value="Otros">Otros</option>
                  {categoriasSinOtros.map((categoria) => (
                    <option key={categoria.id} value={categoria.nombre}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Otra categoria
                </label>
                <input
                  type="text"
                  name="categoria_manual"
                  placeholder="Ejemplo: Jardinero"
                  className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Concepto
                </label>

                <input
                  type="text"
                  name="concepto"
                  required
                  placeholder="Ejemplo: Pago de agua abril"
                  className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Monto
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-500">
                    Bs
                  </span>

                  <input
                    type="number"
                    name="monto"
                    step="0.01"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#173454] py-2 pl-9 pr-2 text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-100">
                  Recibo / factura
                </label>
                <ComprobanteImageInput name="comprobante" />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-slate-100">
              <input
                type="checkbox"
                name="guardar_categoria"
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>Guardar categoria para reutilizar.</span>
            </label>

            <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
              <Link
                href="/admin/gastos"
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-[#ff5a3d] px-6 py-3 font-bold text-white transition hover:brightness-110"
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


