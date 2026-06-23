"use client";

import { useMemo, useState } from "react";

export default function ComprobanteUploadForm({
  cuotaId,
  periodoLabel,
  cuotaBaseLabel,
  moraDetalle,
  totalMoraLabel,
  montoLabel,
}: {
  cuotaId: string;
  periodoLabel: string;
  cuotaBaseLabel: string;
  moraDetalle: { periodoLabel: string; montoLabel: string }[];
  totalMoraLabel: string;
  montoLabel: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle"
  );
  const [fileOk, setFileOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const disabled = status === "submitting";

  const fileOkMessage = useMemo(() => "Archivo listo para enviar.", []);
  const okMessage = useMemo(() => "Tu comprobante fue enviado.", []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("submitting");

    try {
      const form = e.currentTarget;
      const fd = new FormData(form);

      const res = await fetch("/api/vecino/reportar-pago", {
        method: "POST",
        body: fd,
        redirect: "follow",
      });

      if (!res.ok) {
        setStatus("error");
        setErrorMsg("No se pudo enviar el comprobante. Intenta de nuevo.");
        return;
      }

      setStatus("ok");

      setTimeout(() => {
        window.location.assign(
          `/vecino?sent=1&t=${Date.now()}#subir-comprobante`
        );
      }, 600);
    } catch {
      setStatus("error");
      setErrorMsg("No se pudo enviar el comprobante. Intenta de nuevo.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hasFile = Boolean(e.target.files && e.target.files.length > 0);
    setFileOk(hasFile);
    if (hasFile) setStatus("idle");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 xl:grid-cols-[1fr_1fr] md:gap-3"
    >
      <div className="xl:col-span-2 text-sm text-slate-100">
        <p className="font-semibold text-white">Sube una foto o PDF de tu pago.</p>
        <p className="mt-1 text-xs text-slate-200">Tu pago quedara pendiente de revision y el administrador lo aprobara cuando revise el comprobante.</p>
      </div>

      {fileOk ? (
        <div className="xl:col-span-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-white/10">
          {fileOkMessage}
        </div>
      ) : null}

      {status === "ok" ? (
        <div className="xl:col-span-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-white/10">
          {okMessage}
        </div>
      ) : null}

      {status === "error" ? (
        <div className="xl:col-span-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 ring-1 ring-white/10">
          {errorMsg || "No se pudo enviar el comprobante. Intenta de nuevo."}
        </div>
      ) : null}

      <div className="space-y-2 xl:col-span-2">
        <p className="text-sm font-semibold text-white">
          Mes habilitado para pagar
        </p>
        <div className="px-0.5 py-0.5">
          <p className="text-sm font-semibold text-slate-100">{periodoLabel}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>Cuota del mes: <span className="font-semibold text-white">{cuotaBaseLabel}</span></p>
            <p className="pt-1 font-semibold text-slate-100">Mora acumulada:</p>
            {moraDetalle.length > 0 ? (
              <ul className="space-y-0.5">
                {moraDetalle.map((item) => (
                  <li key={item.periodoLabel} className="flex max-w-xs justify-between gap-4">
                    <span>{item.periodoLabel}</span>
                    <span className="font-semibold text-white">{item.montoLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sin mora</p>
            )}
            <p className="pt-1">Total mora: <span className="font-semibold text-white">{totalMoraLabel}</span></p>
            <p className="text-sm font-bold text-white">Total a pagar: {montoLabel}</p>
          </div>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300">
            Este monto corresponde al mes más antiguo pendiente. Cuando sea aprobado, podrás pagar el siguiente mes.
          </p>
        </div>
        <input type="hidden" name="cuota_id" value={cuotaId} />
        <input type="hidden" name="referencia" value="" />
      </div>

      <div className="space-y-2 xl:col-span-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor="archivo-comprobante"
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-[#ff5a3d] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110"
          >
            Elegir foto o PDF
          </label>
          <span className="text-sm font-semibold text-white">
            Archivo del pago
          </span>
        </div>
        <input
          id="archivo-comprobante"
          type="file"
          name="archivo"
          required
          className="sr-only"
          disabled={disabled}
          onChange={onFileChange}
        />
      </div>

      <div className="xl:col-span-2">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? "Enviando..." : "Enviar comprobante"}
        </button>
      </div>
    </form>
  );
}
