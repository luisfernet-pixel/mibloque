import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-BO");
}

type AvisoRow = {
  id: string;
  titulo: string;
  mensaje: string;
  created_at: string;
};

type CuotaRow = {
  id: string;
  periodo: string;
  monto_total: number;
  estado: string;
  anio: number;
  mes: number;
};

export default async function VecinoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, bloque_id, departamento_id")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "vecino") {
    redirect("/login");
  }

  const [
    { data: departamento },
    { data: cuotas = [] },
    { data: avisos = [] },
  ] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("id", perfil.departamento_id)
      .single(),

    supabase
      .from("cuotas")
      .select("id, periodo, monto_total, estado, anio, mes")
      .eq("departamento_id", perfil.departamento_id)
      .order("anio", { ascending: false })
      .order("mes", { ascending: false }),

    supabase
      .from("avisos")
      .select("id, titulo, mensaje, created_at")
      .eq("bloque_id", perfil.bloque_id)
      .eq("publicado", true)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const cuotasRows = (cuotas ?? []) as CuotaRow[];
  const avisosRecientes = (avisos ?? []) as AvisoRow[];

  const cuotasNoPagadas = cuotasRows.filter((item) => item.estado !== "pagado");
  const totalPendiente = cuotasNoPagadas.reduce(
    (acc, item) => acc + Number(item.monto_total || 0),
    0
  );

  const cantidadCuotasDebe = cuotasNoPagadas.length;
  const cuotaActual = cuotasRows[0] ?? null;
  const valorCuotaActual = cuotaActual ? Number(cuotaActual.monto_total || 0) : 0;

  const numeroDepto = departamento?.numero || "-";
  const nombreVecino = perfil.nombre || "Vecino";

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Portal del vecino
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Hola, {nombreVecino}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Aquí puedes revisar tu estado, ver avisos importantes y enviar tu
              comprobante de pago a la administración.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/vecino/reportar-pago"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Enviar comprobante
              </Link>

              <Link
                href="/vecino/recibos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Ver recibos
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Estado general del departamento
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Resumen principal
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Departamento" value={String(numeroDepto)} />
              <InfoBox label="Saldo pendiente" value={money(totalPendiente)} />
              <InfoBox
                label="Cuota actual"
                value={cuotaActual?.periodo || "Sin datos"}
              />
              <InfoBox
                label="Monto cuota"
                value={cuotaActual ? money(valorCuotaActual) : "Sin datos"}
              />
            </div>

            <div className="mt-4 rounded-[24px] bg-[#1d3551] p-4 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Cuotas pendientes
              </p>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {cantidadCuotasDebe}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Avisos del bloque
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Avisos recientes
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Lo más importante publicado para vecinos.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {avisosRecientes.length} aviso(s)
          </div>
        </div>

        <div className="p-5 md:p-6">
          {avisosRecientes.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay avisos recientes
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Cuando la administración publique algo, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {avisosRecientes.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-[24px] border p-5 shadow-lg ${
                    index === 0
                      ? "border-orange-300/25 bg-[#36597f]"
                      : "border-white/10 bg-[#2b4768]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                        index === 0
                          ? "bg-orange-400/20 text-orange-100"
                          : "bg-cyan-500/15 text-cyan-200"
                      }`}
                    >
                      {index === 0 ? "Nuevo" : "Aviso"}
                    </span>

                    <span className="text-xs font-medium text-slate-300">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold text-white">
                    {item.titulo}
                  </h3>

                  <p className="mt-3 whitespace-pre-line text-base leading-7 text-slate-200">
                    {item.mensaje}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
              Historial de cuotas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Últimas cuotas registradas
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Resumen simple de tus cuotas más recientes.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            {cuotasRows.length} cuota(s)
          </div>
        </div>

        <div className="p-4 md:p-5">
          {cuotasRows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center">
              <p className="text-lg font-bold text-white">
                No hay cuotas registradas todavía
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cuotasRows.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-[24px] border border-white/20 bg-[#2d4a6c] p-4 md:grid-cols-[1.2fr_0.8fr_0.7fr] md:items-center md:p-5"
                >
                  <div>
                    <p className="text-sm text-slate-300">Periodo</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {item.periodo}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Monto</p>
                    <p className="mt-1 text-2xl font-extrabold text-white">
                      {money(item.monto_total)}
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
      <p className="mt-2 text-xl font-bold leading-tight text-white">
        {value}
      </p>
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
      {estado || "sin estado"}
    </span>
  );
}