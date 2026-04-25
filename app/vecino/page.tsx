import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = {
  sent?: string;
  error?: string;
  detalle?: string;
};

type CuotaRow = {
  id: string;
  periodo: string | null;
  monto_total: number | null;
  estado: string | null;
  anio: number | null;
  mes: number | null;
};

type ConfirmacionRow = {
  id: string;
  cuota_id: string | null;
  estado: string | null;
  created_at: string | null;
};

type PagoRow = {
  id: string;
  cuota_id: string | null;
};

type NotificacionVecinoRow = {
  id: string;
  tipo: string | null;
  titulo: string | null;
  mensaje: string | null;
  created_at: string | null;
  leida: boolean | null;
};

type AvisoBloqueRow = {
  id: string;
  titulo: string | null;
  mensaje: string | null;
  created_at: string | null;
};

type EstadoFila = "pendiente" | "en_revision" | "pagado";

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function estadoLabel(value: EstadoFila) {
  if (value === "pagado") return "Pagado";
  if (value === "en_revision") return "En revision";
  return "Pendiente";
}

function estadoClass(value: EstadoFila) {
  if (value === "pagado") {
    return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
  }
  if (value === "en_revision") {
    return "border-yellow-400/40 bg-yellow-500/10 text-yellow-100";
  }
  return "border-orange-400/30 bg-orange-500/10 text-orange-100";
}

function detailForError(error: string, detalle: string) {
  if (error === "datos") return "Completa todos los datos del formulario.";
  if (error === "cuota") return "El mes seleccionado ya no esta pendiente.";
  if (error === "orden") return "Debes pagar primero el mes mas antiguo pendiente.";
  if (error === "enrevision") return "Ese mes ya tiene un comprobante en revision.";
  if (error === "upload") return `No se pudo subir el archivo${detalle ? `: ${detalle}` : "."}`;
  if (error === "confirmacion") return "No se pudo registrar la confirmacion.";
  return "No se pudo completar el envio.";
}

export default async function VecinoPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const adminQrPath = "/qr-pago-admin.png";

  const params = (await searchParams) ?? {};
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, departamento_id, bloque_id")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    redirect("/login");
  }

  const [
    { data: cuotas },
    { data: confirmaciones },
    { data: pagos },
    { data: notificaciones },
    { data: avisosBloque },
  ] =
    await Promise.all([
      supabase
        .from("cuotas")
        .select("id, periodo, monto_total, estado, anio, mes")
        .eq("departamento_id", perfil.departamento_id)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false }),
      supabase
        .from("confirmaciones_pago")
        .select("id, cuota_id, estado, created_at")
        .eq("departamento_id", perfil.departamento_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pagos")
        .select("id, cuota_id")
        .eq("departamento_id", perfil.departamento_id)
        .order("fecha_pago", { ascending: false }),
      adminSupabase
        .from("notificaciones_vecino")
        .select("id, tipo, titulo, mensaje, created_at, leida")
        .eq("bloque_id", perfil.bloque_id)
        .eq("departamento_id", perfil.departamento_id)
        .eq("leida", false)
        .order("created_at", { ascending: false })
        .limit(3),
      adminSupabase
        .from("avisos")
        .select("id, titulo, mensaje, created_at")
        .eq("bloque_id", perfil.bloque_id)
        .eq("publicado", true)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const cuotasRows = (cuotas ?? []) as CuotaRow[];
  const confirmacionesRows = (confirmaciones ?? []) as ConfirmacionRow[];
  const pagosRows = (pagos ?? []) as PagoRow[];
  const notificacionesRows = (notificaciones ?? []) as NotificacionVecinoRow[];
  const avisosBloqueRows = (avisosBloque ?? []) as AvisoBloqueRow[];

  const pendingConfirmacionByCuota = new Map<string, ConfirmacionRow>();
  for (const item of confirmacionesRows) {
    const cuotaId = item.cuota_id || "";
    const estado = String(item.estado || "").toLowerCase();
    if (!cuotaId || estado !== "pendiente") continue;
    if (!pendingConfirmacionByCuota.has(cuotaId)) {
      pendingConfirmacionByCuota.set(cuotaId, item);
    }
  }

  const pagoByCuota = new Map<string, string>();
  for (const item of pagosRows) {
    const cuotaId = item.cuota_id || "";
    if (!cuotaId || pagoByCuota.has(cuotaId)) continue;
    pagoByCuota.set(cuotaId, item.id);
  }

  const filas = cuotasRows.map((item) => {
    const cuotaEstado = String(item.estado || "").toLowerCase();
    const hasPendingConfirmacion = pendingConfirmacionByCuota.has(item.id);
    const status: EstadoFila =
      cuotaEstado === "pagado"
        ? "pagado"
        : hasPendingConfirmacion
        ? "en_revision"
        : "pendiente";

    return {
      ...item,
      status,
      reciboPagoId: pagoByCuota.get(item.id) || null,
    };
  });

  const filasPendientes = filas.filter((item) => item.status === "pendiente");
  const filasEnRevision = filas.filter((item) => item.status === "en_revision");
  const filasPagadas = filas.filter((item) => item.status === "pagado");

  const filasPendientesOrdenadas = [...filasPendientes].sort((a, b) => {
    const anioA = Number(a.anio || 0);
    const anioB = Number(b.anio || 0);
    if (anioA !== anioB) return anioA - anioB;
    return Number(a.mes || 0) - Number(b.mes || 0);
  });
  const cuotaHabilitada = filasPendientesOrdenadas[0] ?? null;

  const sent = params.sent === "1";
  const error = params.error || "";
  const detalle = params.detalle || "";

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[24px] border border-cyan-400/30 bg-gradient-to-br from-[#0f2d48] via-[#1c4569] to-[#245b84] shadow-xl ring-1 ring-white/10">
        <div className="grid items-center gap-5 p-4 md:grid-cols-[1.2fr_0.8fr] md:gap-6 md:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">
              Pago rapido
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">QR de pago del admin</h2>
            <p className="mt-3 text-sm text-slate-100 md:text-base">
              Escanea este QR para copiar los datos de pago. Asegurate de transferir el monto del
              mes habilitado.
            </p>

            <div className="mt-4 grid gap-2 text-sm text-cyan-50">
              <p>
                <span className="font-semibold text-cyan-100">Banco:</span> Union
              </p>
              <p>
                <span className="font-semibold text-cyan-100">Titular:</span> Administracion
                Edificio Central
              </p>
              <p>
                <span className="font-semibold text-cyan-100">Cuenta:</span> 123-4567890
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[250px] rounded-3xl bg-white p-3 shadow-2xl shadow-black/25">
            <Image
              src={adminQrPath}
              alt="QR para pago del admin"
              width={420}
              height={420}
              sizes="(max-width: 768px) 220px, 250px"
              quality={90}
              preload
              className="h-auto w-full rounded-2xl"
            />
            <a
              href={adminQrPath}
              download="qr-pago-admin.png"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
            >
              Descargar QR
            </a>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10 md:hidden">
        <div className="space-y-3 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">
            Pagos del vecino
          </p>
          <h1 className="text-2xl font-bold leading-tight text-white">Estado de cuotas</h1>
          <p className="text-sm text-slate-200">
            Pendientes {filasPendientes.length} - En revision {filasEnRevision.length} - Pagados{" "}
            {filasPagadas.length}
          </p>

          <details className="group rounded-2xl border border-white/15 bg-white/5 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-cyan-100">
              Ver detalle
              <span className="inline-flex rounded-full border border-cyan-300/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] group-open:hidden">
                Abrir
              </span>
              <span className="hidden rounded-full border border-white/30 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] group-open:inline-flex">
                Cerrar
              </span>
            </summary>

            <p className="mt-3 text-sm text-slate-200">
              Revisa tus meses pendientes y sube el comprobante solo del mes habilitado.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <InfoBox label="Pendientes" value={String(filasPendientes.length)} />
              <InfoBox label="En revision" value={String(filasEnRevision.length)} />
              <InfoBox label="Pagados" value={String(filasPagadas.length)} />
              <InfoBox label="Total meses" value={String(filas.length)} />
            </div>

            <div className="mt-3">
              <Link
                href="#subir-comprobante"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white transition hover:brightness-110"
              >
                Ir a subir comprobante
              </Link>
            </div>
          </details>
        </div>
      </section>

      <section className="hidden overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10 md:block">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Pagos del vecino
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Estado de cuotas por mes
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Revisa que meses estan pendientes, cuales estan en revision y cuales
              ya fueron aprobados.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Pendientes" value={String(filasPendientes.length)} />
              <InfoBox label="En revision" value={String(filasEnRevision.length)} />
              <InfoBox label="Pagados" value={String(filasPagadas.length)} />
              <InfoBox label="Total meses" value={String(filas.length)} />
            </div>
          </div>
        </div>
      </section>

      {sent ? (
        <section className="rounded-[24px] border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 text-cyan-100 ring-1 ring-white/10">
          Comprobante enviado. El admin lo revisara antes de aprobarlo.
        </section>
      ) : null}

      {error ? (
        <section className="rounded-[24px] border border-red-400/30 bg-red-500/10 px-5 py-4 text-red-100 ring-1 ring-white/10">
          {detailForError(error, detalle)}
        </section>
      ) : null}

      {notificacionesRows.length > 0 || avisosBloqueRows.length > 0 ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100 ring-1 ring-white/10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
            Avisos para ti
          </p>
          <div className="mt-3 space-y-3">
            {notificacionesRows.length > 0
              ? notificacionesRows.map((item) => (
                  <article
                    key={`notif-${item.id}`}
                    className="rounded-2xl border border-amber-200/20 bg-black/10 p-3"
                  >
                    <p className="text-sm font-bold text-amber-50">
                      {item.titulo || "Aviso importante"}
                    </p>
                    <p className="mt-1 text-sm text-amber-100">
                      {item.mensaje || ""}
                    </p>
                  </article>
                ))
              : avisosBloqueRows.map((item) => (
                  <article
                    key={`aviso-${item.id}`}
                    className="rounded-2xl border border-amber-200/20 bg-black/10 p-3"
                  >
                    <p className="text-sm font-bold text-amber-50">
                      {item.titulo || "Aviso del bloque"}
                    </p>
                    <p className="mt-1 text-sm text-amber-100">
                      {item.mensaje || ""}
                    </p>
                  </article>
                ))}
          </div>
          <div className="mt-3">
            <Link
              href="/vecino/avisos"
              className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20"
            >
              Ver todos los avisos
            </Link>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Tabla unica
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Meses y estado</h2>
          </div>
        </div>

        <div className="p-4 md:p-5">
          {filas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">No hay cuotas registradas</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filas.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-[#2d4a6c] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-bold text-white">{item.periodo || "Sin periodo"}</p>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${estadoClass(
                          item.status
                        )}`}
                      >
                        {estadoLabel(item.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-200">Monto: {money(item.monto_total)}</p>

                    <div className="mt-3">
                      {item.status === "pendiente" ? (
                        cuotaHabilitada?.id === item.id ? (
                          <Link
                            href="#subir-comprobante"
                            className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white transition hover:brightness-110"
                          >
                            Subir comprobante
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-orange-100">
                            Debes pagar primero {cuotaHabilitada?.periodo || "mes anterior"}
                          </span>
                        )
                      ) : null}

                      {item.status === "en_revision" ? (
                        <span className="text-xs font-semibold text-yellow-100">
                          Esperando validacion admin
                        </span>
                      ) : null}

                      {item.status === "pagado" ? (
                        item.reciboPagoId ? (
                          <Link
                            href={`/vecino/recibos/${item.reciboPagoId}/pdf`}
                            target="_blank"
                            className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-cyan-500 px-4 text-xs font-bold text-white transition hover:bg-cyan-400"
                          >
                            Descargar recibo
                          </Link>
                        ) : (
                          <span className="text-xs text-cyan-100">Pago aprobado</span>
                        )
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full overflow-hidden rounded-2xl border border-white/10">
                  <thead className="bg-[#1f3d5f] text-left text-xs uppercase tracking-[0.2em] text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Mes</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((item) => (
                      <tr key={item.id} className="border-t border-white/10 bg-[#2d4a6c]">
                        <td className="px-4 py-4 font-semibold text-white">
                          {item.periodo || "Sin periodo"}
                        </td>
                        <td className="px-4 py-4 text-slate-100">{money(item.monto_total)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold ${estadoClass(
                              item.status
                            )}`}
                          >
                            {estadoLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {item.status === "pendiente" ? (
                            cuotaHabilitada?.id === item.id ? (
                              <Link
                                href="#subir-comprobante"
                                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                              >
                                Subir comprobante
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-orange-100">
                                Debes pagar primero {cuotaHabilitada?.periodo || "mes anterior"}
                              </span>
                            )
                          ) : null}

                          {item.status === "en_revision" ? (
                            <span className="text-sm font-semibold text-yellow-100">
                              Esperando validacion admin
                            </span>
                          ) : null}

                          {item.status === "pagado" ? (
                            item.reciboPagoId ? (
                              <Link
                                href={`/vecino/recibos/${item.reciboPagoId}/pdf`}
                                target="_blank"
                                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-white transition hover:bg-cyan-400"
                              >
                                Descargar recibo
                              </Link>
                            ) : (
                              <span className="text-sm text-cyan-100">Pago aprobado</span>
                            )
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section
        id="subir-comprobante"
        className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10"
      >
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Comprobante
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">Subir pago</h2>
        </div>

        <div className="p-5 md:p-6">
          {filasPendientes.length === 0 ? (
            <div className="rounded-[24px] border border-cyan-400/30 bg-cyan-500/10 px-5 py-8 text-center">
              <p className="text-lg font-bold text-cyan-100">
                No tienes meses pendientes para pagar
              </p>
              <p className="mt-2 text-sm text-cyan-50">
                Cuando todo este aprobado, no aparece opcion para subir comprobante.
              </p>
            </div>
          ) : (
            <form
              action="/api/vecino/reportar-pago"
              method="POST"
              encType="multipart/form-data"
              className="grid gap-5 xl:grid-cols-[1fr_1fr]"
            >
              <div className="space-y-2 xl:col-span-2">
                <label className="text-sm font-semibold text-white">
                  Mes habilitado para pagar
                </label>
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3">
                  <p className="text-sm font-bold text-cyan-100">
                    {cuotaHabilitada?.periodo || "Sin periodo"}
                  </p>
                  <p className="mt-1 text-xs text-cyan-50">
                    Monto: {money(cuotaHabilitada?.monto_total)}
                  </p>
                </div>
                <input type="hidden" name="cuota_id" value={cuotaHabilitada?.id || ""} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Referencia o detalle
                </label>
                <input
                  type="text"
                  name="referencia"
                  placeholder="Ej: transferencia BNB o QR"
                  required
                  className="w-full rounded-2xl border border-white/15 bg-[#173454] px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/40"
                />
              </div>

              <div className="space-y-2 xl:col-span-2">
                <label className="text-sm font-semibold text-white">
                  Archivo del comprobante
                </label>
                <input
                  type="file"
                  name="archivo"
                  required
                  className="w-full rounded-2xl border border-white/15 bg-[#173454] px-4 py-3 text-slate-200 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-cyan-400"
                />
              </div>

              <div className="xl:col-span-2">
                <button
                  type="submit"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
                >
                  Enviar comprobante
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
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
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-2 text-xl font-bold leading-tight text-white">{value}</p>
    </div>
  );
}

