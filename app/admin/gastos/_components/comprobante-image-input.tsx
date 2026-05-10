"use client";

import { useRef, useState } from "react";

const MAX_DIMENSION = 1600;
const TARGET_SIZE_BYTES = 900 * 1024;
const MIN_QUALITY = 0.55;

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.9;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  while (blob && blob.size > TARGET_SIZE_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ComprobanteImageInput({
  name,
}: {
  name: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");

  const onChange = async () => {
    const input = inputRef.current;
    const file = input?.files?.[0];

    if (!input || !file) {
      setMessage("");
      return;
    }

    try {
      const compressed = await compressImage(file);

      if (compressed !== file) {
        const dt = new DataTransfer();
        dt.items.add(compressed);
        input.files = dt.files;
        setMessage(`Comprimida: ${formatMb(file.size)} -> ${formatMb(compressed.size)}.`);
        return;
      }

      setMessage(`Archivo listo: ${formatMb(file.size)}.`);
    } catch {
      setMessage("No se pudo comprimir. Se enviara el archivo original.");
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        onChange={onChange}
        className="w-full rounded-xl border border-white/10 bg-[#173454] px-2.5 py-2 text-sm text-white file:mr-2 file:rounded-lg file:border-0 file:bg-[#ff5a3d] file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
      />
      {message ? <p className="mt-2 text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}
