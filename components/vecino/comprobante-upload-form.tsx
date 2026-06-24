"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [fileOk, setFileOk] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "">("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const submittingRef = useRef(false);

  const disabled = status === "submitting";
  const okMessage = useMemo(() => "Tu comprobante fue enviado.", []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        submittingRef.current = false;
        setStatus("error");
        setErrorMsg("No se pudo enviar el comprobante. Intenta de nuevo.");
        return;
      }

      setStatus("ok");

      setTimeout(() => {
        window.location.assign(`/vecino?sent=1&t=${Date.now()}#subir-comprobante`);
      }, 600);
    } catch {
      submittingRef.current = false;
      setStatus("error");
      setErrorMsg("No se pudo enviar el comprobante. Intenta de nuevo.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const hasFile = Boolean(file);
    setFileOk(hasFile);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setPreviewType(
      file?.type === "application/pdf"
        ? "pdf"
        : file?.type.startsWith("image/")
          ? "image"
          : ""
    );
    if (hasFile) setStatus("idle");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 xl:grid-cols-[1fr_1fr] md:gap-3">
      <div className="xl:col-span-2 text-sm text-slate-100">
        <p className="font-semibold text-white">Sube una foto o PDF de tu pago.</p>
        <p className="mt-1 text-xs text-slate-200">
          Tu pago quedara pendiente de revision y el administrador lo aprobara cuando revise el comprobante.
        </p>
      </div>

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
        <p className="text-sm font-semibold text-white">Mes habilitado para pagar</p>
        <div className="px-0.5 py-0.5">
          <p className="text-lg font-extrabold text-orange-300">{periodoLabel}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              Cuota del mes: <span className="font-semibold text-white">{cuotaBaseLabel}</span>
            </p>
            <p className="pt-1 font-semibold text-slate-100">Mora acumulada:</p>
            {moraDetalle.length > 0 ? (
              <ul className="grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5">
                {moraDetalle.map((item) => (
                  <li key={item.periodoLabel} className="contents">
                    <span>{item.periodoLabel}</span>
                    <span className="text-right font-semibold text-white">{item.montoLabel}</span>
                  </li>
                ))}
                <li className="contents">
                  <span className="pt-1 font-semibold text-slate-100">Total mora:</span>
                  <span className="pt-1 text-right font-bold text-white">{totalMoraLabel}</span>
                </li>
                <li className="contents">
                  <span className="pt-1 text-sm font-bold text-orange-200">Total a pagar:</span>
                  <span className="pt-1 text-right text-lg font-extrabold text-orange-300">{montoLabel}</span>
                </li>
              </ul>
            ) : (
              <div className="grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
                <span>Sin mora</span>
                <span />
                <span className="pt-1 font-semibold text-slate-100">Total mora:</span>
                <span className="pt-1 text-right font-bold text-white">{totalMoraLabel}</span>
                <span className="pt-1 text-sm font-bold text-orange-200">Total a pagar:</span>
                <span className="pt-1 text-right text-lg font-extrabold text-orange-300">{montoLabel}</span>
              </div>
            )}
          </div>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300">
            Este monto corresponde al mes más antiguo pendiente. Cuando sea aprobado, podrás pagar el siguiente mes.
          </p>
        </div>
        <input type="hidden" name="cuota_id" value={cuotaId} />
        <input type="hidden" name="referencia" value="" />
      </div>

      <div className="xl:col-span-2">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col items-start gap-2">
            <label
              htmlFor="archivo-comprobante"
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-cyan-500 px-5 text-sm font-bold text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-400"
            >
              Elegir foto o PDF
            </label>
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#ff5a3d] px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "submitting" ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>

          {fileOk ? (
            <div className="flex min-w-0 items-center gap-3">
              {previewType === "image" ? (
                <img
                  src={previewUrl}
                  alt="Vista previa del comprobante"
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="text-sm font-extrabold text-cyan-100">PDF</span>
              )}
              <span className="text-sm font-semibold leading-5 text-white">
                Archivo listo para enviar.
                <span className="block text-xs font-medium text-slate-200">
                  Tu comprobante ya fue cargado.
                </span>
              </span>
            </div>
          ) : null}
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
    </form>
  );
}