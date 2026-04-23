import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PagoRow = {
  id: string;
  fecha_pago: string;
  monto_pagado: number;
  metodo_pago: string;
  referencia: string | null;
  cuotas: { periodo: string } | { periodo: string }[] | null;
  departamentos: { numero: string } | { numero: string }[] | null;
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-BO");
}

function metodoLabel(value: string) {
  const v = (value || "").toLowerCase();

  if (v === "transferencia") return "Transferencia";
  if (v === "qr") return "QR";
  if (v === "efectivo") return "Efectivo";
  if (v === "deposito") return "Depósito";

  return value || "-";
}

function metodoClass(value: string) {
  const v = (value || "").toLowerCase();

  if (v === "qr") {
    return "border border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
  }

  if (v === "transferencia" || v === "deposito") {
    return "border border-[#EF4937]/20 bg-[#EF4937]/10 text-[#ff9d92]";
  }

  if (v === "efectivo") {
    return "border border-amber-400/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-slate-400/20 bg-slate-500/10 text-slate-300";
}

export default async function PagosPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos")
    .select(
      `
      id,
      fecha_pago,
      monto_pagado,
      metodo_pago,
      referencia,
      cuotas:cuota_id (
        periodo
      ),
      departamentos:departamento_id (
        numero
      )
    `
    )
    .order("fecha_pago", { ascending: false });

  const pagos = (data ?? []) as PagoRow[];

  function getPeriodo(value: PagoRow["cuotas"]) {
    if (!value) return "-";
    return Array.isArray(value) ? value[0]?.periodo ?? "-" : value.periodo;
  }

  function getDepto(value: PagoRow["departamentos"]) {
    if (!value) return "-";
    return Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero;
  }

  const totalPagos = pagos.length;
  const totalCobrado = pagos.reduce(
    (acc, item) => acc + Number(item.monto_pagado || 0),
    0
  );

  const totalQr = pagos.filter(
    (item) => item.metodo_pago?.toLowerCase() === "qr"
  ).length;

  const totalTransferencia = pagos.filter((item) => {
    const metodo = item.metodo_pago?.toLowerCase();
    return metodo === "transferencia" || metodo === "deposito";
  }).length;

  const totalEfectivo = pagos.filter(
    (item) => item.metodo_pago?.toLowerCase() === "efectivo"
  ).length;

  return (
    <main className="min-h-screen space-y-5 bg-[#324359] p-6 text-white">
      <section className="overflow-hidden rounded-3xl bg-[#071426] shadow-2xl">
        <div className="grid gap-5 p-5 md:grid-cols-[1.35fr_0.65fr] md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Cobros del bloque
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
              Historial de pagos
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Aquí puedes revisar todos los pagos registrados del bloque de forma
              clara y ordenada.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                href="/admin/pagos/nuevo"
                className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
              >
                Registrar pago manual
              </Link>

              <Link
                href="/admin/validar-pagos"
                className="rounded-2xl bg-[#EF4937] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
              >
                Revisar comprobantes
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Resumen rápido
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatMini label="Pagos registrados" value={String(totalPagos)} />
              <StatMini label="Total cobrado" value={money(totalCobrado)} />
              <StatMini label="Pagos por QR" value={String(totalQr)} />
              <StatMini
                label="Transferencias"
                value={String(totalTransferencia)}
              />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-[#EF4937]/30 bg-[#EF4937]/10 p-4 text-sm text-[#ffb1a8]">
          Error cargando pagos: {error.message}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pagos registrados" value={String(totalPagos)} tone="orange" />
        <KpiCard title="Total cobrado" value={money(totalCobrado)} tone="cyan" />
        <KpiCard title="Pagos por QR" value={String(totalQr)} tone="sky" />
        <KpiCard title="Pagos en efectivo" value={String(totalEfectivo)} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-3xl bg-[#20354d] shadow-xl">
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Registro detallado
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">
              Pagos guardados
            </h2>
          </div>

          <div className="text-sm text-slate-300">
            {totalPagos} pago(s) registrados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#16283c] text-left text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Depto</th>
                <th className="px-4 py-3 font-semibold">Periodo</th>
                <th className="px-4 py-3 font-semibold">Monto</th>
                <th className="px-4 py-3 font-semibold">Método</th>
                <th className="px-4 py-3 font-semibold">Referencia</th>
              </tr>
            </thead>

            <tbody>
              {pagos.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-white/10 text-slate-200 transition hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {formatDate(item.fecha_pago)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-white">
                    {getDepto(item.departamentos)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {getPeriodo(item.cuotas)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-bold text-white">
                    {money(item.monto_pagado)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${metodoClass(
                        item.metodo_pago
                      )}`}
                    >
                      {metodoLabel(item.metodo_pago)}
                    </span>
                  </td>

                  <td className="max-w-[240px] px-4 py-3 text-slate-300">
                    <span className="block truncate">
                      {item.referencia || "-"}
                    </span>
                  </td>
                </tr>
              ))}

              {pagos.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Todavía no hay pagos registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
  tone: "orange" | "cyan" | "sky" | "amber";
}) {
  const tones = {
    orange: "border-[#EF4937]/25 bg-[#EF4937]/10 text-[#ff9d92]",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}