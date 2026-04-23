import { requireVecino } from "@/lib/auth";
import Link from "next/link";

export default async function ReportarPagoPage() {
  await requireVecino();

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Pagos
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Enviar comprobante
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Sube tu comprobante bancario o QR para que la administración lo
              revise y registre tu pago correctamente.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/vecino/recibos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Ver recibos
              </Link>

              <Link
                href="/vecino"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Volver al inicio
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Recomendaciones
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Antes de enviar
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <TipBox text="Verifica que el monto coincida con lo que pagaste." />
              <TipBox text="Puedes enviar comprobante de transferencia, depósito o QR." />
              <TipBox text="La administración revisará el archivo antes de aprobar el pago." />
              <TipBox text="Cuando el pago sea validado, aparecerá en Recibos." />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Formulario
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Datos del comprobante
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Completa los datos y adjunta tu archivo.
            </p>
          </div>

          <div className="w-fit rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
            Revisión manual
          </div>
        </div>

        <div className="p-5 md:p-6">
          <form
            action="/api/vecino/reportar-pago"
            method="POST"
            encType="multipart/form-data"
            className="grid gap-5 xl:grid-cols-[1fr_1fr]"
          >
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white">
                Referencia o detalle
              </label>
              <input
                type="text"
                name="referencia"
                placeholder="Ej: transferencia BNB, QR, depósito"
                required
                className="w-full rounded-2xl border border-white/15 bg-[#173454] px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white">
                Monto pagado
              </label>
              <input
                type="number"
                name="monto"
                step="0.01"
                placeholder="Ej: 100"
                required
                className="w-full rounded-2xl border border-white/15 bg-[#173454] px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400/40"
              />
            </div>

            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-semibold text-white">
                Archivo del comprobante
              </label>
              <input
                type="file"
                name="archivo"
                required
                className="w-full rounded-2xl border border-white/15 bg-[#173454] px-4 py-3 text-slate-200 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-cyan-400"
              />
              <p className="text-xs text-slate-400">
                Sube una imagen o archivo claro para facilitar la revisión.
              </p>
            </div>

            <div className="xl:col-span-2 flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Enviar comprobante
              </button>

              <Link
                href="/vecino/recibos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Ver pagos aprobados
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function TipBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-sm leading-6 text-slate-100">{text}</p>
    </div>
  );
}