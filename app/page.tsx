import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

const highlights = [
  { value: "Multi-dispositivo", label: "Mac, Windows, Android y tablet" },
  { value: "En la nube", label: "Acceso desde cualquier lugar del mundo" },
  { value: "Por roles", label: "Paneles para superadmin, admin y vecino" },
  { value: "Operacion clara", label: "Cobros, pagos, gastos y avisos en orden" },
];

const features = [
  {
    title: "Cobros y mora en un solo panel",
    text: "Genera cuotas, revisa pendientes y controla la morosidad sin depender de hojas sueltas o chats dispersos.",
  },
  {
    title: "Transparencia para vecinos",
    text: "Cada residente puede revisar su estado, recibos y avisos sin pedir capturas ni aclaraciones por WhatsApp.",
  },
  {
    title: "Comprobantes con seguimiento",
    text: "Los pagos suben al sistema y quedan listos para validar, aprobar o rechazar con trazabilidad.",
  },
  {
    title: "Gastos y reportes",
    text: "Centraliza egresos y reportes para que la administracion y la junta vean el estado real del bloque.",
  },
  {
    title: "Accesos por rol",
    text: "Separacion real entre superadmin, admin y vecino para operar con orden y seguridad.",
  },
  {
    title: "Listo para crecer",
    text: "El sistema se adapta a bloques, condominios o conjuntos con una base clara para seguir escalando.",
  },
];

const steps = [
  {
    step: "1",
    title: "La administracion organiza",
    text: "Cuotas, gastos y avisos se publican desde un solo panel para mantener orden operativo.",
  },
  {
    step: "2",
    title: "El vecino gestiona su pago",
    text: "El residente revisa su saldo, envia comprobantes y descarga recibos desde su portal.",
  },
  {
    step: "3",
    title: "Todo queda registrado",
    text: "La validacion y el seguimiento quedan trazados para reducir errores, reclamos y tiempos muertos.",
  },
];

const sellPoints = [
  "Usalo desde cualquier dispositivo: Mac, Windows, Android o tablet.",
  "Gestiona tu bloque desde cualquier lugar del mundo.",
  "Centraliza la operacion diaria en una sola plataforma.",
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
  const nombre = usuario?.perfil.nombre ?? "Administracion de bloques";

  if (usuario) {
    redirect(panelHref);
  }

  return (
    <main className="theme-shell-dark min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.26),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_28%),linear-gradient(180deg,_#07111f_0%,_#0b1d33_55%,_#122844_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_transparent)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-lg font-black text-cyan-200 shadow-[0_12px_30px_rgba(14,165,233,0.18)]">
            MB
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
              MiBloque
            </p>
            <p className="text-sm text-slate-400">
              Software para bloques y condominios
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex">
          <a href="#beneficios" className="transition hover:text-white">
            Beneficios
          </a>
          <a href="#funcionamiento" className="transition hover:text-white">
            Funcionamiento
          </a>
          <a href="#venta" className="transition hover:text-white">
            Venta
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={panelHref}
            className="btn-primary rounded-2xl px-4 py-2 text-sm font-semibold"
          >
            {panelLabel}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-14 lg:pt-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            Plataforma comercial lista para vender
          </div>

          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            El software para administrar bloques sin caos operativo.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
            MiBloque centraliza cobros, comprobantes, gastos, avisos y
            transparencia en un solo lugar. Se puede usar desde cualquier
            dispositivo, Mac o Windows o Android, y desde cualquier lugar del
            mundo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={panelHref}
              className="btn-primary rounded-2xl px-6 py-3 text-sm font-bold sm:px-7 sm:py-4"
            >
              {panelLabel}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {highlights.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.2)] backdrop-blur"
              >
                <p className="text-2xl font-black text-white">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-sm text-slate-300">
            {sellPoints.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute right-0 top-24 h-36 w-36 rounded-full bg-orange-400/15 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(7,20,38,0.95),_rgba(17,32,56,0.9))] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
                  Vista del sistema
                </p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  {nombre}
                </h2>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                En produccion
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PreviewCard title="Cobros y mora" value="Seguimiento claro" tone="cyan" />
              <PreviewCard title="Pagos y comprobantes" value="Revision ordenada" tone="orange" />
              <PreviewCard title="Acceso por roles" value="Admin / Vecino / Superadmin" tone="violet" />
              <PreviewCard title="Avisos y comunicacion" value="Centralizado" tone="slate" />
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Flujo principal
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                    administracion / vecino / validacion
                  </p>
                </div>
                <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-xs font-bold text-orange-100">
                  Trazable
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  "Cuotas emitidas",
                  "Comprobantes recibidos",
                  "Validacion registrada",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#132742] px-4 py-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-100">
                      {index + 1}
                    </span>
                    <p className="text-sm text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="beneficios"
        className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/70">
              Beneficios
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Beneficios para tu administracion y tus vecinos
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-400">
            No se trata solo de mostrar funciones: se trata de operar con orden,
            dar transparencia y ahorrar tiempo en la gestion diaria.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.18)] backdrop-blur"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-lg font-black text-cyan-100">
                MB
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="funcionamiento"
        className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"
      >
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.03))] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-200/80">
              Funcionamiento
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              Como funciona en el dia a dia
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Un flujo simple para operar mejor: la administracion publica, el
              vecino responde y todo queda registrado para control y seguimiento.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border border-white/10 bg-[#10233e] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-400/15 text-sm font-black text-orange-100">
                  {item.step}
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="venta"
        className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16"
      >
        <div className="rounded-[2.25rem] border border-cyan-300/10 bg-[linear-gradient(135deg,_rgba(14,165,233,0.16),_rgba(249,115,22,0.1))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-100/80">
                Venta
              </p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Listo para ofrecerlo como software de gestion para bloques
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
                MiBloque esta pensado para resolver problemas reales de cobro,
                comunicacion y control administrativo, con una experiencia clara
                para quienes administran y para quienes viven en el bloque.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={panelHref}
                  className="btn-primary rounded-2xl px-6 py-3 text-sm font-bold"
                >
                  {panelLabel}
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Ir al login
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Accesible", "Disponible desde Mac, Windows, Android y tablet."],
                ["Remoto", "Funciona desde cualquier lugar del mundo."],
                ["Orden", "Centraliza cobros, pagos, gastos y avisos."],
                ["Transparente", "Vecinos y administracion comparten informacion clara."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-3xl border border-white/10 bg-[#081728]/75 p-5"
                >
                  <p className="text-lg font-bold text-white">{title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PreviewCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "cyan" | "orange" | "violet" | "slate";
}) {
  const styles = {
    cyan: "border-cyan-300/15 bg-cyan-300/10 text-cyan-100",
    orange: "border-orange-300/15 bg-orange-300/10 text-orange-100",
    violet: "border-violet-300/15 bg-violet-300/10 text-violet-100",
    slate: "border-white/10 bg-white/5 text-slate-100",
  };

  return (
    <div className={`rounded-3xl border p-4 ${styles[tone]}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
        {title}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
