import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

const coreBenefits = [
  "Boletas y cuotas mensuales con seguimiento de morosidad.",
  "Comunicados, reclamos y trazabilidad de respuestas.",
  "Control de gastos, comprobantes y reportes por bloque.",
  "Portales por rol para admin, vecinos y superadmin.",
];

const modules = [
  {
    title: "Finanzas y cobranza",
    text: "Centraliza boletas, pagos, comprobantes y estados de cuenta de cada departamento.",
  },
  {
    title: "Comunicacion y comunidad",
    text: "Publica avisos, recibe sugerencias y reclamos, y mantén historial claro de cada gestion.",
  },
  {
    title: "Transparencia y control",
    text: "Consulta reportes, morosidad, recibos y resumen de cuotas por departamento para una gestion clara y confiable.",
  },
];

function getPanelHref(rol?: string | null) {
  if (rol === "superadmin") return "/superadmin";
  if (rol === "admin") return "/admin";
  if (rol === "vecino") return "/vecino";
  return "/login";
}

function getPanelLabel(rol?: string | null) {
  if (rol === "superadmin") return "Ir al panel maestro";
  if (rol === "admin") return "Ir a mi panel";
  if (rol === "vecino") return "Entrar al portal";
  return "Entrar al sistema";
}

export default async function HomePage() {
  const usuario = await getUsuarioActual();
  const rol = usuario?.perfil.rol ?? null;
  const panelHref = getPanelHref(rol);
  const panelLabel = getPanelLabel(rol);

  if (usuario) {
    redirect(panelHref);
  }

  return (
    <main className="theme-shell-dark relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.26),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),_transparent_28%),linear-gradient(180deg,_#07111f_0%,_#0b1d33_55%,_#122844_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-center bg-no-repeat opacity-[0.14]"
        style={{
          backgroundImage: "url('/landing-building-watermark.png')",
          backgroundSize: "cover",
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-lg font-black text-cyan-200 shadow-[0_12px_30px_rgba(14,165,233,0.18)]">
            MB
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">MiBloque</p>
            <p className="text-sm text-slate-400">Software para bloques y condominios</p>
          </div>
        </Link>

        <Link href={panelHref} className="btn-primary rounded-2xl px-4 py-2 text-sm font-semibold">
          {panelLabel}
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:pt-12">
        <div>
          <p className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            Plataforma en la nube
          </p>

          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
            Administra tu edificio o condominio sin caos operativo.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            MiBloque reemplaza Excel, grupos de chat y cuadernos con una plataforma unica para
            cobranza, comunicacion, reportes y seguimiento por departamento.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={panelHref} className="btn-primary rounded-2xl px-6 py-3 text-sm font-bold">
              {panelLabel}
            </Link>
            <Link
              href="/demo"
              className="rounded-2xl border border-orange-300/40 bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Ver Demo
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {coreBenefits.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(7,20,38,0.92),_rgba(17,32,56,0.88))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">Ideal para</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Gestion integral para edificios y condominios</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Ideal para administradores que gestionan uno o varios bloques y necesitan orden,
            control y visibilidad en tiempo real.
          </p>

          <div className="mt-6 grid gap-4">
            {modules.map((item) => (
              <article key={item.title} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.2)]">
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
