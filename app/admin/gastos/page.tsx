import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { isBloqueActivo, requireAdmin } from "@/lib/auth";
import {
  formatBoliviaDate,
  formatBoliviaMonthLabel,
  getBoliviaDateParts,
  getCurrentBoliviaYearMonth,
  isDateInBoliviaMonth,
} from "@/lib/bolivia-time";
import { extname } from "node:path";
import ConfirmDeleteButton from "./_components/confirm-delete-button";
import ComprobanteImageInput from "./_components/comprobante-image-input";
import ConfirmMonthLockButton from "./_components/confirm-month-lock-button";

type GastoRow = {
  id: string;
  bloque_id: string;
  fecha_gasto: string;
  categoria: string;
  concepto: string;
  monto: number;
  comprobante_path: string | null;
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
  return formatBoliviaDate(value);
}

function esDelMesActual(fecha: string) {
  const periodoActual = getCurrentBoliviaYearMonth();
  return isDateInBoliviaMonth(fecha, periodoActual.year, periodoActual.month);
}

function monthKey(fecha: string) {
  const parts = getBoliviaDateParts(fecha);
  if (!parts) return "0000-00";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function monthLabel(fecha: string) {
  return formatBoliviaMonthLabel(fecha);
}

function parseMonthKey(key: string) {
  const [anioTxt, mesTxt] = key.split("-");
  const anio = Number(anioTxt);
  const mes = Number(mesTxt);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
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
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos?notice=servicio_suspendido");

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
  const adminSupabase = createAdminClient();
  const bloqueado = parseMonthKey(monthKey(fecha_gasto));
  if (bloqueado) {
    const { data: cierre } = await adminSupabase
      .from("gastos_cierres_mensuales")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("anio", bloqueado.anio)
      .eq("mes", bloqueado.mes)
      .maybeSingle();
    if (cierre) redirect("/admin/gastos");
  }

  await guardarCategoriaSiCorresponde(
    supabase,
    usuario.perfil.bloque_id,
    categoria,
    guardarCategoria
  );

  let comprobanteUrl: string | null | undefined = undefined;
  let comprobantePath: string | null | undefined = undefined;

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
      comprobantePath = fileName;
    }
  }

  const payloadBase = {
    fecha_gasto,
    categoria,
    concepto,
    monto,
  };

  const payloadConComprobante = {
    ...payloadBase,
    ...(comprobantePath ? { comprobante_path: comprobantePath } : {}),
    ...(comprobanteUrl ? { comprobante_url: comprobanteUrl } : {}),
  };

  const updateBuilder = supabase
    .from("gastos")
    .update(payloadConComprobante)
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  if (comprobanteUrl) {
    const { error: updateError } = await updateBuilder.select("id").single();
    if (updateError && String(updateError.message || "").includes("comprobante_path")) {
      await supabase
        .from("gastos")
        .update({
          ...payloadBase,
          ...(comprobanteUrl ? { comprobante_url: comprobanteUrl } : {}),
        })
        .eq("id", id)
        .eq("bloque_id", usuario.perfil.bloque_id);
    } else if (updateError && String(updateError.message || "").includes("comprobante_url")) {
      await supabase
        .from("gastos")
        .update(payloadBase)
        .eq("id", id)
        .eq("bloque_id", usuario.perfil.bloque_id);
    }
  } else {
    await updateBuilder;
  }

  redirect("/admin/gastos");
}

async function eliminarGasto(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos?notice=servicio_suspendido");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/gastos");

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: gasto } = await supabase
    .from("gastos")
    .select("fecha_gasto")
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id)
    .maybeSingle();
  if (!gasto) redirect("/admin/gastos");

  const bloqueado = parseMonthKey(monthKey(String(gasto.fecha_gasto || "")));
  if (bloqueado) {
    const { data: cierre } = await adminSupabase
      .from("gastos_cierres_mensuales")
      .select("id")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .eq("anio", bloqueado.anio)
      .eq("mes", bloqueado.mes)
      .maybeSingle();
    if (cierre) redirect("/admin/gastos");
  }

  await supabase
    .from("gastos")
    .delete()
    .eq("id", id)
    .eq("bloque_id", usuario.perfil.bloque_id);

  redirect("/admin/gastos");
}

async function toggleMesBloqueado(formData: FormData) {
  "use server";

  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos?notice=servicio_suspendido");

  const month_key = String(formData.get("month_key") || "");
  const parsed = parseMonthKey(month_key);
  if (!parsed) redirect("/admin/gastos");

  const adminSupabase = createAdminClient();
  const { data: existente, error: lockReadError } = await adminSupabase
    .from("gastos_cierres_mensuales")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("anio", parsed.anio)
    .eq("mes", parsed.mes)
    .maybeSingle();

  if (lockReadError) redirect("/admin/gastos");

  if (existente) {
    await adminSupabase.from("gastos_cierres_mensuales").delete().eq("id", existente.id);
  } else {
    await adminSupabase.from("gastos_cierres_mensuales").insert({
      bloque_id: usuario.perfil.bloque_id,
      anio: parsed.anio,
      mes: parsed.mes,
    });
  }

  redirect("/admin/gastos");
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams?: Promise<{ editar?: string; notice?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");
  if (!(await isBloqueActivo(usuario.perfil.bloque_id))) redirect("/admin/gastos?notice=servicio_suspendido");

  const params = (await searchParams) ?? {};
  const editarId = params.editar || "";

  const supabase = await createClient();

  const adminSupabase = createAdminClient();
  const [{ data: gastos, error }, { data: categorias }, { data: cierres }] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, bloque_id, fecha_gasto, categoria, concepto, monto, comprobante_path, comprobante_url")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("fecha_gasto", { ascending: false }),
    supabase
      .from("categorias_gasto")
      .select("id, nombre")
      .eq("bloque_id", usuario.perfil.bloque_id)
      .order("nombre", { ascending: true }),
    adminSupabase
      .from("gastos_cierres_mensuales")
      .select("anio, mes")
      .eq("bloque_id", usuario.perfil.bloque_id),
  ]);

  const rows = (gastos ?? []) as GastoRow[];
  const categoriasRows = (categorias ?? []) as CategoriaRow[];
  const categoriasSinOtros = categoriasRows.filter(
    (categoria) => categoria.nombre.trim().toLowerCase() !== "otros"
  );
  const monthsLocked = new Set((cierres ?? []).map((c) => `${c.anio}-${String(c.mes).padStart(2, "0")}`));

  const rowsMesActual = rows.filter((item) => esDelMesActual(item.fecha_gasto));
  const totalMesActual = rowsMesActual.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const movimientosMesActual = rowsMesActual.length;
  const categoriasMesActual = new Set(rowsMesActual.map((item) => item.categoria)).size;
  const ultimoGasto = rows[0];
  const mesesAgrupados = rows.reduce(
    (acc, item) => {
      const key = monthKey(item.fecha_gasto);
      const actual = acc.get(key);

      if (actual) {
        actual.items.push(item);
        actual.total += Number(item.monto || 0);
      } else {
        acc.set(key, {
          key,
          label: monthLabel(item.fecha_gasto),
          total: Number(item.monto || 0),
          items: [item],
        });
      }

      return acc;
    },
    new Map<
      string,
      { key: string; label: string; total: number; items: GastoRow[] }
    >()
  );

  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="p-4 md:p-4">
          <div className="rounded-[24px] bg-gradient-to-r from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                  Gestion de egresos
                </p>
                <h1 className="mt-1 text-lg font-bold leading-tight text-white md:text-3xl">
                  Gastos del bloque
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/gastos/nuevo"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
                >
                  Registrar gasto
                </Link>

                <Link
                  href="/admin/gastos/categorias"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  Categorias
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          Error cargando gastos: {error.message}
        </section>
      ) : null}

      {params.notice === "mes_distinto" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Gasto registrado en un mes distinto al actual.
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Gaste este mes" value={money(totalMesActual)} tone="orange" />
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
            Historial
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-white">Gastos registrados</h2>
            <p className="mt-1 text-xs text-slate-300">
              Aqui puedes revisar, editar o eliminar gastos guardados.
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
            {Array.from(mesesAgrupados.values()).map((grupo) => {
              const openByDefault =
                grupo.items.some((item) => item.id === editarId) || grupo === Array.from(mesesAgrupados.values())[0];
              const locked = monthsLocked.has(grupo.key);

              return (
                <details
                  key={grupo.key}
                  open={openByDefault}
                  className="overflow-hidden rounded-2xl border border-white/20 bg-[#2d4a6c] shadow-lg"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{grupo.label}</p>
                      <p className="text-xs text-slate-300">{grupo.items.length} movimiento(s)</p>
                      {locked ? (
                        <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          Bloqueado
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-bold text-cyan-200">Total: {money(grupo.total)}</p>
                  </summary>

                  <div className="flex flex-col items-end gap-1.5 border-t border-white/10 px-3 py-2">
                    <form action={toggleMesBloqueado}>
                      <input type="hidden" name="month_key" value={grupo.key} />
                      <ConfirmMonthLockButton
                        locked={locked}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                          locked
                            ? "border-amber-300/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                            : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                        }`}
                      />
                    </form>
                    <p className="text-[11px] text-slate-300">
                      Una vez cerrado no se podran editar los gastos de este mes.
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-white/10 px-3 py-2">
                    {grupo.items.map((item) => {
                      const enEdicion = editarId === item.id;

                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/20 bg-[#314f71] px-3 py-2"
                        >
                          {enEdicion && !locked ? (
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

                      <div className="grid gap-3 xl:grid-cols-12">
                        <div className="date-white xl:col-span-2">
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

                        <div className="xl:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Categoria
                          </label>
                          <select
                            name="categoria"
                            className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                            defaultValue={item.categoria || "Otros"}
                          >
                            <option value="Otros">Otros</option>
                            {item.categoria &&
                            item.categoria.trim().toLowerCase() !== "otros" &&
                            !categoriasSinOtros.some(
                              (categoria) =>
                                categoria.nombre.trim().toLowerCase() ===
                                item.categoria.trim().toLowerCase()
                            ) ? (
                              <option value={item.categoria}>{item.categoria}</option>
                            ) : null}
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
                            defaultValue={item.concepto}
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#173454] px-3 py-2 text-white outline-none transition focus:border-cyan-400/40"
                          />
                        </div>

                        <div className="xl:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Monto
                          </label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-500">
                              Bs
                            </span>
                            <input
                              type="number"
                              name="monto"
                              step="0.01"
                              defaultValue={item.monto}
                              required
                              className="w-full rounded-xl border border-white/10 bg-[#173454] py-2 pl-9 pr-2 text-white outline-none transition focus:border-cyan-400/40"
                            />
                          </div>
                        </div>

                        <div className="xl:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-100">
                            Nuevo recibo / factura
                          </label>
                          <ComprobanteImageInput name="comprobante" />
                          {item.comprobante_path || item.comprobante_url ? (
                            <a
                              href={`/api/admin/gastos/${item.id}/comprobante`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
                            >
                              Ver comprobante actual
                            </a>
                          ) : null}
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
                            <div className="grid gap-2 md:grid-cols-[110px_130px_2fr_140px_auto] md:items-center">
                              <p className="text-sm font-semibold text-white">{formatDate(item.fecha_gasto)}</p>

                              <span
                                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${categoriaClass(
                                  item.categoria
                                )}`}
                              >
                                {item.categoria}
                              </span>

                              <p className="truncate text-sm text-slate-100">{item.concepto}</p>

                              <p className="text-sm font-bold text-white">{money(item.monto)}</p>

                              <div className="flex flex-nowrap justify-end gap-2">
                                {item.comprobante_path || item.comprobante_url ? (
                                  <a
                                    href={`/api/admin/gastos/${item.id}/comprobante`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
                                  >
                                    Ver recibo
                                  </a>
                                ) : (
                                  <span className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                                    Sin recibo
                                  </span>
                                )}

                                <a
                                  href={locked ? "#" : `/admin/gastos?editar=${item.id}`}
                                  aria-disabled={locked}
                                  className={`rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cyan-400 ${
                                    locked ? "pointer-events-none opacity-40" : ""
                                  }`}
                                >
                                  Editar
                                </a>

                                <form action={eliminarGasto}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <ConfirmDeleteButton
                                    className={`rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 ${
                                      locked ? "pointer-events-none opacity-40" : ""
                                    }`}
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
                </details>
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


