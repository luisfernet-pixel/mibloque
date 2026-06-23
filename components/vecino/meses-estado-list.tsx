"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPeriodoLabel } from "@/lib/periodo";

type EstadoFila = "pendiente" | "en_revision" | "pagado";

type FilaMes = {
  id: string;
  periodo: string | null;
  monto_total: number | null;
  status: EstadoFila;
  anio: number | null;
  mes: number | null;
  reciboPagoId: string | null;
  rejectedAt: string | null;
};

function money(value: number | null | undefined) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function estadoLabel(value: EstadoFila) {
  if (value === "pagado") return "Pagado";
  if (value === "en_revision") return "En revision";
  return "Pendiente";
}

function estadoClass(value: EstadoFila) {
  if (value === "pagado") {
    return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
  }
  if (value === "en_revision") {
    return "border-yellow-400/40 bg-yellow-500/10 text-yellow-100";
  }
  return "border-orange-400/30 bg-orange-500/10 text-orange-100";
}

function compareDesc(a: FilaMes, b: FilaMes) {
  const anioA = Number(a.anio || 0);
  const anioB = Number(b.anio || 0);
  if (anioA !== anioB) return anioB - anioA;
  return Number(b.mes || 0) - Number(a.mes || 0);
}

function comparePendienteAsc(a: FilaMes, b: FilaMes) {
  const anioA = Number(a.anio || 0);
  const anioB = Number(b.anio || 0);
  if (anioA !== anioB) return anioA - anioB;
  return Number(a.mes || 0) - Number(b.mes || 0);
}

export default function MesesEstadoList({
  filas,
  cuotaHabilitadaId,
  cuotaHabilitadaPeriodo,
}: {
  filas: FilaMes[];
  cuotaHabilitadaId: string | null;
  cuotaHabilitadaPeriodo: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const scrollToUploadForm = () => {
    const target = document.getElementById("subir-comprobante");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filasOrdenadas = useMemo(() => {
    const pendientes = filas
      .filter((item) => item.status === "pendiente")
      .sort(comparePendienteAsc);
    const resto = filas
      .filter((item) => item.status !== "pendiente")
      .sort(compareDesc);

    return [...pendientes, ...resto];
  }, [filas]);

  const filasVisibles = showAll ? filasOrdenadas : filasOrdenadas.slice(0, 3);
  const canExpand = filasOrdenadas.length > 3;

  return (
    <>
      <div className="space-y-2 md:hidden">
        <p className="px-1 text-xs text-slate-300">En celular puedes revisar tus cuotas una por una.</p>
        {filasVisibles.map((item) => (
          <article key={item.id} className="rounded-xl border border-white/10 bg-[#2d4a6c] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-white">{formatPeriodoLabel(item.periodo)}</p>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${estadoClass(
                  item.status
                )}`}
              >
                {estadoLabel(item.status)}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-slate-200">Monto: {money(item.monto_total)}</p>
            {item.status === "pendiente" && item.rejectedAt ? (
              <div className="mt-2 rounded-lg border border-red-300/30 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-100">
                Tu comprobante anterior fue rechazado. Puedes subir uno nuevo.
              </div>
            ) : null}

            <div className="mt-2">
              {item.status === "pendiente" ? (
                cuotaHabilitadaId === item.id ? (
                  <button
                    type="button"
                    onClick={scrollToUploadForm}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-[#ff5a3d] px-3 text-[11px] font-bold text-white transition hover:brightness-110"
                  >
                    Subir comprobante
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-orange-100">
                    Debes pagar primero {formatPeriodoLabel(cuotaHabilitadaPeriodo || "mes anterior")}
                  </span>
                )
              ) : null}

              {item.status === "en_revision" ? (
                <span className="text-xs font-semibold text-yellow-100">
                  Pendiente de revision
                </span>
              ) : null}

              {item.status === "pagado" ? (
                item.reciboPagoId ? (
                  <Link
                    href={`/vecino/recibos/${item.reciboPagoId}/pdf`}
                    target="_blank"
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-cyan-500 px-3 text-[11px] font-bold text-white transition hover:bg-cyan-400"
                  >
                    Descargar recibo
                  </Link>
                ) : (
                  <span className="text-xs text-cyan-100">Pago aprobado</span>
                )
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full overflow-hidden rounded-2xl border border-white/10">
          <thead className="bg-[#1f3d5f] text-left text-xs uppercase tracking-[0.2em] text-slate-300">
            <tr>
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2">Monto</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((item) => (
              <tr key={item.id} className="border-t border-white/10 bg-[#2d4a6c]">
                <td className="px-4 py-4 font-semibold text-white">
                  {formatPeriodoLabel(item.periodo)}
                </td>
                <td className="px-4 py-4 text-slate-100">{money(item.monto_total)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-3 py-2 text-sm font-bold ${estadoClass(
                      item.status
                    )}`}
                  >
                    {estadoLabel(item.status)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {item.status === "pendiente" && item.rejectedAt ? (
                    <div className="mb-2 max-w-sm rounded-lg border border-red-300/30 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-100">
                      Tu comprobante anterior fue rechazado. Puedes subir uno nuevo.
                    </div>
                  ) : null}
                  {item.status === "pendiente" ? (
                    cuotaHabilitadaId === item.id ? (
                      <button
                        type="button"
                        onClick={scrollToUploadForm}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Subir comprobante
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-orange-100">
                        Debes pagar primero {formatPeriodoLabel(cuotaHabilitadaPeriodo || "mes anterior")}
                      </span>
                    )
                  ) : null}

                  {item.status === "en_revision" ? (
                    <span className="text-sm font-semibold text-yellow-100">
                      Pendiente de revisi?n
                    </span>
                  ) : null}

                  {item.status === "pagado" ? (
                    item.reciboPagoId ? (
                      <Link
                        href={`/vecino/recibos/${item.reciboPagoId}/pdf`}
                        target="_blank"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-white transition hover:bg-cyan-400"
                      >
                        Descargar recibo
                      </Link>
                    ) : (
                      <span className="text-sm text-cyan-100">Pago aprobado</span>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canExpand ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10 md:min-h-[40px] md:text-sm"
          >
            {showAll ? "Ocultar historial" : "Ver historial completo"}
          </button>
        </div>
      ) : null}
    </>
  );
}
