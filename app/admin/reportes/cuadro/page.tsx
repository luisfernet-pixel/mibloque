import Link from "next/link";
import { redirect } from "next/navigation";
import CuadroVitrina, { type CuadroRow } from "@/components/cuotas/cuadro-vitrina";
import PrintButton from "@/components/print-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{
  anio?: string;
}>;

type DepartamentoRow = {
  id: string;
  numero: string | null;
};

type VecinoRow = {
  departamento_id: string | null;
  nombre: string | null;
  activo: boolean | null;
};

type CuotaRow = {
  departamento_id: string;
  anio: number;
  mes: number;
  estado: string | null;
};

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
      supabase
        .from("usuarios")
        .select("departamento_id, nombre, activo")
        .eq("bloque_id", bloqueId)
        .eq("rol", "vecino"),
      supabase
        .from("cuotas")
        .select("departamento_id, anio, mes, estado")
        .eq("bloque_id", bloqueId)
        .lte("anio", anio),
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
        1: "sin_registro",
        2: "sin_registro",
        3: "sin_registro",
        4: "sin_registro",
        5: "sin_registro",
        6: "sin_registro",
        7: "sin_registro",
        8: "sin_registro",
        9: "sin_registro",
        10: "sin_registro",
        11: "sin_registro",
        12: "sin_registro",
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

  return (
    <main className="space-y-6 print:space-y-2">
      <section className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8 print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300 print:text-slate-600">
              Reporte mural
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl print:mt-1 print:text-2xl print:text-black">
              Resumen de cuotas por departamento
            </h1>
            <p className="mt-3 text-sm text-slate-200 print:text-slate-700">
              {nombreBloque} · Gestion {anio}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Link
              href="/admin/reportes"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Volver a reportes
            </Link>
            <PrintButton label="Descargar PDF" />
            <PrintButton label="Imprimir tabla" />
          </div>
        </div>
      </section>

      <CuadroVitrina
        title={`Mantenimiento ${nombreBloque}`}
        subtitle="Tabla resumen para vitrina, con estado por mes y deuda anterior."
        year={anio}
        rows={rows}
      />
    </main>
  );
}

function quotaState(value: string | undefined) {
  return String(value || "");
}
