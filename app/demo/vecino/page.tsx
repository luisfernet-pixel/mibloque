import Link from "next/link";

const cuotas = [
  { periodo: "Febrero 2026", monto: "Bs 240.00", estado: "Pendiente" },
  { periodo: "Enero 2026", monto: "Bs 240.00", estado: "En revision" },
  { periodo: "Diciembre 2025", monto: "Bs 240.00", estado: "Pagado" },
];

export default function DemoVecinoPage() {
  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Portal vecino
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Estado de cuotas
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-200">
              Pantalla de ejemplo para mostrar como el vecino revisa sus meses y descarga recibos.
            </p>
            <div className="mt-6">
              <Link
                href="/demo/vecino/transparencia"
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-white"
              >
                Ver transparencia
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <InfoBox label="Pendientes" value="1" />
            <div className="mt-3">
              <InfoBox label="En revision" value="1" />
            </div>
            <div className="mt-3">
              <InfoBox label="Pagados" value="1" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#20354d] shadow-xl ring-1 ring-white/10">
        <div className="p-4 md:p-5">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2">Periodo</th>
                <th className="px-3 py-2">Monto</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map((item) => (
                <tr key={item.periodo} className="border-b border-white/10 text-slate-100">
                  <td className="px-3 py-3">{item.periodo}</td>
                  <td className="px-3 py-3">{item.monto}</td>
                  <td className="px-3 py-3">{item.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
