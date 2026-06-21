import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import CuboLogo from "@/components/branding/cubo-logo";

const coreBenefits = [
  "Cobros, pagos, gastos y avisos en un solo sistema.",
  "Disponible desde cualquier lugar del mundo.",
  "Acceso desde Mac, Windows, Android y tablet.",
  "El admin controla todo. El vecino ve solo lo suyo.",
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
    <main className="theme-shell-dark relative min-h-screen overflow-hidden bg-[#08182b]">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_42%),linear-gradient(180deg,_#071427_0%,_#0a1d34_48%,_#0d2541_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-center bg-no-repeat opacity-[0.14]"
        style={{
          backgroundImage: "url('/landing-building-watermark.jpg')",
          backgroundSize: "cover",
        }}
      />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center">
          <CuboLogo priority className="h-auto w-[320px] max-w-full sm:w-[420px]" />
        </Link>

        <Link href={panelHref} className="rounded-full bg-cyan-500 px-7 py-3 text-base font-bold text-white shadow-[0_8px_30px_rgba(14,165,233,0.35)] transition hover:brightness-110">
          {panelLabel}
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-6 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10 lg:pt-10">
        <div className="rounded-[28px] bg-[#0b1d36]/65 p-5 ring-1 ring-white/5 sm:p-8">
          <p className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-300/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            Plataforma en la nube
          </p>

          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.1] text-white sm:text-6xl">
            Gestiona tu bloque con menos caos y{" "}
            <span className="text-[#ff5a3d]">mas control</span>.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-200">
            KUBO centraliza la operacion diaria de administraciones y vecinos en una sola plataforma,
            con acceso desde cualquier dispositivo y desde cualquier lugar.
          </p>

          <div className="mt-10">
            <Link href={panelHref} className="inline-flex rounded-full bg-cyan-500 px-8 py-4 text-2xl font-extrabold text-white shadow-[0_8px_28px_rgba(14,165,233,0.4)] transition hover:brightness-110">
              {panelLabel}
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/30 bg-[linear-gradient(180deg,_rgba(3,19,38,0.95),_rgba(10,33,59,0.92))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">Ideal para</p>
          <h2 className="mt-4 text-5xl font-bold leading-tight text-white">Edificios, condominios y conjuntos residenciales</h2>
          <p className="mt-6 text-3xl leading-[1.35] text-slate-200">
            Si hoy tu gestion depende de Excel y chat, KUBO te ayuda a ordenar cobros, pagos y comunicacion sin perder seguimiento.
          </p>

          <div className="mt-6 grid gap-3">
            {coreBenefits.map((item) => (
              <article
                key={item}
                className="rounded-[2rem] border border-slate-400/60 bg-slate-500/15 px-5 py-3"
              >
                <p className="text-2xl font-semibold leading-tight text-slate-100">{item}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[2rem] border border-white/20 bg-white/5 px-5 py-5">
            <p className="text-sm font-semibold text-slate-300">Listo para ordenar tu bloque.</p>
            <Link
              href={panelHref}
              className="mt-4 inline-flex rounded-full bg-cyan-500 px-7 py-3 text-base font-bold text-white shadow-[0_8px_30px_rgba(14,165,233,0.35)] transition hover:brightness-110"
            >
              Entrar al sistema
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

