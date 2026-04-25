import Link from "next/link";

const rows = [
  {
    fecha: "24/04/2026",
    depto: "500-121",
    periodo: "Febrero 2026",
    monto: "Bs 240.00",
    metodo: "Transferencia",
    ref: "QRE-240-998",
  },
  {
    fecha: "23/04/2026",
    depto: "500-122",
    periodo: "Febrero 2026",
    monto: "Bs 240.00",
    metodo: "QR",
    ref: "QR-77821",
  },
  {
    fecha: "22/04/2026",
    depto: "500-109",
    periodo: "Enero 2026",
    monto: "Bs 240.00",
    metodo: "Efectivo",
    ref: "Caja 14",
  },
];

export default function DemoAdminPagosPage() {
  return (
    <main className="space-y-6">
      <section className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/demo/admin"
          className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Inicio
        </Link>
        <Link
          href="/demo/admin/pagos"
          className="shrink-0 rounded-xl border border-orange-400/70 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-white"
        >
          Cobros
        </Link>
        <button
          type="button"
          disabled
          className="shrink-0 cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          Confirmaciones
        </button>
        <button
          type="button"
          disabled
          className="shrink-0 cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          Ajustes
        </button>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Cobros</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Historial de pagos</h1>
          <p className="mt-2 text-sm text-slate-300">
            Pantalla navegable de demostracion. Los botones internos estan desactivados.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl bg-cyan-500/70 px-4 py-2 text-sm font-semibold text-white"
            >
              Registrar pago
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300"
            >
              Exportar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#20354d] shadow-xl ring-1 ring-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#16283c] text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Depto</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Metodo</th>
                <th className="px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={`${item.fecha}-${item.depto}-${item.ref}`} className="border-t border-white/10 text-slate-200">
                  <td className="px-4 py-3">{item.fecha}</td>
                  <td className="px-4 py-3 font-semibold text-white">{item.depto}</td>
                  <td className="px-4 py-3">{item.periodo}</td>
                  <td className="px-4 py-3 font-bold text-white">{item.monto}</td>
                  <td className="px-4 py-3">{item.metodo}</td>
                  <td className="px-4 py-3">{item.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
