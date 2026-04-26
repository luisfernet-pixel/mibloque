import Link from "next/link";

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

type GastoItem = {
  fecha: string;
  categoria: string;
  monto: number;
};

function categoriaClass(value: string) {
  const v = (value || "").toLowerCase();

  if (v.includes("luz") || v.includes("electric")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  if (v.includes("agua")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  if (v.includes("limpieza")) {
    return "border border-white/20 bg-white/10 text-white";
  }

  return "border border-white/20 bg-white/10 text-white";
}

export default function TransparenciaPage() {
  const gastos: GastoItem[] = [
    { fecha: "05/04/2026", categoria: "Luz", monto: 60 },
    { fecha: "07/04/2026", categoria: "Agua", monto: 45 },
    { fecha: "10/04/2026", categoria: "Limpieza", monto: 50 },
    { fecha: "14/04/2026", categoria: "Jardinería", monto: 25 },
  ];

  const cobradoMes = 400;
  const porCobrarMes = 650;
  const gastosDelMes = 180;
  const saldoDisponible = 220;

  return (
    <main className="min-h-screen bg-[#334b68] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="mb-6 rounded-[32px] bg-gradient-to-r from-[#071426] via-[#031a38] to-[#0c2d4a] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                Transparencia
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
                Cuentas del bloque
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
                Aquí puedes ver de forma clara cuánto dinero entró, cuánto se
                gastó y cuánto queda disponible en el bloque.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/25 bg-white/10 p-5 backdrop-blur-sm md:p-6">
              <p className="text-sm font-semibold text-slate-200">
                Estado general del mes
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                Resumen principal
              </p>

              <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Saldo disponible
                </p>
                <p className="mt-2 text-4xl font-extrabold text-white md:text-5xl">
                  {money(saldoDisponible)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                  Transparencia simple
                </span>
                <Link
                  href="/vecino/transparencia/cuadro"
                  className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-500/25"
                >
                  Ver cuadro general
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ResumenCard
            titulo="Cobrado este mes"
            valor={money(cobradoMes)}
          />
          <ResumenCard
            titulo="Por cobrar"
            valor={money(porCobrarMes)}
          />
          <ResumenCard
            titulo="Gastos del mes"
            valor={money(gastosDelMes)}
          />
          <ResumenCard
            titulo="Saldo disponible"
            valor={money(saldoDisponible)}
            destacado
          />
        </section>

        <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
                Movimiento reciente
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Gastos recientes del bloque
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Para que el vecino vea en qué se está usando el dinero.
              </p>
            </div>

            <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
              {gastos.length} gasto(s)
            </div>
          </div>

          <div className="p-4 md:p-5">
            {gastos.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center">
                <p className="text-lg font-bold text-white">
                  No hay gastos recientes para mostrar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {gastos.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-4 rounded-[24px] border border-white/20 bg-[#2d4a6c] p-4 md:grid-cols-[0.8fr_1fr_0.8fr] md:items-center md:p-5"
                  >
                    <div>
                      <p className="text-sm text-slate-300">Fecha</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {item.fecha}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-300">Categoría</p>
                      <div className="mt-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-2 text-sm font-bold ${categoriaClass(
                            item.categoria
                          )}`}
                        >
                          {item.categoria}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-slate-300">Monto</p>
                      <p className="mt-1 text-2xl font-extrabold text-white">
                        {money(item.monto)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ResumenCard({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-[28px] p-5 shadow-lg ring-1 ${
        destacado
          ? "bg-[#426a95] ring-orange-300/30"
          : "bg-[#3b6189] ring-white/20"
      }`}
    >
      <p className="text-sm font-semibold text-slate-100">{titulo}</p>
      <p className="mt-3 text-4xl font-extrabold leading-tight text-white">
        {valor}
      </p>
    </div>
  );
}
