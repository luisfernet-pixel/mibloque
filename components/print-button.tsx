"use client";

export default function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20 print:hidden"
    >
      {label}
    </button>
  );
}

