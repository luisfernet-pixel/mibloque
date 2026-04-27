import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

const coreBenefits = [
  "Cobros, pagos, gastos y avisos en un solo sistema.",
  "Acceso desde Mac, Windows, Android y tablet.",
  "Disponible desde cualquier lugar del mundo.",
  "Paneles por rol: superadmin, admin y vecino.",
];

const modules = [
  {
    title: "Cobranza ordenada",
    text: "Controla cuotas, mora y validacion de comprobantes con trazabilidad.",
  },
  {
    title: "Portal de vecinos",
    text: "Cada vecino revisa su estado, descarga recibos y reporta pagos.",
  },
  {
    title: "Gestion administrativa",
    text: "Centraliza gastos, reportes y comunicacion del bloque.",
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
            Gestiona tu bloque con menos caos y mas control.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            MiBloque centraliza la operacion diaria de administraciones y vecinos en una sola plataforma,
            con acceso desde cualquier dispositivo y desde cualquier lugar.
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
            {coreBenefits.map((item, index) => (
              <div
                key={item}
                className="landing-card rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                style={{ animationDelay: `${0.08 + index * 0.06}s` }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(7,20,38,0.92),_rgba(17,32,56,0.88))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">Ideal para</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Edificios, condominios y conjuntos residenciales</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Si hoy tu gestion depende de Excel y chat, MiBloque te ayuda a ordenar cobros, pagos y comunicacion sin perder seguimiento.
          </p>

          <div className="mt-6 grid gap-4">
            {modules.map((item, index) => (
              <article
                key={item.title}
                className="landing-card rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.2)]"
                style={{ animationDelay: `${0.18 + index * 0.08}s` }}
              >
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
