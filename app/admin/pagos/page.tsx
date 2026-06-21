import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const supabase = createAdminClient();
  const { data: pendientesRes } = await supabase
    .from("confirmaciones_pago")
    .select("id")
    .eq("bloque_id", usuario.perfil.bloque_id)
    .eq("estado", "pendiente");

  const comprobantesPendientes = pendientesRes?.length ?? 0;

  return (
    <main className="space-y-6 md:space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
          Pagos
        </h1>
        <p className="text-lg text-slate-300 md:text-xl">
          Elige lo que necesitas hacer con cobros, deudas y comprobantes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:gap-5">
        <HubCard
          href="/admin/pagos/registrar"
          title="Registrar pago"
          description="Anota un pago cuando un vecino paga en efectivo, QR o transferencia."
          icon={<CashIcon />}
        />
        <HubCard
          href="/admin/pagos/deudas"
          title="Ver quien debe"
          description="Revisa cuotas pendientes, mora y estado general de cobro."
          icon={<BookIcon />}
        />
        <HubCard
          href="/admin/pagos/comprobantes"
          title="Revisar comprobantes"
          description="Aprueba o rechaza comprobantes enviados por los vecinos."
          icon={<ClipIcon />}
          highlight={comprobantesPendientes > 0}
          badgeCount={comprobantesPendientes}
        />
        <HubCard
          href="/admin/pagos/historial"
          title="Historial de pagos"
          description="Consulta pagos ya registrados y busca movimientos anteriores."
          icon={<ClockIcon />}
        />
      </section>
    </main>
  );
}

function HubCard({
  href,
  title,
  description,
  icon,
  highlight,
  badgeCount,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: boolean;
  badgeCount?: number;
}) {
  const badge = Number(badgeCount || 0);
  return (
    <Link
      href={href}
      className={`rounded-[28px] border p-5 shadow-xl transition md:p-7 ${
        highlight
          ? "border-orange-400/55 bg-orange-500/10 hover:bg-orange-500/15 hover:border-orange-400/75"
          : "border-white/15 bg-[#213b59] hover:bg-[#29425f]"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
            highlight
              ? "bg-orange-500/15 text-orange-200"
              : "bg-white/10 text-blue-300"
          }`}
        >
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white md:text-3xl">{title}</p>
            {highlight && badge > 0 ? (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base leading-7 text-slate-200 md:text-lg">
            {description}
          </p>
        </div>
      </div>
    </Link>
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

function ClipIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.44 11.05-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l9.2-9.19a3.5 3.5 0 1 1 4.95 4.95l-9.19 9.2a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
    </svg>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
