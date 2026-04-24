import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bs(n: number) {
  return `Bs ${Number(n || 0).toLocaleString("es-BO")}`;
}

function esDelMesActual(fecha?: string | null) {
  if (!fecha) return false;

  const f = new Date(fecha);
  const hoy = new Date();

  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth()
  );
}

type AdminCuotaRow = {
  id: string;
  monto_total: number | null;
  estado: string | null;
  created_at: string | null;
  departamento_id: string | null;
};

type AdminGastoRow = {
  monto: number | null;
  created_at: string | null;
};

type AdminPagoRow = {
  id: string;
  monto_pagado: number | null;
  fecha_pago: string | null;
  departamento_id: string | null;
};

type AdminDepartamentoRow = {
  id: string;
  numero: string | number | null;
};

type AdminConfirmacionRow = {
  id: string;
  estado: string | null;
  created_at: string | null;
  departamento_id: string | null;
  departamentos:
    | {
        id: string;
        bloque_id: string | null;
        numero: string | number | null;
      }
    | {
        id: string;
        bloque_id: string | null;
        numero: string | number | null;
      }[]
    | null;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol, bloque_id")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");
  if (perfil.rol === "superadmin") redirect("/superadmin");
  if (perfil.rol !== "admin") redirect("/login");

  const bloqueId = perfil.bloque_id;
  if (!bloqueId) redirect("/login");

  const [cuotasRes, gastosRes, confirmacionesRes, pagosRes, departamentosRes] =
    await Promise.all([
      adminSupabase
        .from("cuotas")
        .select("id, monto_total, estado, created_at, departamento_id")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("gastos")
        .select("monto, created_at")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("confirmaciones_pago")
        .select(`
          id,
          estado,
          created_at,
          departamento_id,
          departamentos:departamento_id (
            id,
            bloque_id,
            numero
          )
        `)
        .eq("bloque_id", bloqueId)
        .eq("estado", "pendiente")
        .order("created_at", { ascending: false }),

      adminSupabase
        .from("pagos")
        .select("id, monto_pagado, fecha_pago, departamento_id")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("departamentos")
        .select("id, numero")
        .eq("bloque_id", bloqueId),
    ]);

  const cuotas = (cuotasRes.data ?? []) as AdminCuotaRow[];
  const gastos = (gastosRes.data ?? []) as AdminGastoRow[];
  const pagos = (pagosRes.data ?? []) as AdminPagoRow[];
  const departamentos = (departamentosRes.data ?? []) as AdminDepartamentoRow[];
  const confirmaciones = (confirmacionesRes.data ?? []) as AdminConfirmacionRow[];

  const cobradoDelMes = pagos
    .filter((x) => esDelMesActual(x.fecha_pago))
    .reduce((a: number, x) => a + Number(x.monto_pagado || 0), 0);

  const pendienteActual = cuotas
    .filter((x) => {
      const estado = String(x.estado || "").toLowerCase();
      return estado === "pendiente" || estado === "vencido";
    })
    .reduce((a: number, x) => a + Number(x.monto_total || 0), 0);

  const gastosDelMes = gastos
    .filter((x) => esDelMesActual(x.created_at))
    .reduce((a: number, x) => a + Number(x.monto || 0), 0);

  const saldoActual = cobradoDelMes - gastosDelMes;
  const comprobantesPorRevisar = confirmaciones.length;

  const deptosMoraMes = new Set(
    cuotas
      .filter((x) => {
        const estado = String(x.estado || "").toLowerCase();
        return (
          (estado === "pendiente" || estado === "vencido") &&
          esDelMesActual(x.created_at)
        );
      })
      .map((x) => x.departamento_id)
      .filter(Boolean)
  ).size;

  const deptosMoraAntigua = new Set(
    cuotas
      .filter((x) => {
        const estado = String(x.estado || "").toLowerCase();
        return (
          (estado === "pendiente" || estado === "vencido") &&
          !esDelMesActual(x.created_at)
        );
      })
      .map((x) => x.departamento_id)
      .filter(Boolean)
  ).size;

  const deptosAlDia = departamentos.filter((depto) => {
    const tieneDeuda = cuotas.some((c) => {
      const estado = String(c.estado || "").toLowerCase();
      return (
        c.departamento_id === depto.id &&
        (estado === "pendiente" || estado === "vencido")
      );
    });

    return !tieneDeuda;
  }).length;

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#031a38] via-[#032247] to-[#0a2f4b] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Administración
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              Inicio
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              Resumen operativo del bloque. Controla cobros, gastos y pagos
              pendientes desde un solo lugar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/confirmaciones"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#ff5a3d] px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
              >
                Revisar comprobantes
              </Link>

              <Link
                href="/admin/cuotas"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Gestionar cobros
              </Link>

              <Link
                href="/admin/gastos"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Ver gastos
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-[#2f4b6c] p-5 md:p-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Estado inmediato
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                Indicadores clave
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="Saldo del mes" value={bs(saldoActual)} />
              <InfoBox
                label="Pendientes revisar"
                value={String(comprobantesPorRevisar)}
              />
              <InfoBox label="Deptos al día" value={String(deptosAlDia)} />
              <InfoBox
                label="Mora antigua"
                value={String(deptosMoraAntigua)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card titulo="Cobrado del mes" valor={bs(cobradoDelMes)} />
        <Card titulo="Pendiente actual" valor={bs(pendienteActual)} />
        <Card titulo="Gastos del mes" valor={bs(gastosDelMes)} />
        <AlertCard
          titulo="Comprobantes pendientes"
          valor={String(comprobantesPorRevisar)}
          href="/admin/confirmaciones"
        />
      </section>

      <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10">
        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Estado general
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Situación del bloque
          </h2>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 md:p-6">
          <Mini titulo="Saldo mensual" valor={bs(saldoActual)} />
          <Mini
            titulo="Mora de este mes"
            valor={String(deptosMoraMes)}
          />
          <Mini
            titulo="Mora antigua"
            valor={String(deptosMoraAntigua)}
          />
          <Mini
            titulo="Departamentos al día"
            valor={String(deptosAlDia)}
          />
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
  href,
}: {
  titulo: string;
  valor: string;
  href: string;
}) {
  const alerta = Number(valor || 0) > 0;

  return (
    <Link
      href={href}
      className={`rounded-[24px] p-5 shadow-xl ring-1 transition ${
        alerta
          ? "bg-[#ff5a3d] ring-orange-300/20 hover:brightness-110"
          : "bg-[#213b59] ring-white/10 hover:bg-[#29425f]"
      }`}
    >
      <p className="text-sm text-white/90">{titulo}</p>
      <p className="mt-3 text-3xl font-bold text-white">{valor}</p>
      <p className="mt-2 text-sm text-white/90">
        {alerta ? "Revisar ahora" : "Sin pendientes"}
      </p>
    </Link>
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
    <div className="rounded-2xl bg-[#2d4a6c] p-4 ring-1 ring-white/10">
      <p className="text-sm text-slate-300">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-white">{valor}</p>
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
