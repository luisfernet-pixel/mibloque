import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type SearchParams = Promise<{
  mes?: string;
}>;

function getInicioYFinDelMes(mes: string) {
  const [year, month] = mes.split("-").map(Number);

  const inicio = new Date(year, month - 1, 1);
  const fin = new Date(year, month, 1);

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const params = await searchParams;
  const supabase = await createClient();
  const bloqueId = usuario.perfil.bloque_id;

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(
    hoy.getMonth() + 1
  ).padStart(2, "0")}`;

  const mes = params?.mes || mesActual;

  const { inicio, fin } = getInicioYFinDelMes(mes);

  const [pagosRes, gastosRes, departamentosRes, cuotasRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("monto_pagado, fecha_pago, departamento_id")
      .eq("bloque_id", bloqueId)
      .gte("fecha_pago", inicio)
      .lt("fecha_pago", fin),

    supabase
      .from("gastos")
      .select("monto, created_at")
      .eq("bloque_id", bloqueId)
      .gte("created_at", inicio)
      .lt("created_at", fin),

    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("bloque_id", bloqueId),

    supabase
      .from("cuotas")
      .select("departamento_id, estado")
      .eq("bloque_id", bloqueId),
  ]);

  const pagosMes = pagosRes.data ?? [];
  const gastosMes = gastosRes.data ?? [];
  const departamentos = departamentosRes.data ?? [];
  const cuotas = cuotasRes.data ?? [];

  const ingresos = pagosMes.reduce(
    (acc, item) => acc + Number(item.monto_pagado || 0),
    0
  );

  const gastos = gastosMes.reduce(
    (acc, item) => acc + Number(item.monto || 0),
    0
  );

  const balance = ingresos - gastos;

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  let departamentosAlDia = 0;
  let morosos = 0;

  for (const depto of departamentos) {
    const tieneDeuda = cuotas.some(
      (c: any) =>
        c.departamento_id === depto.id &&
        estadosDeuda.has(String(c.estado || "").toLowerCase())
    );

    if (tieneDeuda) morosos++;
    else departamentosAlDia++;
  }

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Inteligencia financiera
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Reportes
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Resumen real del bloque para el mes seleccionado. Visualiza
              ingresos, gastos, balance y morosidad.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">
              Filtro mensual
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Selecciona periodo
            </p>

            <form method="GET" className="mt-5 space-y-3">
              <input
                type="month"
                name="mes"
                defaultValue={mes}
                className="w-full rounded-2xl border border-white/10 bg-[#173454] px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#ff5a3d] px-5 py-3 font-bold text-white transition hover:brightness-110"
              >
                Ver mes
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card titulo="Ingresos" valor={formatBs(ingresos)} />
        <Card titulo="Gastos" valor={formatBs(gastos)} />
        <Card titulo="Balance" valor={formatBs(balance)} />
        <AlertCard titulo="Morosos" valor={String(morosos)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Mini titulo="Pagos del mes" valor={String(pagosMes.length)} />
        <Mini titulo="Deptos al día" valor={String(departamentosAlDia)} />
        <Mini titulo="Gastos registrados" valor={String(gastosMes.length)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Accesos rápidos
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Reportes disponibles
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Selecciona el reporte que quieres abrir.
          </p>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
          <ReportButton
            href="/admin/reportes/departamento"
            titulo="Por departamento"
            texto="Historial, deuda y pagos."
          />

          <ReportButton
            href="/admin/reportes/morosos"
            titulo="Morosos"
            texto="Departamentos con deuda."
          />

          <ReportButton
            href="/admin/gastos"
            titulo="Gastos"
            texto="Ir a gestión de gastos."
          />
        </div>
      </section>
    </main>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
    </div>
  );
}

function AlertCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-[24px] border border-orange-400/30 bg-orange-500/10 p-5 shadow-xl">
      <p className="text-sm text-orange-100">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
    </div>
  );
}

function Mini({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-[#2d4a6c] p-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-white">{valor}</p>
    </div>
  );
}

function ReportButton({
  href,
  titulo,
  texto,
}: {
  href: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-white/15 bg-[#2d4a6c] p-5 shadow-lg transition hover:bg-[#35557b] hover:ring-1 hover:ring-cyan-400/20"
    >
      <div className="flex h-full min-h-[150px] flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{titulo}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{texto}</p>
        </div>

        <div className="mt-5 inline-flex w-fit items-center rounded-2xl bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-200 transition group-hover:bg-cyan-500/25">
          Abrir reporte
        </div>
      </div>
    </Link>
  );
}