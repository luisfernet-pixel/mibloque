"use client";

import { useMemo, useState } from "react";

export default function ComprobanteUploadForm({
  cuotaId,
  periodoLabel,
  montoLabel,
}: {
  cuotaId: string;
  periodoLabel: string;
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
      <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-[#2b4768] p-3 text-sm text-slate-100">
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
        <label className="text-sm font-semibold text-white">
          Mes habilitado para pagar
        </label>
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2">
          <p className="text-sm font-bold text-cyan-100">{periodoLabel}</p>
          <p className="mt-1 text-xs text-cyan-50">Monto a pagar: {montoLabel}</p>
        </div>
        <input type="hidden" name="cuota_id" value={cuotaId} />
        <input type="hidden" name="referencia" value="" />
      </div>

      <div className="space-y-2 xl:col-span-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor="archivo-comprobante"
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15"
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
