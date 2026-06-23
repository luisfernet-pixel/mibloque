"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/app/superadmin/actions";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/email-domain";

type Block = {
  id: string;
  nombre: string;
  codigo?: string | null;
};

type Departamento = {
  id: string;
  numero: string;
  bloque_id: string;
};

type Props = {
  mode: "admin" | "departamento";
  blocks: Block[];
  departamentos: Departamento[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  initialValues?: {
    id?: string;
    nombre?: string;
    telefono?: string;
    email?: string;
    username?: string;
    bloque_id?: string;
    departamento_id?: string;
    departamento_numero?: string;
    banco?: string;
    numero_cuenta?: string;
    qr_url?: string;
    activo?: boolean;
  };
  allowPassword?: boolean;
  showActive?: boolean;
  autoGenerateAdminEmail?: boolean;
  serviceRoleAvailable?: boolean;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

function extractCode(value: string) {
  const digits = String(value || "").match(/\d+/g)?.join("");
  return digits || String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildAdminEmail(code: string) {
  return `admin${extractCode(code) || "bloque"}@${INTERNAL_EMAIL_DOMAIN}`;
}

function buildDepartmentCode(blockCode: string, departmentNumber: string) {
  const block = extractCode(blockCode);
  const number = String(departmentNumber || "").trim().replace(/\s+/g, "").toUpperCase();
  return `${block || "bloque"}-${number || "000"}`;
}

function buildDepartmentEmail(blockCode: string, departmentNumber: string) {
  return `${buildDepartmentCode(blockCode, departmentNumber).toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

export default function UserCreateForm({
  mode,
  blocks,
  action,
  submitLabel,
  initialValues,
  allowPassword = true,
  showActive = false,
  autoGenerateAdminEmail = false,
  serviceRoleAvailable = true,
}: Props) {
  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort((a, b) =>
        String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es", {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [blocks]
  );

  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedBlockId, setSelectedBlockId] = useState(
    () => initialValues?.bloque_id ?? sortedBlocks[0]?.id ?? ""
  );
  const [departmentNumber, setDepartmentNumber] = useState(
    () => initialValues?.departamento_numero ?? ""
  );
  const [qrPreviewUrl, setQrPreviewUrl] = useState(initialValues?.qr_url ?? "");

  useEffect(() => {
    setQrPreviewUrl(initialValues?.qr_url ?? "");
  }, [initialValues?.qr_url]);

  const selectedBlock = useMemo(
    () => sortedBlocks.find((item) => item.id === selectedBlockId),
    [sortedBlocks, selectedBlockId]
  );

  const adminEmailPreview =
    mode === "admin" && autoGenerateAdminEmail
      ? buildAdminEmail(selectedBlock?.codigo || selectedBlock?.nombre || "")
      : "";

  const departmentCodePreview =
    mode === "departamento"
      ? buildDepartmentCode(
          selectedBlock?.codigo || selectedBlock?.nombre || "",
          departmentNumber
        )
      : "";

  const departmentEmailPreview =
    mode === "departamento"
      ? buildDepartmentEmail(
          selectedBlock?.codigo || selectedBlock?.nombre || "",
          departmentNumber
        )
      : "";

  const authRequiredMode = mode === "admin" || mode === "departamento";
  const authWarning = authRequiredMode && !serviceRoleAvailable;
  const isServiceRoleError =
    authWarning &&
    typeof state.message === "string" &&
    state.message.includes("SUPABASE_SERVICE_ROLE_KEY");

  const qrPreviewPanel =
    mode === "admin" ? (
      <aside className="rounded-[28px] border border-white/10 bg-white/5 p-5 lg:sticky lg:top-6">
        <p className="text-2xl font-bold text-white">Vista previa del QR</p>
        <div className="mt-4 rounded-[28px] border border-white/15 bg-[#38516f] p-5">
          {qrPreviewUrl ? (
            <img
              src={qrPreviewUrl}
              alt="Vista previa del QR del admin"
              className="mx-auto h-auto max-h-[540px] w-full max-w-[340px] rounded-[28px] border border-white/10 bg-white object-contain p-3"
            />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/5 px-6 text-center text-sm text-slate-300">
              Aun no hay QR cargado para previsualizar.
            </div>
          )}
        </div>
      </aside>
    ) : null;

  return (
    <div className="space-y-3.5">
      {state.message && !isServiceRoleError && (
        <div
          className={`rounded-2xl border px-3 py-2 text-sm font-medium ${
            state.ok
              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              : "border-orange-300/20 bg-orange-500/10 text-orange-100"
          }`}
        >
          {state.message}
        </div>
      )}

      {authWarning && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-50">
          Falta <span className="font-bold">SUPABASE_SERVICE_ROLE_KEY</span> en
          tu <span className="font-bold">.env.local</span>. Sin esa clave no
          podemos crear admins ni departamentos sin que Supabase intente enviar
          correos de confirmacion.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

        {mode === "admin" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-4">
              <Field
                label="Nombre del admin"
                name="nombre"
                placeholder="Escribe el nombre del admin."
                defaultValue={initialValues?.nombre}
              />

              <label className="space-y-2">
                <span className="block text-sm font-semibold text-white/80">Bloque</span>
                <select
                  name="bloque_id"
                  value={selectedBlockId}
                  onChange={(e) => {
                    setSelectedBlockId(e.target.value);
                    setDepartmentNumber("");
                  }}
                  className="theme-input w-full rounded-2xl px-3 py-2"
                  required
                >
                  <option value="">Selecciona un bloque</option>
                  {sortedBlocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.nombre}
                    </option>
                  ))}
                </select>
              </label>

              {autoGenerateAdminEmail ? (
                <div className="space-y-2">
                  <span className="block text-sm font-semibold text-white/80">Email</span>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    {adminEmailPreview || "Selecciona un bloque para generar el correo"}
                  </div>
                  <input type="hidden" name="email" value={adminEmailPreview} />
                </div>
              ) : (
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  placeholder={`admin@${INTERNAL_EMAIL_DOMAIN}`}
                  defaultValue={initialValues?.email}
                />
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Telefono (opcional)"
                  name="telefono"
                  placeholder="Ej. 76543210"
                  defaultValue={initialValues?.telefono}
                  required={false}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Banco"
                  name="banco"
                  placeholder="Ej. Banco Union"
                  defaultValue={initialValues?.banco ?? ""}
                />
                <Field
                  label="Numero de cuenta"
                  name="numero_cuenta"
                  placeholder="Ej. 1234567890"
                  defaultValue={initialValues?.numero_cuenta ?? ""}
                />
              </div>

              <div className="space-y-2 border-b border-white/10 pb-4">
                <span className="block text-sm font-semibold text-white/80">QR (imagen)</span>
                <input
                  type="file"
                  name="qr_file"
                  accept="image/*"
                  className="theme-input w-full rounded-2xl px-3 py-2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setQrPreviewUrl(initialValues?.qr_url ?? "");
                      return;
                    }
                    const objectUrl = URL.createObjectURL(file);
                    setQrPreviewUrl(objectUrl);
                  }}
                />
                <input type="hidden" name="qr_url" value={initialValues?.qr_url ?? ""} />
                <p className="text-xs text-slate-300">
                  Sube una imagen nueva del QR. Si no subes archivo, se conserva el QR actual.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {allowPassword ? (
                  <Field
                    label="Contrasena"
                    name="password"
                    type="text"
                    placeholder={initialValues?.id ? "Dejar en blanco para no cambiar" : "Minimo 6 caracteres"}
                    required={!initialValues?.id}
                  />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    La contrasena no se modifica en esta pantalla.
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <span className="font-semibold text-white">Correo del admin:</span>{" "}
                  {adminEmailPreview || "Selecciona un bloque"}
                </div>
              </div>

              {showActive && (
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={initialValues?.activo ?? true}
                    className="h-4 w-4 rounded border-white/30 bg-white/10"
                  />
                  <span className="text-sm font-semibold text-white/80">Activo</span>
                </label>
              )}

              <button
                type="submit"
                disabled={pending || authWarning}
                className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending
                  ? "Guardando..."
                  : authWarning
                    ? "Falta configuracion"
                    : submitLabel ?? "Crear admin"}
              </button>
            </div>

            {qrPreviewPanel}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-semibold text-white/80">Bloque</span>
                <select
                  name="bloque_id"
                  value={selectedBlockId}
                  onChange={(e) => {
                    setSelectedBlockId(e.target.value);
                    setDepartmentNumber("");
                  }}
                  className="theme-input w-full rounded-2xl px-3 py-2"
                  required
                >
                  <option value="">Selecciona un bloque</option>
                  {sortedBlocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Departamento"
                name="departamento_numero"
                placeholder="101 / 3B / 4-A"
                value={departmentNumber}
                onChange={(value) => setDepartmentNumber(value)}
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <span className="font-semibold text-white">Codigo:</span>{" "}
                {departmentCodePreview || "Selecciona bloque y numero"}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Nombre del residente"
                name="nombre"
                placeholder="Ej. Ana Perez"
                defaultValue={initialValues?.nombre}
              />

              <Field
                label="Telefono (opcional)"
                name="telefono"
                placeholder="Ej. 76543210"
                defaultValue={initialValues?.telefono}
                required={false}
              />
            </div>

            <input type="hidden" name="username" value={departmentCodePreview} />

            <div className="grid gap-3 md:grid-cols-2">
              {allowPassword ? (
                <Field
                  label="Contrasena"
                  name="password"
                  type="text"
                  placeholder={initialValues?.id ? "Dejar en blanco para no cambiar" : "Minimo 6 caracteres"}
                  required={!initialValues?.id}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  La contrasena no se modifica en esta pantalla.
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <span className="font-semibold text-white">Correo del departamento:</span>{" "}
                {departmentEmailPreview || "Se genera automaticamente desde el codigo"}
              </div>
            </div>

            {showActive && (
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <input
                  type="checkbox"
                  name="activo"
                  defaultChecked={initialValues?.activo ?? true}
                  className="h-4 w-4 rounded border-white/30 bg-white/10"
                />
                <span className="text-sm font-semibold text-white/80">Activo</span>
              </label>
            )}

            <button
              type="submit"
              disabled={pending || authWarning}
              className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? "Guardando..."
                : authWarning
                  ? "Falta configuracion"
                  : submitLabel ?? "Crear departamento"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  value,
  onChange,
  defaultValue,
  required = true,
  min,
  step,
  hint,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
  step?: number;
  hint?: string;
}) {
  const controlled = typeof value === "string" && onChange;

  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-white/80">{label}</span>
      <input
        type={type}
        name={name}
        value={controlled ? value : undefined}
        defaultValue={!controlled ? defaultValue : undefined}
        onChange={controlled ? (e) => onChange?.(e.target.value) : undefined}
        placeholder={placeholder}
        min={min}
        step={step}
        className="theme-input w-full rounded-2xl px-3 py-2"
        required={required}
      />
      {hint ? <p className="text-xs text-slate-300">{hint}</p> : null}
    </label>
  );
}



