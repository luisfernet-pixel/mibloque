const ingresos = [
  { concepto: "Cuotas cobradas", monto: "Bs 18,540.00" },
  { concepto: "Saldo inicial", monto: "Bs 3,200.00" },
];

const gastos = [
  { categoria: "Limpieza", monto: "Bs 1,380.00" },
  { categoria: "Mantenimiento ascensor", monto: "Bs 2,150.00" },
  { categoria: "Seguridad", monto: "Bs 3,000.00" },
];

export default function DemoTransparenciaPage() {
  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Transparencia</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Resumen financiero del bloque</h1>
          <p className="mt-2 text-sm text-slate-300">
            Vista de ejemplo para mostrar ingresos, gastos y saldo disponible.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Ingresos" value="Bs 21,740.00" />
        <Card title="Gastos" value="Bs 6,530.00" />
        <Card title="Saldo" value="Bs 15,210.00" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] bg-[#20354d] p-5 shadow-xl ring-1 ring-white/10">
          <p className="text-lg font-bold text-white">Ingresos</p>
          <div className="mt-4 space-y-3">
            {ingresos.map((item) => (
              <div key={item.concepto} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <span className="text-sm text-slate-200">{item.concepto}</span>
                <span className="text-sm font-bold text-white">{item.monto}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] bg-[#20354d] p-5 shadow-xl ring-1 ring-white/10">
          <p className="text-lg font-bold text-white">Gastos</p>
          <div className="mt-4 space-y-3">
            {gastos.map((item) => (
              <div key={item.categoria} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <span className="text-sm text-slate-200">{item.categoria}</span>
                <span className="text-sm font-bold text-white">{item.monto}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{title}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
