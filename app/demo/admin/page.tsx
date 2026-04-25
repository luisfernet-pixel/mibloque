import Link from "next/link";

const kpis = [
  { title: "Cobrado del mes", value: "Bs 18,540.00" },
  { title: "Pendiente actual", value: "Bs 6,220.00" },
  { title: "Comprobantes", value: "12 por revisar" },
  { title: "Deptos al dia", value: "31 / 44" },
];

export default function DemoAdminPage() {
  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Panel administrador
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Vista general del bloque
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              En esta demo puedes navegar por las pantallas mas usadas para mostrar el flujo real.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/demo/admin/pagos"
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-white"
              >
                Ver pagos
              </Link>
              <Link
                href="/demo/vecino"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white"
              >
                Ver portal vecino
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">Resumen rapido</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Datos de ejemplo
            </p>

            <div className="mt-5 space-y-3">
              <InfoBox label="Bloque" value="B121" />
              <InfoBox label="Estado" value="Operativo" />
              <InfoBox label="Ultima validacion" value="Hoy 09:53" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article key={item.title} className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
            <p className="text-sm text-slate-300">{item.title}</p>
            <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
          </article>
        ))}
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
