import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCurrentBoliviaYearMonth } from "@/lib/bolivia-time";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCuotaMontoVigente } from "@/lib/cuotas";
import { ensureCurrentMonthCuotasForBlock } from "@/lib/cuotas-sync";

type SearchParams = Promise<{ anio?: string }>;
type PagoRow = { monto_pagado: number | null; fecha_pago: string | null };
type GastoRow = { monto: number | null; fecha_gasto: string | null };
type CuotaRow = {
  monto_base?: number | null;
  mora_acumulada?: number | null;
  monto_total: number | null;
  estado: string | null;
  anio: number | null;
  mes: number | null;
  periodo?: string | null;
  fecha_vencimiento?: string | null;
  created_at?: string | null;
};
type ConfigRow = {
  saldo_inicial: number | null;
  dia_vencimiento?: number | null;
  valor_mora?: number | null;
};

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseYear(value: string | undefined, fallbackYear: number) {
  const year = Number(value || fallbackYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return fallbackYear;
  return year;
}

function sumByMonth<T>(rows: T[], month: number, getterAmount: (row: T) => number, getterIso: (row: T) => string | null | undefined) {
  const total = rows
    .filter((row) => {
      const iso = String(getterIso(row) || "");
      if (!iso) return false;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.getUTCMonth() + 1 === month;
    })
    .reduce((acc, row) => acc + getterAmount(row), 0);
  return total;
}

export default async function AuditoriaPage({ searchParams }: { searchParams: SearchParams }) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const { year: currentYear, month: currentMonth } = getCurrentBoliviaYearMonth(now);
  const selectedYear = parseYear(params?.anio, currentYear);

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;
  if (!bloqueId) redirect("/login");
  await ensureCurrentMonthCuotasForBlock(adminSupabase, bloqueId);

  const [pagosRes, gastosRes, cuotasRes, configRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("monto_pagado, fecha_pago")
      .eq("bloque_id", bloqueId)
      .gte("fecha_pago", `${selectedYear}-01-01T00:00:00Z`)
      .lt("fecha_pago", `${selectedYear + 1}-01-01T00:00:00Z`),
    supabase
      .from("gastos")
      .select("monto, fecha_gasto")
      .eq("bloque_id", bloqueId)
      .gte("fecha_gasto", `${selectedYear}-01-01`)
      .lt("fecha_gasto", `${selectedYear + 1}-01-01`),
    supabase
      .from("cuotas")
      .select("monto_base, mora_acumulada, monto_total, estado, anio, mes, periodo, fecha_vencimiento, created_at")
      .eq("bloque_id", bloqueId)
      .eq("anio", selectedYear),
    supabase.from("configuracion_bloque").select("saldo_inicial, dia_vencimiento, valor_mora").eq("bloque_id", bloqueId).maybeSingle(),
  ]);

  const pagos = (pagosRes.data ?? []) as PagoRow[];
  const gastos = (gastosRes.data ?? []) as GastoRow[];
  const config = (configRes.data ?? null) as ConfigRow | null;
  const cuotas = ((cuotasRes.data ?? []) as CuotaRow[]).map((row) => ({
    ...row,
    monto_total: getCuotaMontoVigente(row, config),
  }));

  const rows = Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    const cobrado = sumByMonth(pagos, month, (row) => Number(row.monto_pagado || 0), (row) => row.fecha_pago);
    const gastado = sumByMonth(gastos, month, (row) => Number(row.monto || 0), (row) => row.fecha_gasto);
    const porCobrar = cuotas
      .filter((row) => Number(row.mes || 0) === month && ["pendiente", "vencido"].includes(String(row.estado || "").toLowerCase()))
      .reduce((acc, row) => acc + Number(row.monto_total || 0), 0);
    return {
      month,
      cobrado,
      gastado,
      porCobrar,
      saldoMes: cobrado - gastado,
    };
  });

  const totalCobrado = rows.reduce((acc, row) => acc + row.cobrado, 0);
  const totalGastado = rows.reduce((acc, row) => acc + row.gastado, 0);
  const totalPorCobrar = rows.reduce((acc, row) => acc + row.porCobrar, 0);
  const saldoInicial = Number(config?.saldo_inicial || 0);
  const saldoAcumulado = saldoInicial + totalCobrado - totalGastado;

  const current = rows[currentMonth - 1];
  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const yearOptions = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => 2024 + i);

  return (
    <main className="space-y-4">
      <section className="rounded-[24px] bg-[#213b59] p-5 ring-1 ring-white/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Auditoria</p>
            <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Control simple de movimientos</h1>
            <p className="mt-1 text-sm text-slate-300">Cobros, gastos, por cobrar y saldo real por mes.</p>
          </div>
          <form method="GET" className="flex items-center gap-2">
            <select
              name="anio"
              defaultValue={String(selectedYear)}
              className="rounded-xl border border-white/10 bg-[#0d2137] px-3 py-2 text-sm text-white outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">Ver</button>
            <Link href="/admin/reportes" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">
              Volver
            </Link>
          </form>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Card label={`Cobrado ${monthLabels[currentMonth - 1]}`} value={formatBs(current.cobrado)} />
        <Card label={`Gastado ${monthLabels[currentMonth - 1]}`} value={formatBs(current.gastado)} />
        <Card label={`Por cobrar ${monthLabels[currentMonth - 1]}`} value={formatBs(current.porCobrar)} />
        <Card label={`Saldo ${monthLabels[currentMonth - 1]}`} value={formatBs(current.saldoMes)} />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Card label={`Cobrado ${selectedYear}`} value={formatBs(totalCobrado)} />
        <Card label={`Gastado ${selectedYear}`} value={formatBs(totalGastado)} />
        <Card label={`Por cobrar ${selectedYear}`} value={formatBs(totalPorCobrar)} />
        <Card label="Saldo acumulado" value={formatBs(saldoAcumulado)} />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#213b59] ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-bold text-white">Detalle mensual {selectedYear}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#16283c] text-left text-slate-300">
              <tr>
                <th className="px-4 py-2">Mes</th>
                <th className="px-4 py-2">Cobrado</th>
                <th className="px-4 py-2">Gastado</th>
                <th className="px-4 py-2">Por cobrar</th>
                <th className="px-4 py-2">Saldo mes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-t border-white/10 text-slate-100">
                  <td className="px-4 py-2 font-semibold">{monthLabels[row.month - 1]}</td>
                  <td className="px-4 py-2">{formatBs(row.cobrado)}</td>
                  <td className="px-4 py-2">{formatBs(row.gastado)}</td>
                  <td className="px-4 py-2">{formatBs(row.porCobrar)}</td>
                  <td className="px-4 py-2 font-bold">{formatBs(row.saldoMes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#2d4a6c] px-4 py-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
