import Link from "next/link";

export default function DemoIndexPage() {
  return (
    <main className="space-y-3">
      <section className="overflow-hidden rounded-[24px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="p-4 md:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
            Acceso demo
          </p>
          <h1 className="mt-3 text-xl font-bold text-white md:text-4xl">
            Elige un entorno
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
            Esta demo es solo navegacion con datos ficticios. No guarda cambios ni ejecuta acciones reales.
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link
          href="/demo/admin"
          className="rounded-[26px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 transition hover:brightness-110"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
            Entorno 1
          </p>
          <h2 className="mt-3 text-xl font-bold text-white">Administradores</h2>
          <p className="mt-3 text-sm text-slate-200">
            Recorre inicio, cobros y las pantallas clave del panel administrativo.
          </p>
        </Link>

        <Link
          href="/demo/vecino"
          className="rounded-[26px] bg-gradient-to-br from-[#0f2035] via-[#163557] to-[#1b466a] p-6 shadow-2xl ring-1 ring-white/10 transition hover:brightness-110"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
            Entorno 2
          </p>
          <h2 className="mt-3 text-xl font-bold text-white">Vecino</h2>
          <p className="mt-3 text-sm text-slate-200">
            Explora cuotas, estados y cuentas del bloque en modo de demostracion.
          </p>
        </Link>
      </section>
    </main>
  );
}

