import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserSafe } from "@/lib/auth";
import MesesEstadoList from "@/components/vecino/meses-estado-list";
import ComprobanteUploadForm from "@/components/vecino/comprobante-upload-form";
import {
  getCuotaEstadoVigente,
  getCuotaMontoVigente,
  getCuotaMoraDetalle,
} from "@/lib/cuotas";
import { ensureCurrentMonthCuotasForBlock } from "@/lib/cuotas-sync";
import { formatPeriodoLabel } from "@/lib/periodo";
import { parseAdminPaymentDetails } from "@/lib/admin-payment";

type SearchParams = {
  sent?: string | string[];
  error?: string;
  detalle?: string;
};

type CuotaRow = {
  id: string;
  periodo: string | null;
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number | null;
  estado: string | null;
  anio: number | null;
  mes: number | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};

type ConfirmacionRow = {
  id: string;
  cuota_id: string | null;
  estado: string | null;
  created_at: string | null;
  revisado_at?: string | null;
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


type ConfigRow = {
  dia_vencimiento: number | null;
  valor_mora: number | null;
  nombre_administracion?: string | null;
};

type AdminPagoRow = {
  nombre: string | null;
  telefono: string | null;
  username: string | null;
  activo?: boolean | null;
  created_at?: string | null;
};

type BloquePagoRow = {
  pago_banco: string | null;
  pago_numero_cuenta: string | null;
  pago_qr_path: string | null;
};

type EstadoFila = "pendiente" | "en_revision" | "pagado";

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstName(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "vecino";
  return raw.split(/\s+/)[0] || "vecino";
}

function detailForError(error: string, detalle: string) {
  if (error === "datos") return "Completa todos los datos del formulario.";
  if (error === "cuota") return "Ese mes ya no esta pendiente.";
  if (error === "orden") return "Primero debes pagar el mes mas antiguo pendiente.";
  if (error === "enrevision") return "Ese mes ya tiene un comprobante en revision.";
  if (error === "upload") return `No se pudo subir el archivo${detalle ? `: ${detalle}` : "."}`;
  if (error === "confirmacion") return "No se pudo registrar el comprobante.";
  if (error === "servicio_suspendido") return "El servicio de este edificio se encuentra temporalmente suspendido por estado de facturacion.";
  return "No se pudo completar el envio.";
}

function isRecentWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function getParamValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? String(value[0] || "") : String(value);
}


export default async function VecinoPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const sentValue = getParamValue(params.sent);
  const cookieStore = await cookies();
  const sentCookie = cookieStore.get("vecino_comprobante_sent")?.value || "";
  const avisosVistosAt = cookieStore.get("vecino_avisos_vistos_at")?.value || null;
  const avisosVistosDate = avisosVistosAt ? new Date(avisosVistosAt) : null;
  const avisosVistosIso = avisosVistosDate && !Number.isNaN(avisosVistosDate.getTime()) ? avisosVistosDate.toISOString() : "1970-01-01T00:00:00.000Z";
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const user = await getAuthUserSafe(supabase);

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, departamento_id, bloque_id")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    redirect("/login");
  }

  const bloqueId = perfil.bloque_id;
  if (!bloqueId) redirect("/login");
  await ensureCurrentMonthCuotasForBlock(adminSupabase, bloqueId);

  const [
    { data: cuotas },
    { data: confirmaciones },
    { data: pagos },
    { data: avisosBloque },
    { data: respuestasPendientes },
    { data: config },
    { data: adminsBloque },
    { data: bloquePago },
  ] =
    await Promise.all([
      supabase
        .from("cuotas")
        .select("id, periodo, monto_base, mora_acumulada, monto_total, estado, anio, mes, fecha_vencimiento, created_at")
        .eq("bloque_id", perfil.bloque_id)
        .eq("departamento_id", perfil.departamento_id)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false }),
      supabase
        .from("confirmaciones_pago")
        .select("id, cuota_id, estado, created_at, revisado_at")
        .eq("bloque_id", perfil.bloque_id)
        .eq("departamento_id", perfil.departamento_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pagos")
        .select("id, cuota_id")
        .eq("bloque_id", perfil.bloque_id)
        .eq("departamento_id", perfil.departamento_id)
        .order("fecha_pago", { ascending: false }),
      adminSupabase
        .from("avisos")
        .select("id, titulo, mensaje, created_at")
        .eq("bloque_id", perfil.bloque_id)
        .eq("publicado", true)
        .gt("created_at", avisosVistosIso)
        .order("created_at", { ascending: false })
        .limit(20),
      adminSupabase
        .from("buzon_sugerencias")
        .select("id")
        .eq("vecino_id", perfil.id)
        .eq("estado", "respondido")
        .eq("respuesta_leida", false),
      adminSupabase
        .from("configuracion_bloque")
        .select("dia_vencimiento, valor_mora, nombre_administracion")
        .eq("bloque_id", perfil.bloque_id)
        .maybeSingle(),
      adminSupabase
        .from("usuarios")
        .select("nombre, telefono, username, activo, created_at")
        .eq("rol", "admin")
        .eq("bloque_id", perfil.bloque_id)
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("bloques")
        .select("pago_banco, pago_numero_cuenta, pago_qr_path")
        .eq("id", perfil.bloque_id)
        .maybeSingle(),
    ]);

  const cuotasRows = ((cuotas ?? []) as CuotaRow[]).map((item) => ({
    ...item,
    monto_total: getCuotaMontoVigente(item, config as ConfigRow | null),
    estado: getCuotaEstadoVigente(item, config as ConfigRow | null),
  }));
  const confirmacionesRows = (confirmaciones ?? []) as ConfirmacionRow[];
  const pagosRows = (pagos ?? []) as PagoRow[];
  const avisosNuevos = (avisosBloque ?? []) as NotificacionVecinoRow[];
  const respuestasNuevas = respuestasPendientes?.length ?? 0;
  const totalNovedades = avisosNuevos.length + respuestasNuevas;
  const configRow = (config ?? null) as ConfigRow | null;
  const adminsPagoRows = (adminsBloque ?? []) as AdminPagoRow[];
  const bloquePagoRow = (bloquePago ?? null) as BloquePagoRow | null;
  const adminPago =
    adminsPagoRows.find((item) => item.activo !== false) ??
    adminsPagoRows[0] ??
    null;
  const paymentFromAdmin = parseAdminPaymentDetails(adminPago?.username);
  const adminQrVersion = encodeURIComponent(
    String(
      bloquePagoRow?.pago_qr_path ||
        paymentFromAdmin.qrPath ||
        perfil.bloque_id ||
        "fallback"
    )
  );
  const adminQrPath = `/api/storage/qr-pago?b=${encodeURIComponent(
    String(perfil.bloque_id || "")
  )}&v=${adminQrVersion}`;
  const adminNombreCompleto = String(
    adminPago?.nombre || configRow?.nombre_administracion || "Administrador del bloque"
  );
  const adminCelular = String(adminPago?.telefono || "-");
  const bancoPago = String(bloquePagoRow?.pago_banco || paymentFromAdmin.banco || "-");
  const cuentaPago = String(
    bloquePagoRow?.pago_numero_cuenta || paymentFromAdmin.numeroCuenta || "-"
  );
  const mostrarAvisoDirecto = respuestasNuevas === 0 && avisosNuevos.length === 1;
  const avisoDirecto = mostrarAvisoDirecto ? avisosNuevos[0] : null;

  const pendingConfirmacionByCuota = new Map<string, ConfirmacionRow>();
  const rejectedAtByCuota = new Map<string, string>();
  for (const item of confirmacionesRows) {
    const cuotaId = item.cuota_id || "";
    const estado = String(item.estado || "").toLowerCase();
    if (!cuotaId) continue;
    if (estado === "pendiente" && !pendingConfirmacionByCuota.has(cuotaId)) {
      pendingConfirmacionByCuota.set(cuotaId, item);
    }
    if (estado === "rechazado") {
      const rejectedAt = item.revisado_at || item.created_at || "";
      if (!rejectedAt) continue;
      const current = rejectedAtByCuota.get(cuotaId);
      if (!current || new Date(rejectedAt).getTime() > new Date(current).getTime()) {
        rejectedAtByCuota.set(cuotaId, rejectedAt);
      }
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
      rejectedAt: status === "pendiente" ? rejectedAtByCuota.get(item.id) || null : null,
    };
  });

  const filasPendientes = filas.filter((item) => item.status === "pendiente");
  const filasEnRevision = filas.filter((item) => item.status === "en_revision");
  const estaAlDia = filasPendientes.length === 0 && filasEnRevision.length === 0;
  const montoPendienteTotal = filasPendientes.reduce(
    (total, item) => total + Number(item.monto_total || 0),
    0
  );
  const estadoResumenBoxes = [
    { label: "Meses pendientes", value: String(filasPendientes.length) },
    { label: "Monto total pendiente", value: money(montoPendienteTotal) },
  ];

  const filasPendientesOrdenadas = [...filasPendientes].sort((a, b) => {
    const anioA = Number(a.anio || 0);
    const anioB = Number(b.anio || 0);
    if (anioA !== anioB) return anioA - anioB;
    return Number(a.mes || 0) - Number(b.mes || 0);
  });
  const cuotaHabilitada = filasPendientesOrdenadas[0] ?? null;
  const cuotaHabilitadaMoraDetalle = cuotaHabilitada
    ? getCuotaMoraDetalle(cuotaHabilitada, configRow)
    : [];
  const cuotaHabilitadaMontoBase = Number(
    cuotaHabilitada?.monto_base ?? cuotaHabilitada?.monto_total ?? 0
  );
  const cuotaHabilitadaTotalMora = cuotaHabilitadaMoraDetalle.reduce(
    (total, item) => total + item.monto,
    0
  );

  const sent =
    sentValue === "1" ||
    sentValue.toLowerCase() === "true" ||
    sentValue.toLowerCase() === "ok" ||
    sentCookie === "1";
  const error = params.error || "";
  const detalle = params.detalle || "";

  return (
    <main className="space-y-2.5 md:space-y-3">
      <section className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:hidden">
        <div className="space-y-2.5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">
            Pagos del vecino
          </p>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold leading-tight text-white">Estado de cuotas</h1>
            <Link
              href="#subir-comprobante"
              className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-[#ff5a3d] px-3 text-[11px] font-bold text-white transition hover:brightness-110"
            >
              Ir a subir comprobante
            </Link>
          </div>
          {estaAlDia ? (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <p className="text-lg font-bold text-cyan-100">OK Estas al dia</p>
              <p className="mt-1 text-xs text-cyan-50">Todos tus pagos estan registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              <InfoBox label="Meses pendientes" value={String(filasPendientes.length)} />
              <InfoBox label="Monto total pendiente" value={money(montoPendienteTotal)} />
            </div>
          )}

        </div>
      </section>

      <section className="hidden overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10 md:block">
        <div className="grid gap-3 p-4 md:p-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-4 shadow-2xl ring-1 ring-white/10 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Hola {firstName(perfil.nombre)},
            </p>
            <h1 className="mt-2 text-lg font-bold leading-tight text-white md:text-3xl">
              Que quieres hacer ahora?
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Este es tu estado de cuentas.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-[#2f4b6c] p-3 md:p-4">
            {estaAlDia ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <p className="text-2xl font-bold text-cyan-100">OK Estas al dia</p>
                <p className="mt-1 text-sm text-cyan-50">Todos tus pagos estan registrados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {estadoResumenBoxes.map((item) => (
                  <InfoBox key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {sent ? (
        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-white/10 md:rounded-[24px] md:px-5 md:py-4">
          Tu pago quedó pendiente de revisión. El administrador lo aprobará cuando revise el comprobante.
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 ring-1 ring-white/10 md:rounded-[24px] md:px-5 md:py-4">
          {detailForError(error, detalle)}
        </section>
      ) : null}

      {totalNovedades > 0 ? (
        mostrarAvisoDirecto && avisoDirecto ? (
          <div className="rounded-2xl border-2 border-orange-300/50 bg-orange-500/10 px-3 py-3 text-orange-100 ring-1 ring-white/10 md:rounded-[24px] md:px-5 md:py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200 md:text-xs md:tracking-[0.22em]">
              Aviso del bloque
            </p>
            <p className="mt-1 text-sm font-bold text-orange-50">
              {avisoDirecto.titulo || "Nuevo aviso"}
            </p>
            <p className="mt-1 text-sm text-orange-100">
              {avisoDirecto.mensaje || "Tienes un nuevo aviso para revisar."}
            </p>
          </div>
        ) : (
          <Link
            href="/vecino/comunicacion/abrir"
            className="block rounded-2xl border-2 border-orange-300/50 bg-orange-500/10 px-3 py-3 text-orange-100 ring-1 ring-white/10 transition hover:bg-orange-500/15 md:rounded-[24px] md:px-5 md:py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200 md:text-xs md:tracking-[0.22em]">
                  Avisos para ti
                </p>
                <p className="mt-1 text-sm font-semibold text-orange-50">
                  Tienes avisos o mensajes nuevos para revisar.
                </p>
              </div>
              <span className="rounded-full border border-orange-200/50 bg-orange-500/20 px-2.5 py-1 text-[10px] font-bold text-orange-50 md:text-[11px]">
                {totalNovedades} nuevo(s)
              </span>
            </div>
          </Link>
        )
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:rounded-[24px]">
        <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2 md:gap-3 md:px-6 md:py-4">
          <div>
            <h2 className="mt-1 text-lg font-bold text-white md:mt-2 md:text-2xl">Meses y estado</h2>
          </div>
        </div>

        <div className="overflow-x-auto p-4 md:p-4">
          {filas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">No hay cuotas registradas</p>
            </div>
          ) : (
            <MesesEstadoList
              filas={filas}
              cuotaHabilitadaId={cuotaHabilitada?.id || null}
              cuotaHabilitadaPeriodo={cuotaHabilitada?.periodo || null}
            />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0f2d48] via-[#1c4569] to-[#245b84] shadow-xl ring-1 ring-white/10 md:rounded-[24px]">
        <div className="grid items-center gap-3 p-3 md:grid-cols-[1.2fr_0.8fr] md:gap-6 md:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200 md:text-[11px] md:tracking-[0.28em]">
              Pago rapido
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-white md:mt-2 md:text-3xl">QR de pago del administrador</h2>
            <p className="mt-2 text-xs text-slate-100 md:mt-3 md:text-base">
              Escanea este QR para copiar los datos de pago. Asegurate de transferir el monto del
              mes habilitado.
            </p>

            <div className="mt-2 grid gap-1 text-xs text-cyan-50 md:mt-4 md:gap-2 md:text-sm">
              <p>
                <span className="font-semibold text-cyan-100">Admin:</span> {adminNombreCompleto}
              </p>
              <p>
                <span className="font-semibold text-cyan-100">Celular:</span> {adminCelular}
              </p>
              <p>
                <span className="font-semibold text-cyan-100">Banco:</span> {bancoPago}
              </p>
              <p>
                <span className="font-semibold text-cyan-100">Cuenta:</span> {cuentaPago}
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[180px] rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/25 md:max-w-[250px] md:rounded-3xl md:p-3">
            <img
              src={adminQrPath}
              alt="QR para pago del admin"
              className="h-auto w-full rounded-xl md:rounded-2xl"
            />
            <a
              href={adminQrPath}
              download="qr-pago-admin.png"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center rounded-xl bg-[#ff5a3d] px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-white transition hover:brightness-110 md:mt-3 md:min-h-[40px] md:px-4 md:text-xs md:tracking-[0.08em]"
            >
              Descargar QR
            </a>
          </div>
        </div>
      </section>

      <section
        id="subir-comprobante"
        className="overflow-hidden rounded-2xl bg-[#213b59] shadow-xl ring-1 ring-white/10 md:rounded-[24px]"
      >
        <div className="border-b border-white/10 px-3 py-2 md:px-6 md:py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300 md:text-xs md:tracking-[0.3em]">
            Comprobante
          </p>
          <h2 className="mt-1 text-lg font-bold text-white md:mt-2 md:text-2xl">Subir comprobante</h2>
        </div>

        <div className="space-y-3 p-3 md:p-4">
          {sent ? (
            <div className="mb-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-white/10">
              Tu pago quedó pendiente de revisión. El administrador lo aprobará cuando revise el comprobante.
            </div>
          ) : null}


          {filasPendientes.length === 0 ? (
            <div className="rounded-[24px] border border-cyan-400/30 bg-cyan-500/10 px-5 py-8 text-center">
              <p className="text-lg font-bold text-cyan-100">
                No tienes meses pendientes para pagar
              </p>
              <p className="mt-2 text-sm text-cyan-50">
                Cuando no tengas cuotas pendientes, aqui ya no veras esta opcion.
              </p>
            </div>
          ) : (
            <ComprobanteUploadForm
              cuotaId={cuotaHabilitada?.id || ""}
              periodoLabel={formatPeriodoLabel(cuotaHabilitada?.periodo)}
              cuotaBaseLabel={money(cuotaHabilitadaMontoBase)}
              moraDetalle={cuotaHabilitadaMoraDetalle.map((item) => ({
                periodoLabel: formatPeriodoLabel(
                  `${item.anio}-${String(item.mes).padStart(2, "0")}`
                ),
                montoLabel: money(item.monto),
              }))}
              totalMoraLabel={money(cuotaHabilitadaTotalMora)}
              montoLabel={money(cuotaHabilitada?.monto_total)}
            />
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
    <div className="rounded-xl bg-[#3a5879] p-2.5 ring-1 ring-white/10 md:rounded-2xl md:p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300 md:text-xs md:tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-base font-bold leading-tight text-white md:mt-2 md:text-xl">{value}</p>
    </div>
  );
}




