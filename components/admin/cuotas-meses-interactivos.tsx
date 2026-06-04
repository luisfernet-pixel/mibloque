"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatPeriodoLabel } from "@/lib/periodo";

type EstadoCuota = "pendiente" | "vencido" | "pagado";

export type MesPagoItem = {
  id: string;
  periodo: string;
  monto: number;
  estado: EstadoCuota;
  esHabilitado: boolean;
  mensajeBloqueo: string | null;
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

function estadoClass(value: EstadoCuota) {
  if (value === "pagado") {
    return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
  }

  if (value === "vencido") {
    return "border-red-400/30 bg-red-500/10 text-red-200";
  }

  return "border-orange-400/30 bg-orange-500/10 text-orange-200";
}

function estadoLabel(value: EstadoCuota) {
  if (value === "pagado") return "Pagada";
  if (value === "vencido") return "Vencida";
  return "Pendiente";
}

export default function CuotasMesesInteractivos({
  departamento,
  items,
}: {
  departamento: string;
  items: MesPagoItem[];
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const rutaPago = useMemo(
    () => (periodo: string) =>
      `/admin/pagos/nuevo?departamento=${encodeURIComponent(departamento)}&periodo=${encodeURIComponent(periodo)}`,
    [departamento]
  );

  return (
    <div className="space-y-3">
      {mensaje ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
          {mensaje}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          if (item.estado === "pagado") {
            return (
              <div
                key={item.id}
                className="grid gap-3 rounded-2xl border border-white/10 bg-[#264465] px-3 py-2 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Periodo</p>
                  <p className="mt-1 text-base font-bold text-white">{formatPeriodoLabel(item.periodo)}</p>
                </div>

                <p className="text-lg font-bold text-white">{money(item.monto)}</p>

                <EstadoCuotaBadge estado={item.estado} />
              </div>
            );
          }

          const handleClick = () => {
            if (item.esHabilitado) {
              setMensaje(null);
              router.push(rutaPago(item.periodo));
              return;
            }

            setMensaje(item.mensajeBloqueo || "No puedes pagar este mes todavia.");
          };

          return (
            <button
              key={item.id}
              type="button"
              onClick={handleClick}
              className={`grid w-full gap-3 rounded-2xl border px-3 py-2 text-left transition md:grid-cols-[1fr_auto_auto] md:items-center ${
                item.esHabilitado
                  ? "border-cyan-400/20 bg-[#2b5279] hover:bg-[#356189]"
                  : "border-white/10 bg-[#264465] hover:bg-[#2c4d70]"
              }`}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Periodo</p>
                <p className="mt-1 text-base font-bold text-white">{formatPeriodoLabel(item.periodo)}</p>
              </div>

              <p className="text-lg font-bold text-white">{money(item.monto)}</p>

              <EstadoCuotaBadge estado={item.estado} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EstadoCuotaBadge({ estado }: { estado: EstadoCuota }) {
  return (
    <span
      className={`inline-flex justify-center rounded-full border px-3 py-2 text-sm font-bold capitalize ${estadoClass(
        estado
      )}`}
    >
      {estadoLabel(estado)}
    </span>
  );
}
