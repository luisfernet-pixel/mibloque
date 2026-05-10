import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { extname } from "node:path";
import ConfirmDeleteButton from "./_components/confirm-delete-button";
import ComprobanteImageInput from "./_components/comprobante-image-input";

type GastoRow = {
  id: string;
  bloque_id: string;
  fecha_gasto: string;
  categoria: string;
  concepto: string;
  monto: number;
  comprobante_url: string | null;
};

type CategoriaRow = {
  id: string;
  nombre: string;
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-BO");
}

function esDelMesActual(fecha: string) {
  const f = new Date(fecha);
  const hoy = new Date();

  return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
}

function categoriaClass(value: string) {
  const v = (value || "").toLowerCase();

  if (v.includes("mantenimiento") || v.includes("repar")) {
    return "border border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
  }

  if (v.includes("limpieza") || v.includes("servicio")) {
    return "border border-sky-400/20 bg-sky-500/10 text-sky-300";
  }

  if (v.includes("agua") || v.includes("luz") || v.includes("electric")) {
    return "border border-blue-400/20 bg-blue-500/10 text-blue-300";
  }

  if (v.includes("jard") || v.includes("jardiner")) {
    return "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-indigo-400/20 bg-indigo-500/10 text-indigo-300";
}

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

async function editarGasto(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const id = String(formData.get("id") || "");
  const fecha_gasto = String(formData.get("fecha_gasto") || "");
  const categoria = resolverCategoria(formData);
  const concepto = String(formData.get("concepto") || "").trim();
  const monto = Number(formData.get("monto") || 0);
  const archivo = formData.get("comprobante") as File | null;
  const guardarCategoria = String(formData.get("guardar_categoria") || "") === "on";

  if (!id || !fecha_gasto || !categoria || !concepto || monto <= 0) {
    redirect("/admin/gastos");
  }

  const supabase = await createClient();

  await guardarCategoriaSiCorresponde(
    supabase,
    usuario.perfil.bloque_id,
    categoria,
    guardarCategoria
  );

  let comprobanteUrl: string | null | undefined = undefined;

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

    if (!uploadError) {
      const { data: publicFile } = adminSupabase.storage
        .from("comprobantes")
        .getPublicUrl(fileName);
      comprobanteUrl = publicFile.publicUrl;
    }
  }

  await supabase
    .from("gastos")
    .update({
      fecha_gasto,
      categoria,
      concepto,
      monto,
      ...(comprobanteUrl ? { comprobante_url: comprobanteUrl } : {}),
    })
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/gastos");
}

async function eliminarGasto(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/gastos");

  const supabase = await createClient();

  await supabase
    .from("gastos")
    .delete()
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/gastos");
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams?: Promise<{ editar?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = (await searchParams) ?? {};
  const editarId = params.editar || "";

  const supabase = await createClient();

  const [{ data: gastos, error }, { data: categorias }] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, bloque_id, fecha_gasto, categoria, concepto, monto, comprobante_url")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("fecha_gasto", { ascending: false }),
    supabase
      .from("categorias_gasto")
      .select("id, nombre")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("nombre", { ascending: true }),
  ]);

  const rows = (gastos ?? []) as GastoRow[];
  const categoriasRows = (categorias ?? []) as CategoriaRow[];

  const rowsMesActual = rows.filter((item) => esDelMesActual(item.fecha_gasto));
  const totalMesActual = rowsMesActual.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const movimientosMesActual = rowsMesActual.length;
  const categoriasMesActual = new Set(rowsMesActual.map((item) => item.categoria)).size;
  const ultimoGasto = rows[0];

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Gestion de egresos
            </p>

            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
              Gastos del bloque
            </h1>

            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Registra, corrige y ordena los gastos del bloque para mantener el
              control financiero claro y actualizado.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/gastos/nuevo"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Nuevo gasto
              </Link>

              <Link
                href="/admin/gastos/categorias"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Administrar categorias
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            <div>
              <p className="text-sm font-semibold text-white">Resumen de gastos</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Movimiento actual
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoBox label="Gastado este mes" value={money(totalMesActual)} />
              <InfoBox label="Gastos del mes" value={String(movimientosMesActual)} />
              <InfoBox label="Categorias usadas" value={String(categoriasMesActual)} />
              <InfoBox label="Ultimo gasto" value={ultimoGasto ? money(ultimoGasto.monto) : "Bs 0"} />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          Error cargando gastos: {error.message}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Gastado este mes" value={money(totalMesActual)} tone="orange" />
        <KpiCard title="Movimientos del mes" value={String(movimientosMesActual)} tone="cyan" />
        <KpiCard title="Categorias activas" value={String(categoriasMesActual)} tone="blue" />
        <KpiCard
          title="Ultimo gasto"
          value={ultimoGasto ? money(ultimoGasto.monto) : "Bs 0"}
          tone="orangeSoft"
        />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Historial operativo
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-white">Gastos registrados</h2>
            <p className="mt-1 text-xs text-slate-300">
              Revisa, edita o elimina movimientos guardados.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
            {rows.length} gasto(s)
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-slate-300">No hay gastos registrados todavia.</div>
        ) : (
          <div className="space-y-2.5 p-3 md:p-3">
            {rows.map((item) => {
              const enEdicion = editarId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-[22px] border border-white/20 bg-[#2d4a6c] p-3 shadow-lg"
                >
                  {enEdicion ? (
                    <form action={editarGasto} className="space-y-3.5">
                      <input type="hidden" name="id" value={item.id} />

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-300">Editando gasto</p>
                          <p className="mt-1 text-sm text-slate-400">
                            Corrige fecha, categoria, concepto o monto.
                          </p>
                        </div>

                        <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
                          Edicion
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="date-white">
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Fecha
                          </label>
                          <input
                            type="date"
                            name="fecha_gasto"
                            defaultValue={item.fecha_gasto}
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Categoria
                          </label>
                          <select
                            name="categoria"
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                            defaultValue={item.categoria}
                          >
                            {categoriasRows.map((categoria) => (
                              <option key={categoria.id} value={categoria.nombre}>
                                {categoria.nombre}
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs text-slate-300">
                            Tambien puedes escribir una categoria puntual abajo.
                          </p>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Concepto
                          </label>
                          <input
                            type="text"
                            name="concepto"
                            defaultValue={item.concepto}
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Monto
                          </label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-500">
                              Bs
                            </span>
                            <input
                              type="number"
                              name="monto"
                              step="0.01"
                              defaultValue={item.monto}
                              required
                              className="w-full rounded-xl border border-white/10 bg-[#173454] py-2 pl-11 pr-3 text-white outline-none transition focus:border-cyan-400/40"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-100">
                          Nuevo recibo / factura (opcional)
                        </label>
                        <ComprobanteImageInput name="comprobante" />
                        {item.comprobante_url ? (
                          <a
                            href={item.comprobante_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
                          >
                            Ver comprobante actual
                          </a>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-100">
                          Otra categoria (opcional)
                        </label>
                        <input
                          type="text"
                          name="categoria_manual"
                          placeholder="Ejemplo: Arreglo puntual"
                          className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                        />
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-sm text-slate-100">
                        <input
                          type="checkbox"
                          name="guardar_categoria"
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                        />
                        <span>Guardar esta categoria en mi lista para reutilizarla luego.</span>
                      </label>

                      <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
                        <a
                          href="/admin/gastos"
                          className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 font-semibold text-white transition hover:bg-white/10"
                        >
                          Cancelar
                        </a>

                        <button
                          type="submit"
                          className="rounded-xl bg-[#ff5a3d] px-3.5 py-2 font-bold text-white transition hover:brightness-110"
                        >
                          Guardar cambios
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_140px_150px_auto] md:items-center">
                      <div>
                        <p className="text-sm text-slate-300">Fecha</p>
                        <p className="mt-1 font-semibold text-white">{formatDate(item.fecha_gasto)}</p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-300">Categoria</p>
                        <div className="mt-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${categoriaClass(
                              item.categoria
                            )}`}
                          >
                            {item.categoria}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-slate-300">Concepto</p>
                        <p className="mt-1 text-slate-100">{item.concepto}</p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-300">Monto</p>
                        <p className="mt-1 text-xl font-bold text-white">{money(item.monto)}</p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-300">Comprobante</p>
                        {item.comprobante_url ? (
                          <a
                            href={item.comprobante_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-sm font-semibold text-cyan-300 underline-offset-2 hover:underline"
                          >
                            Ver recibo
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-slate-400">Sin archivo</p>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <a
                          href={`/admin/gastos?editar=${item.id}`}
                          className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-white transition hover:bg-cyan-400"
                        >
                          Editar
                        </a>

                        <form action={eliminarGasto}>
                          <input type="hidden" name="id" value={item.id} />
                          <ConfirmDeleteButton
                            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
                            confirmText="Seguro que quieres eliminar este gasto? Esta accion no se puede deshacer."
                          >
                            Eliminar
                          </ConfirmDeleteButton>
                        </form>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

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

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "orange" | "cyan" | "blue" | "orangeSoft";
}) {
  const tones = {
    orange: "border-[#EF4937]/30 bg-[#EF4937]/12",
    cyan: "border-cyan-500/20 bg-cyan-500/10",
    blue: "border-blue-500/20 bg-blue-500/10",
    orangeSoft: "border-[#EF4937]/20 bg-[#EF4937]/8",
  };

  return (
    <div className={`rounded-[24px] border p-4 text-white shadow-xl ${tones[tone]}`}>
      <p className="text-sm text-slate-200">{title}</p>
      <p className="mt-3 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
