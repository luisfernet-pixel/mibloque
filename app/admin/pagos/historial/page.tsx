import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBlockAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPeriodoLabel } from "@/lib/periodo";

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
  if (v === "qr") return "border border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
  if (v === "transferencia" || v === "deposito") return "border border-[#EF4937]/20 bg-[#EF4937]/10 text-[#ff9d92]";
  if (v === "efectivo") return "border border-amber-400/20 bg-amber-500/10 text-amber-300";
  return "border border-slate-400/20 bg-slate-500/10 text-slate-300";
}

function monthGroupKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthGroupLabel(key: string) {
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const label = new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function PagosHistorialPage() {
  const usuario = await requireBlockAdmin();
  if (!usuario) redirect("/login");

  const bloqueId = usuario.perfil.bloque_id;
  if (!bloqueId) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(`id, fecha_pago, monto_pagado, metodo_pago, referencia, cuotas:cuota_id (periodo), departamentos:departamento_id (numero)`)
    .eq("bloque_id", bloqueId)
    .order("fecha_pago", { ascending: false });

  const pagos = (data ?? []) as PagoRow[];
  const getPeriodo = (value: PagoRow["cuotas"]) => (Array.isArray(value) ? value[0]?.periodo ?? "-" : value?.periodo ?? "-");
  const getDepto = (value: PagoRow["departamentos"]) => (Array.isArray(value) ? value[0]?.numero ?? "-" : value?.numero ?? "-");

  const totalPagos = pagos.length;
  const totalCobrado = pagos.reduce((acc, item) => acc + Number(item.monto_pagado || 0), 0);
  const totalQr = pagos.filter((item) => item.metodo_pago?.toLowerCase() === "qr").length;
  const totalTransferencia = pagos.filter((item) => ["transferencia", "deposito"].includes(item.metodo_pago?.toLowerCase())).length;
  const totalEfectivo = pagos.filter((item) => item.metodo_pago?.toLowerCase() === "efectivo").length;

  const grouped = new Map<string, PagoRow[]>();
  for (const item of pagos) {
    const key = monthGroupKey(item.fecha_pago);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const gruposMes = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <main className="min-h-screen space-y-3.5 bg-[#324359] p-6 text-white">
      <section className="overflow-hidden rounded-3xl bg-[#071426] shadow-2xl">
        <div className="p-4 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Cobros del bloque</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white md:text-3xl">Pagos registrados</h1>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/admin/pagos/comprobantes" className="rounded-2xl bg-[#EF4937] px-4 py-2 text-center text-sm font-bold text-white transition hover:brightness-110">Ver comprobantes</Link>
                <Link href="/admin/pagos/registrar" className="rounded-2xl bg-cyan-500 px-4 py-2 text-center text-sm font-bold text-black transition hover:brightness-110">Registrar pago</Link>
                <Link href="/admin/pagos/historial" className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-center text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20">Historial de pagos</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-[#EF4937]/30 bg-[#EF4937]/10 p-4 text-sm text-[#ffb1a8]">Error cargando pagos: {error.message}</section> : null}

      <section className="overflow-hidden rounded-3xl bg-[#20354d] shadow-xl">
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-lg font-bold text-white">Registro detallado por mes</h2>
          <div className="text-sm text-slate-300">{totalPagos} pago(s) registrados</div>
        </div>
        <div className="p-3 space-y-2">
          {gruposMes.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Todavía no hay pagos registrados.</div>
          ) : (
            gruposMes.map(([mesKey, items], index) => (
              <details key={mesKey} open={index === 0} className="rounded-2xl border border-white/10 bg-[#1b3148]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                  <span className="text-sm font-bold text-white">{monthGroupLabel(mesKey)}</span>
                  <span className="text-xs text-slate-300">{items.length} pago(s)</span>
                </summary>
                <div className="overflow-x-auto border-t border-white/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#16283c] text-left text-slate-300">
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2 font-semibold">Fecha</th><th className="px-3 py-2 font-semibold">Depto</th><th className="px-3 py-2 font-semibold">Periodo</th><th className="px-3 py-2 font-semibold">Monto</th><th className="px-3 py-2 font-semibold">Método</th><th className="px-3 py-2 font-semibold">Recibo</th><th className="px-3 py-2 font-semibold">Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-white/10 text-slate-200 transition hover:bg-white/5">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{formatDate(item.fecha_pago)}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-white">{getDepto(item.departamentos)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{formatPeriodoLabel(getPeriodo(item.cuotas))}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-bold text-white">{money(item.monto_pagado)}</td>
                          <td className="whitespace-nowrap px-3 py-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${metodoClass(item.metodo_pago)}`}>{metodoLabel(item.metodo_pago)}</span></td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <Link href={`/admin/recibos/${item.id}/pdf`} target="_blank" className="inline-flex rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20">
                              Ver recibo
                            </Link>
                          </td>
                          <td className="max-w-[240px] px-3 py-2 text-slate-300"><span className="block truncate">{item.referencia || "-"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
