"use client";

import { useMemo, useState } from "react";
import { formatPeriodoLabel } from "@/lib/periodo";

type CuotaDetalle = {
  id: string;
  periodo: string;
  montoBase: number;
  multa: number;
  total: number;
  vencida: boolean;
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO")}`;
}

export default function PagoDepartamentoSelector({
  cuotas,
  initialCantidadMeses = 1,
}: {
  cuotas: CuotaDetalle[];
  initialCantidadMeses?: number;
}) {
  const [cantidadMeses, setCantidadMeses] = useState(Math.max(1, Math.min(initialCantidadMeses, cuotas.length || 1)));

  const cuotasSeleccionadas = useMemo(
    () => cuotas.slice(0, cantidadMeses),
    [cantidadMeses, cuotas]
  );

  const total = useMemo(
    () => cuotasSeleccionadas.reduce((acc, item) => acc + item.total, 0),
    [cuotasSeleccionadas]
  );

  const tieneMulta = cuotasSeleccionadas.some((item) => item.multa > 0);

  return (
    <div className="rounded-2xl bg-[#1b3148] p-2.5">
      <input type="hidden" name="cantidad_meses" value={cantidadMeses} />

      <div>
        <label
          htmlFor={`cantidad-meses-${cuotas[0]?.id || "depto"}`}
          className="mb-2 block text-xs font-medium text-slate-300"
        >
          ¿Cuántos meses va a pagar hoy?
        </label>

        <select
          id={`cantidad-meses-${cuotas[0]?.id || "depto"}`}
          value={cantidadMeses}
          onChange={(event) => setCantidadMeses(Number(event.target.value))}
          className="w-full rounded-2xl border border-white/10 bg-[#0f2135] px-3 py-2 text-sm text-white outline-none transition focus:border-[#EF4937]/50"
        >
          {cuotas.map((_, index) => {
            const cantidad = index + 1;
            return (
              <option key={cantidad} value={cantidad}>
                {cantidad} mes{cantidad > 1 ? "es" : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-[#0f2135]">
        <div className="hidden grid-cols-[1.2fr_0.9fr_0.8fr_0.9fr] gap-3 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:grid">
          <p>Mes</p>
          <p>Cuota base</p>
          <p>Multa</p>
          <p>Total mes</p>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {cuotasSeleccionadas.map((cuota) => (
            <div key={cuota.id} className="border-b border-white/10 px-3 py-3 last:border-b-0">
              <div className="grid gap-1.5 md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {formatPeriodoLabel(cuota.periodo)}
                  </p>
                  <p className="text-sm font-bold text-white">{money(cuota.total)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <span>Base: {money(cuota.montoBase)}</span>
                  <span>Multa: {money(cuota.multa)}</span>
                </div>
              </div>

              <div className="hidden grid-cols-[1.2fr_0.9fr_0.8fr_0.9fr] gap-3 md:grid">
                <p className="text-sm font-semibold text-white">
                  {formatPeriodoLabel(cuota.periodo)}
                </p>
                <p className="text-sm text-slate-200">{money(cuota.montoBase)}</p>
                <p className="text-sm text-slate-200">{money(cuota.multa)}</p>
                <p className="text-sm font-bold text-white">{money(cuota.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white/5 px-3 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Total a pagar</p>
        <p className="mt-1 text-xl font-bold text-white">{money(total)}</p>
        {tieneMulta ? (
          <p className="mt-1 text-xs text-slate-400">
            La multa se aplica automáticamente a cuotas vencidas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
