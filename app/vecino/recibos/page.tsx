import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PagoRow = {
  id: string;
  monto_pagado: number | null;
  fecha_pago: string | null;
  referencia: string | null;
  comprobante_url: string | null;
  cuotas:
    | {
        periodo: string | null;
        monto_total: number | null;
      }
    | {
        periodo: string | null;
        monto_total: number | null;
      }[]
    | null;
};

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-BO");
}

function getPeriodo(
  value: PagoRow["cuotas"]
) {
  if (!value) return "-";
  return Array.isArray(value) ? value[0]?.periodo ?? "-" : value.periodo ?? "-";
}

export default async function VecinoRecibosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, rol, departamento_id")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino" || !perfil.departamento_id) {
    redirect("/login");
  }

  const { data: pagos } = await supabase
    .from("pagos")
    .select(`
      id,
      monto_pagado,
      fecha_pago,
      referencia,
      comprobante_url,
      cuotas (
        periodo,
        monto_total
      )
    `)
    .eq("departamento_id", perfil.departamento_id)
    .order("fecha_pago", { ascending: false });

  const rows = (pagos ?? []) as PagoRow[];

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Pagos
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Recibos
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Aquí puedes ver tus pagos aprobados y abrir el comprobante
              registrado por la administración.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/vecino/reportar-pago"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Enviar nuevo comprobante
              </Link>

              <Link
                href="/vecino"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Volver al inicio
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Resumen de pagos
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Historial disponible
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Pagos registrados" value={String(rows.length)} />
              <InfoBox
                label="Último pago"
                value={rows[0] ? formatDate(rows[0].fecha_pago) : "Sin pagos"}
              />
              <InfoBox
                label="Último periodo"
                value={rows[0] ? getPeriodo(rows[0].cuotas) : "Sin datos"}
              />
              <InfoBox
                label="Monto último pago"
                value={rows[0] ? money(rows[0].monto_pagado) : "Bs 0,00"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Historial
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Pagos aprobados
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Cada registro corresponde a un pago validado.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {rows.length} pago(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {rows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No tienes pagos aprobados todavía
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Cuando la administración valide un pago, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 shadow-lg"
                >
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Periodo
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {getPeriodo(item.cuotas)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Fecha de pago
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {formatDate(item.fecha_pago)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Monto pagado
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">
                        {money(item.monto_pagado)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Estado
                      </p>
                      <div className="mt-2">
                        <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-200">
                          Pagado
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        Referencia
                      </p>
                      <p className="mt-2 text-slate-200">
                        {item.referencia || "Sin referencia"}
                      </p>
                    </div>

                    {item.comprobante_url ? (
                      <Link
                        href={item.comprobante_url}
                        target="_blank"
                        className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-cyan-500 px-5 text-sm font-bold text-white transition hover:bg-cyan-400"
                      >
                        Ver comprobante
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">
                        Sin comprobante
                      </span>
                    )}
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
      <p className="mt-2 text-xl font-bold leading-tight text-white">
        {value}
      </p>
    </div>
  );
}