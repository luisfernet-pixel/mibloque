import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatBs(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type MorosoItem = {
  departamento: string;
  vecino: string;
  pendientes: number;
  deuda: number;
};

export default async function MorososPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const bloqueId = usuario.perfil.bloque_id;

  const [departamentosRes, usuariosRes, cuotasRes] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, numero")
      .eq("bloque_id", bloqueId)
      .order("numero"),

    supabase
      .from("usuarios")
      .select("nombre, departamento_id")
      .eq("bloque_id", bloqueId)
      .eq("rol", "vecino")
      .eq("activo", true),

    supabase
      .from("cuotas")
      .select("id, departamento_id, monto_total, estado")
      .eq("bloque_id", bloqueId),
  ]);

  const departamentos = departamentosRes.data ?? [];
  const usuarios = usuariosRes.data ?? [];
  const cuotas = cuotasRes.data ?? [];

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  const lista: MorosoItem[] = departamentos
    .map((depto: any) => {
      const vecino =
        usuarios.find((u: any) => u.departamento_id === depto.id)?.nombre ||
        "Sin asignar";

      const pendientes = cuotas.filter(
        (c: any) =>
          c.departamento_id === depto.id &&
          estadosDeuda.has(String(c.estado || "").toLowerCase())
      );

      const deuda = pendientes.reduce(
        (acc: number, item: any) => acc + Number(item.monto_total || 0),
        0
      );

      return {
        departamento: depto.numero,
        vecino,
        pendientes: pendientes.length,
        deuda,
      };
    })
    .filter((item) => item.pendientes > 0);

  const deudaTotal = lista.reduce((acc, item) => acc + item.deuda, 0);
  const totalPendientes = lista.reduce((acc, item) => acc + item.pendientes, 0);

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Reporte de cobranza
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Morosos
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Visualiza los departamentos que tienen cuotas pendientes o vencidas
              y el monto total adeudado.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <p className="text-sm font-semibold text-white">
              Resumen rápido
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Estado de deuda
            </p>

            <div className="mt-5 grid gap-3">
              <InfoBox label="Departamentos morosos" value={String(lista.length)} />
              <InfoBox label="Cuotas pendientes" value={String(totalPendientes)} />
              <InfoBox label="Deuda total" value={formatBs(deudaTotal)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card titulo="Morosos" valor={String(lista.length)} />
        <Card titulo="Pendientes" valor={String(totalPendientes)} />
        <AlertCard titulo="Deuda total" valor={formatBs(deudaTotal)} />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Lista actual
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Departamentos con deuda
          </h2>
        </div>

        <div className="p-4 md:p-5">
          {lista.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 bg-[#2b4768] px-5 py-10 text-center text-slate-300">
              No hay morosos. Excelente.
            </div>
          ) : (
            <div className="space-y-4">
              {lista.map((item, i) => (
                <div
                  key={i}
                  className="grid gap-4 rounded-[24px] border border-white/20 bg-[#2d4a6c] p-5 md:grid-cols-[160px_1fr_140px_180px] md:items-center"
                >
                  <div>
                    <p className="text-sm text-slate-300">Departamento</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {item.departamento}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Vecino</p>
                    <p className="mt-1 text-white font-semibold">
                      {item.vecino}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Pendientes</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {item.pendientes}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-300">Deuda</p>
                    <p className="mt-1 text-xl font-bold text-orange-200">
                      {formatBs(item.deuda)}
                    </p>
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

function Card({
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

function AlertCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-[24px] border border-orange-400/30 bg-orange-500/10 p-5 shadow-xl">
      <p className="text-sm text-orange-100">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
    </div>
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