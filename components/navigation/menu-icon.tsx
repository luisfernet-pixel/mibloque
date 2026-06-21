export default function MenuIcon({ label, className = "h-3.5 w-3.5" }: { label: string; className?: string }) {
  const key = label.toLowerCase();
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (key.includes("inicio")) {
    return (
      <svg {...common}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (key.includes("pago")) {
    return (
      <svg {...common}>
        <path d="M3 7h18v12H3z" />
        <path d="M7 11h.01M17 15h.01" />
        <circle cx="12" cy="13" r="2.5" />
      </svg>
    );
  }

  if (key.includes("gasto")) {
    return (
      <svg {...common}>
        <path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    );
  }

  if (key.includes("aviso")) {
    return (
      <svg {...common}>
        <path d="M4 11v2a2 2 0 0 0 2 2h2l4 4V5L8 9H6a2 2 0 0 0-2 2z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M18.5 6.5a8 8 0 0 1 0 11" />
      </svg>
    );
  }

  if (key.includes("reporte") || key.includes("transparencia") || key.includes("cuentas")) {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </svg>
    );
  }

  if (key.includes("ajuste")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.1L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.1l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.1L10 21h4l.5-2.7a7 7 0 0 0 2-1.1l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" />
      </svg>
    );
  }

  if (key.includes("bloque")) {
    return (
      <svg {...common}>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M8 20v-8h8v8" />
        <path d="M10 8h4" />
      </svg>
    );
  }

  if (key.includes("admin")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20a7 7 0 0 1 14 0" />
        <path d="M17.5 6.5 19 8l2-3" />
      </svg>
    );
  }

  if (key.includes("departamento")) {
    return (
      <svg {...common}>
        <path d="M5 21V4h14v17" />
        <path d="M9 8h.01M14 8h.01M9 12h.01M14 12h.01M9 16h.01M14 16h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
