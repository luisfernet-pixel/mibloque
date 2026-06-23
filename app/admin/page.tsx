import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserSafe } from "@/lib/auth";
import { ensureCurrentMonthCuotasForBlock } from "@/lib/cuotas-sync";
import {
  compareYearMonth,
  getBoliviaDateParts,
  getCurrentBoliviaYearMonth,
  isDateInBoliviaMonth,
} from "@/lib/bolivia-time";

function bs(n: number) {
  return `Bs ${Number(n || 0).toLocaleString("es-BO")}`;
}

function getPrimerNombre(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Admin";
  return raw.split(/\s+/)[0] || raw;
}

type AdminCuotaRow = {
  monto_total: number | null;
  estado: string | null;
  anio: number | null;
  mes: number | null;
  created_at: string | null;
  departamento_id: string | null;
};

type AdminGastoRow = {
  monto: number | null;
  fecha_gasto: string | null;
};

type AdminPagoRow = {
  monto_pagado: number | null;
  fecha_pago: string | null;
};

type AdminDepartamentoRow = {
  id: string;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const user = await getAuthUserSafe(supabase);

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol, bloque_id, nombre")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");
  if (perfil.rol === "superadmin") redirect("/superadmin");
  if (perfil.rol !== "admin") redirect("/login");

  const bloqueId = perfil.bloque_id;
  if (!bloqueId) redirect("/login");
  await ensureCurrentMonthCuotasForBlock(adminSupabase, bloqueId);

  const [cuotasRes, gastosRes, confirmacionesRes, pagosRes, departamentosRes] =
    await Promise.all([
      adminSupabase
        .from("cuotas")
        .select("monto_total, estado, anio, mes, created_at, departamento_id")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("gastos")
        .select("monto, fecha_gasto")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("confirmaciones_pago")
        .select("id")
        .eq("bloque_id", bloqueId)
        .eq("estado", "pendiente"),

      adminSupabase
        .from("pagos")
        .select("monto_pagado, fecha_pago")
        .eq("bloque_id", bloqueId),

      adminSupabase
        .from("departamentos")
        .select("id")
        .eq("bloque_id", bloqueId),
    ]);

  const cuotas = (cuotasRes.data ?? []) as AdminCuotaRow[];
  const gastos = (gastosRes.data ?? []) as AdminGastoRow[];
  const pagos = (pagosRes.data ?? []) as AdminPagoRow[];
  const departamentos = (departamentosRes.data ?? []) as AdminDepartamentoRow[];
  const periodoActual = getCurrentBoliviaYearMonth();
  const cuotaPeriodoRelacion = (cuota: AdminCuotaRow) => {
    const relation = compareYearMonth(cuota.anio, cuota.mes, periodoActual.year, periodoActual.month);
    if (relation !== null) return relation;

    const parts = getBoliviaDateParts(cuota.created_at);
    if (!parts) return null;
    return compareYearMonth(parts.year, parts.month, periodoActual.year, periodoActual.month);
  };

  const cobradoDelMes = pagos
    .filter((x) => isDateInBoliviaMonth(x.fecha_pago, periodoActual.year, periodoActual.month))
    .reduce((a, x) => a + Number(x.monto_pagado || 0), 0);

  const gastosDelMes = gastos
    .filter((x) => isDateInBoliviaMonth(x.fecha_gasto, periodoActual.year, periodoActual.month))
    .reduce((a, x) => a + Number(x.monto || 0), 0);

  const saldoDelMes = cobradoDelMes - gastosDelMes;

  const estadosDeuda = new Set(["pendiente", "vencido"]);

  const deptosConDeudaMes = new Set(
    cuotas
      .filter((x) => {
        const estado = String(x.estado || "").toLowerCase();
        return (
          estadosDeuda.has(estado) &&
          cuotaPeriodoRelacion(x) === 0
        );
      })
      .map((x) => x.departamento_id)
      .filter(Boolean)
  ).size;

  const deptosConDeudaAnterior = new Set(
    cuotas
      .filter((x) => {
        const estado = String(x.estado || "").toLowerCase();
        return (
          estadosDeuda.has(estado) &&
          cuotaPeriodoRelacion(x) === -1
        );
      })
      .map((x) => x.departamento_id)
      .filter(Boolean)
  ).size;

  const deptosAlDia = departamentos.filter((depto) => {
    const tieneDeuda = cuotas.some((cuota) => {
      const estado = String(cuota.estado || "").toLowerCase();
      return cuota.departamento_id === depto.id && estadosDeuda.has(estado);
    });

    return !tieneDeuda;
  }).length;

  const comprobantesPendientes = confirmacionesRes.data?.length ?? 0;
  const primerNombre = getPrimerNombre(perfil.nombre);

  return (
    <main className="space-y-4 md:space-y-5">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
          Hola, {primerNombre}
        </h1>
        <p className="text-lg text-slate-300 md:text-xl">
          Que quieres hacer ahora?
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:gap-3.5">
        <ActionCard
          href="/admin/pagos/registrar"
          title="Registrar pago"
          description="Cuando un vecino paga en efectivo, QR o transferencia."
          tone="cyan"
          icon={<CashIcon />}
        />
        <ActionCard
          href="/admin/pagos/deudas"
          title="Ver quien debe"
          description="Revisa vecinos con cuotas pendientes o mora."
          tone="orange"
          icon={<BookIcon />}
        />
        <ActionCard
          href="/admin/gastos/registrar"
          title="Registrar gasto"
          description="Anota pagos de limpieza, jardinero, luz, agua o reparaciones."
          tone="blue"
          icon={<ReceiptIcon />}
        />
        <ActionCard
          href="/admin/comunicacion"
          title="Enviar aviso"
          description="Publica un comunicado para todos los vecinos."
          tone="sky"
          icon={<MegaphoneIcon />}
        />
      </section>

      <section className="rounded-[22px] bg-[#213b59] p-3.5 shadow-xl ring-1 ring-white/10 md:p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xl font-bold text-white md:text-2xl">
              Resumen del mes
            </p>
            <p className="text-sm text-slate-300 md:text-base">
              Lo mas importante del dinero este mes.
            </p>
          </div>

          <Link
            href="/admin/reportes"
            className="mt-0.5 whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition duration-200 hover:border-sky-400/30 hover:bg-white/20 hover:text-white active:scale-[0.98] md:rounded-2xl md:px-4 md:py-2 md:text-sm"
          >
            Ver reportes
          </Link>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          <SummaryTile
            label="Cobre"
            value={bs(cobradoDelMes)}
            valueClassName="text-cyan-300"
          />
          <SummaryTile
            label="Gaste"
            value={bs(gastosDelMes)}
            valueClassName="text-[#ff8a6b]"
          />
          <SummaryTile
            label="Saldo"
            value={bs(saldoDelMes)}
            valueClassName="text-white"
            note={saldoDelMes < 0 ? "Incluye cuotas pendientes por cobrar." : undefined}
          />
        </div>
      </section>

      <section className="rounded-[22px] bg-[#213b59] p-3.5 shadow-xl ring-1 ring-white/10 md:p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xl font-bold text-white md:text-2xl">Vecinos</p>
            <p className="text-sm text-slate-300 md:text-base">
              Una vista rapida para saber como esta el bloque.
            </p>
          </div>

          <Link
            href="/admin/pagos/deudas"
            className="mt-0.5 whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition duration-200 hover:border-sky-400/30 hover:bg-white/20 hover:text-white active:scale-[0.98] md:rounded-2xl md:px-4 md:py-2 md:text-sm"
          >
            Ver detalles
          </Link>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Al dia" value={String(deptosAlDia)} />
          <StatCard label="Deben este mes" value={String(deptosConDeudaMes)} />
          <StatCard
            label="Deben meses anteriores"
            value={String(deptosConDeudaAnterior)}
          />
          <StatCard
            label="Comprobantes por revisar"
            value={String(comprobantesPendientes)}
          />
        </div>
      </section>
    </main>
  );
}

function ActionCard({
  href,
  title,
  description,
  tone,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  tone: "cyan" | "orange" | "blue" | "sky";
  icon: React.ReactNode;
}) {
  const tones = {
    cyan: "border-cyan-300/20 hover:border-cyan-300/35",
    orange: "border-orange-300/20 hover:border-orange-300/35",
    blue: "border-blue-300/20 hover:border-blue-300/35",
    sky: "border-sky-300/20 hover:border-sky-300/35",
  };

  return (
    <Link
      href={href}
      className={`rounded-[24px] border bg-[#213b59] p-4 shadow-xl transition hover:bg-[#29425f] md:p-5 ${tones[tone]}`}
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold text-white md:text-2xl">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-200 md:mt-1.5 md:text-base">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SummaryTile({
  label,
  value,
  valueClassName,
  note,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  note?: string;
}) {
  return (
    <div className="rounded-[18px] bg-[#2d4a6c] px-3.5 py-3">
      <p className="text-sm text-slate-300 md:text-base">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold md:mt-2 md:text-3xl ${valueClassName || "text-white"}`}>
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-slate-300">{note}</p> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] bg-[#2d4a6c] px-3.5 py-3">
      <p className="text-sm text-slate-300 md:text-base">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white md:mt-2 md:text-3xl">
        {value}
      </p>
    </div>
  );
}

function CashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 text-cyan-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.7" />
      <path d="M7 9h.01M17 15h.01" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[#ff8a6b]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" />
      <path d="M7.5 2A2.5 2.5 0 0 0 5 4.5V19" />
      <path d="M9 7h6M9 11h6" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 text-blue-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 text-sky-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2Z" />
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7" />
      <path d="M18.5 6a8 8 0 0 1 0 12" />
    </svg>
  );
}


