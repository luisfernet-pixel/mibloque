import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CuotaRow = {
  id: string;
  periodo: string;
  monto_total: number;
  estado: string;
  departamentos: { numero: string } | { numero: string }[] | null;
};

function bs(n: number) {
  return `Bs ${Number(n || 0).toLocaleString("es-BO")}`;
}

function getDepto(value: CuotaRow["departamentos"]) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.numero ?? "-" : value.numero;
}

export default async function CuotasPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cuotas")
    .select(
      `
      id,
      periodo,
      monto_total,
      estado,
      departamentos:departamento_id (
        numero
      )
    `
    )
    .order("periodo", { ascending: false });

  const cuotas = (data ?? []) as CuotaRow[];

  const pendientes = cuotas.filter((x) => x.estado === "pendiente");
  const vencidas = cuotas.filter((x) => x.estado === "vencido");
  const pagadas = cuotas.filter((x) => x.estado === "pagado");

  const totalPendiente = pendientes.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );
  const totalVencido = vencidas.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );
  const totalPagado = pagadas.reduce(
    (a, x) => a + Number(x.monto_total || 0),
    0
  );

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Cobros
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Cuotas y cobros
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Revisa deudas, pagos realizados y el estado general de cobro del
              bloque.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/confirmaciones"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Revisar comprobantes
              </Link>

              <Link
                href="/admin/pagos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Historial de pagos
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Resumen de cobranza
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Estado actual
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Pendientes" value={String(pendientes.length)} />
              <InfoBox label="Vencidas" value={String(vencidas.length)} />
              <InfoBox label="Pagadas" value={String(pagadas.length)} />
              <InfoBox label="Total cuotas" value={String(cuotas.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Mini titulo="Por cobrar" valor={bs(totalPendiente)} />
        <Mini titulo="Vencido" valor={bs(totalVencido)} />
        <Mini titulo="Ya cobrado" valor={bs(totalPagado)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Deudas del bloque
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Estado de cuotas por departamento
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Listado general de cuotas registradas.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {cuotas.length} cuota(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {cuotas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay cuotas registradas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cuotas.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-[24px] border border-white/20 bg-[#2d4a6c] p-4 md:grid-cols-[0.8fr_1fr_0.8fr_0.7fr] md:items-center md:p-5"
                >
                  <div>
                    <p className="text-sm text-slate-300">Departamento</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {getDepto(item.departamentos)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Periodo</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {item.periodo}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Monto</p>
                    <p className="mt-1 text-2xl font-extrabold text-white">
                      {bs(item.monto_total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Estado</p>
                    <div className="mt-2">
                      <EstadoCuota estado={item.estado} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#3a5879] p-4 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
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
    <div className="rounded-[24px] bg-[#213b59] p-5 shadow-xl ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
    </div>
  );
}

function EstadoCuota({ estado }: { estado: string }) {
  const normalizado = (estado || "").toLowerCase();

  const estilo =
    normalizado === "pagado"
      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
      : normalizado === "vencido"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-orange-400/30 bg-orange-500/10 text-orange-200";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold capitalize ${estilo}`}
    >
      {normalizado === "pagado"
        ? "Pagada"
        : normalizado === "vencido"
        ? "Vencida"
        : "Pendiente"}
    </span>
  );
}