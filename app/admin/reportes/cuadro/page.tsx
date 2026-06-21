import Link from "next/link";
import { redirect } from "next/navigation";
import CuadroVitrina, { type CuadroRow } from "@/components/cuotas/cuadro-vitrina";
import PrintButton from "@/components/print-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{ anio?: string }>;
type DepartamentoRow = { id: string; numero: string | null };
type VecinoRow = { departamento_id: string | null; nombre: string | null; activo: boolean | null };
type CuotaRow = { departamento_id: string; anio: number; mes: number; estado: string | null };

function parseYear(value: string | undefined) {
  const nowYear = new Date().getUTCFullYear();
  const year = Number(value || nowYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return nowYear;
  return year;
}

function deptoSortValue(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const num = Number(raw);
  return Number.isFinite(num) ? num : -1;
}

function priority(state: string) {
  const v = state.toLowerCase();
  if (v === "vencido") return 3;
  if (v === "pendiente") return 2;
  if (v === "pagado") return 1;
  return 0;
}

function normalizeCellState(value: string | null | undefined): "pagado" | "pendiente" | "vencido" | "sin_registro" {
  const v = String(value || "").toLowerCase();
  if (v === "pagado") return "pagado";
  if (v === "pendiente") return "pendiente";
  if (v === "vencido") return "vencido";
  return "sin_registro";
}

function quotaState(value: string | undefined) {
  return String(value || "");
}

export default async function ReporteCuadroPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = await searchParams;
  const anio = parseYear(params?.anio);

  const supabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;

  const [{ data: bloque }, { data: departamentosData }, { data: vecinosData }, { data: cuotasData }] =
    await Promise.all([
      supabase.from("bloques").select("nombre, codigo").eq("id", bloqueId).maybeSingle(),
      supabase.from("departamentos").select("id, numero").eq("bloque_id", bloqueId),
      supabase.from("usuarios").select("departamento_id, nombre, activo").eq("bloque_id", bloqueId).eq("rol", "vecino"),
      supabase.from("cuotas").select("departamento_id, anio, mes, estado").eq("bloque_id", bloqueId).lte("anio", anio),
    ]);

  const departamentos = (departamentosData ?? []) as DepartamentoRow[];
  const vecinos = (vecinosData ?? []) as VecinoRow[];
  const cuotas = (cuotasData ?? []) as CuotaRow[];

  const nombreBloque = bloque?.nombre ? String(bloque.nombre) : `Bloque ${String(bloque?.codigo || "-")}`;

  const vecinosPorDepto = new Map<string, string>();
  for (const vecino of vecinos) {
    const deptoId = String(vecino.departamento_id || "");
    if (!deptoId || vecinosPorDepto.has(deptoId)) continue;
    if (vecino.activo === false) continue;
    vecinosPorDepto.set(deptoId, String(vecino.nombre || "Sin nombre"));
  }

  const cuotaKey = new Map<string, string>();
  const deudaAnterior = new Set<string>();
  for (const cuota of cuotas) {
    const deptoId = String(cuota.departamento_id || "");
    if (!deptoId) continue;
    const estado = String(cuota.estado || "");

    if (Number(cuota.anio) < anio && (estado === "pendiente" || estado === "vencido")) {
      deudaAnterior.add(deptoId);
      continue;
    }
    if (Number(cuota.anio) !== anio) continue;
    const month = Number(cuota.mes);
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;

    const key = `${deptoId}:${month}`;
    const current = quotaState(cuotaKey.get(key));
    if (priority(estado) >= priority(current)) {
      cuotaKey.set(key, estado);
    }
  }

  const rows: CuadroRow[] = [...departamentos]
    .sort((a, b) => deptoSortValue(String(b.numero || "")) - deptoSortValue(String(a.numero || "")))
    .map((depto) => {
      const deptoId = String(depto.id);
      const meses: Record<number, "pagado" | "pendiente" | "vencido" | "sin_registro"> = {
        1: "sin_registro", 2: "sin_registro", 3: "sin_registro", 4: "sin_registro",
        5: "sin_registro", 6: "sin_registro", 7: "sin_registro", 8: "sin_registro",
        9: "sin_registro", 10: "sin_registro", 11: "sin_registro", 12: "sin_registro",
      };
      for (let month = 1; month <= 12; month++) {
        meses[month] = normalizeCellState(cuotaKey.get(`${deptoId}:${month}`));
      }
      return {
        departamentoId: deptoId,
        departamento: String(depto.numero || "-"),
        familia: vecinosPorDepto.get(deptoId) || "Sin asignar",
        deudaAnterior: deudaAnterior.has(deptoId),
        meses,
      };
    });

  // Estadísticas para el encabezado
  const totalDeptos = rows.length;
  const deptosPagadosCompletos = rows.filter((r) =>
    Object.values(r.meses).every((e) => e === "pagado" || e === "sin_registro") && !r.deudaAnterior
  ).length;
  const deptosConDeuda = rows.filter((r) =>
    r.deudaAnterior || Object.values(r.meses).some((e) => e === "pendiente" || e === "vencido")
  ).length;

  const fechaEmision = new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/La_Paz",
  }).format(new Date());

  const anioActual = new Date().getUTCFullYear();

  return (
    <main className="print-cuadro-page space-y-4 print:space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:bg-white">
        <div className="grid gap-0 md:grid-cols-[1fr_auto]">
          <div className="p-6 md:p-8 print:p-0 print:pb-4 print:border-b print:border-slate-300">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400 print:text-slate-500">
              Cuadro de Cuotas · {nombreBloque}
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white md:text-4xl print:text-slate-900 print:text-3xl">
              Gestión {anio}
            </h1>
            <p className="mt-1 text-base text-slate-300 print:text-slate-600">
              Estado de cumplimiento mensual por unidad — enero a diciembre
            </p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-400">
              Emitido el {fechaEmision} · Administrador: {usuario.perfil.nombre ?? "—"}
            </p>
          </div>

          {/* Selector de año + acciones — solo pantalla */}
          <div className="border-l border-white/10 bg-[#162b42] p-5 print:hidden min-w-[220px] flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-4">
                Seleccionar gestión
              </p>
              <form method="GET" className="space-y-3">
                <input
                  type="number"
                  name="anio"
                  min={2000}
                  max={2100}
                  defaultValue={anio}
                  className="w-full rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500"
                >
                  Ver gestión
                </button>
              </form>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <PrintButton label="Imprimir / PDF" />
              <Link
                href="/admin/reportes"
                className="block text-center text-xs text-slate-400 hover:text-slate-200 transition py-1"
              >
                ← Volver a reportes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Resumen de cumplimiento ──────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <div className="border-b border-white/10 px-5 py-4 flex gap-4 items-start print:border-slate-200 print:px-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/20 print:bg-slate-100 print:text-slate-600 print:ring-slate-300">
            I
          </span>
          <div>
            <h2 className="text-base font-bold text-white print:text-slate-900">Resumen de Cumplimiento</h2>
            <p className="text-xs text-slate-500 print:text-slate-400">Estado general de la gestión {anio}</p>
          </div>
        </div>
        <div className="p-5 print:p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b print:border-slate-200">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Total unidades</p>
              <p className="mt-1 text-2xl font-bold text-white print:text-slate-900">{totalDeptos}</p>
              <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">Departamentos en el registro</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b print:border-emerald-300">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Sin adeudos</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400 print:text-emerald-700">{deptosPagadosCompletos}</p>
              <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">Unidades al corriente de pago</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-white/5 px-4 py-3 print:bg-transparent print:rounded-none print:border-b print:border-red-300">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 print:text-slate-400">Con adeudo</p>
              <p className="mt-1 text-2xl font-bold text-red-400 print:text-red-700">{deptosConDeuda}</p>
              <p className="mt-0.5 text-xs text-slate-500 print:text-slate-400">Unidades con cuotas pendientes</p>
            </div>
          </div>

          {/* Barra de cumplimiento */}
          {totalDeptos > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-400 print:text-slate-500 mb-2">
                <span>Tasa de cumplimiento — Gestión {anio}</span>
                <span className="font-bold text-white print:text-slate-800">
                  {Math.round((deptosPagadosCompletos / totalDeptos) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 print:bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((deptosPagadosCompletos / totalDeptos) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Cuadro vitrina ──────────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-[#0d2137] ring-1 ring-white/10 overflow-hidden print:rounded-none print:ring-0 print:border print:border-slate-200">
        <div className="border-b border-white/10 px-5 py-4 flex gap-4 items-start print:border-slate-200 print:px-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/20 print:bg-slate-100 print:text-slate-600 print:ring-slate-300">
            II
          </span>
          <div>
            <h2 className="text-base font-bold text-white print:text-slate-900">Cuadro de Cuotas por Unidad</h2>
            <p className="text-xs text-slate-500 print:text-slate-400">
              Estado mensual detallado · {nombreBloque} · Gestión {anio}
            </p>
          </div>
        </div>

        <CuadroVitrina
          title={`${nombreBloque} · Gestión ${anio}`}
          subtitle="Estado de cuotas por mes y unidad. Deuda anterior indica adeudos de gestiones previas."
          year={anio}
          rows={rows}
        />
      </section>

      {/* ── Leyenda ─────────────────────────────────────────────────────────── */}
      <section className="rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 print:rounded-none print:border-slate-200 print:bg-transparent">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
          Leyenda e instrucciones de lectura
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-xs text-slate-400 print:text-slate-500">
          <div className="space-y-1.5">
            <p><span className="font-semibold text-emerald-400 print:text-emerald-700">Pagado:</span> La cuota del mes fue recibida y registrada en el sistema.</p>
            <p><span className="font-semibold text-amber-400 print:text-amber-700">Pendiente:</span> La cuota fue emitida y aún no ha sido pagada.</p>
            <p><span className="font-semibold text-red-400 print:text-red-700">Vencido:</span> La cuota no fue pagada dentro del plazo establecido.</p>
          </div>
          <div className="space-y-1.5">
            <p><span className="font-semibold text-slate-300 print:text-slate-700">Sin registro:</span> No se emitió cuota para ese mes en esa unidad.</p>
            <p><span className="font-semibold text-orange-400 print:text-orange-700">Deuda anterior:</span> La unidad registra adeudos de gestiones previas a {anio}.</p>
            <p>El cuadro está ordenado por número de departamento de mayor a menor.</p>
          </div>
        </div>
      </section>

    </main>
  );
}
