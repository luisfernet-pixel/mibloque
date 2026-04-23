"use client";

import { useActionState, useMemo, useState } from "react";
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
    activo?: boolean;
  };
  allowPassword?: boolean;
  showActive?: boolean;
  autoGenerateAdminEmail?: boolean;
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
  departamentos,
  action,
  submitLabel,
  initialValues,
  allowPassword = true,
  showActive = false,
  autoGenerateAdminEmail = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedBlockId, setSelectedBlockId] = useState(
    () => initialValues?.bloque_id ?? blocks[0]?.id ?? ""
  );
  const [departmentNumber, setDepartmentNumber] = useState(
    () => initialValues?.departamento_numero ?? ""
  );
  const [username, setUsername] = useState(initialValues?.username ?? "");

  const [telefono, setTelefono] = useState(initialValues?.telefono ?? "");

  const selectedBlock = useMemo(
    () => blocks.find((item) => item.id === selectedBlockId),
    [blocks, selectedBlockId]
  );

  const departamentosFiltrados = useMemo(
    () => departamentos.filter((item) => item.bloque_id === selectedBlockId),
    [departamentos, selectedBlockId]
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

  return (
    <div className="space-y-5">
      {state.message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            state.ok
              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              : "border-orange-300/20 bg-orange-500/10 text-orange-100"
          }`}
        >
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {initialValues?.id ? (
          <input type="hidden" name="id" value={initialValues.id} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-white/80">
              Bloque
            </span>
            <select
              name="bloque_id"
              value={selectedBlockId}
              onChange={(e) => {
                setSelectedBlockId(e.target.value);
                setDepartmentNumber("");
              }}
              className="theme-input w-full rounded-2xl px-4 py-3"
              required
            >
              <option value="">Selecciona un bloque</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.nombre}
                </option>
              ))}
            </select>
          </label>

          {mode === "admin" ? (
            autoGenerateAdminEmail ? (
              <div className="space-y-2 md:col-span-2">
                <span className="block text-sm font-semibold text-white/80">
                  Email
                </span>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
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
            )
          ) : (
            <>
              <Field
                label="Departamento"
                name="departamento_numero"
                placeholder="101 / 3B / 4-A"
                value={departmentNumber}
                onChange={(value) => setDepartmentNumber(value)}
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <span className="font-semibold text-white">Código:</span>{" "}
                {departmentCodePreview || "Selecciona bloque y número"}
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={mode === "admin" ? "Nombre del admin" : "Nombre del residente"}
            name="nombre"
            placeholder={mode === "admin" ? "Ej. Juan Perez" : "Ej. Ana Pérez"}
            defaultValue={initialValues?.nombre}
          />

          <Field
            label="Teléfono"
            name="telefono"
            placeholder="Ej. 76543210"
            defaultValue={initialValues?.telefono}
          />
        </div>

        {mode === "departamento" && (
          <>
            <Field
              label="Usuario del departamento"
              name="username"
              placeholder="Se usa el código del depto"
              value={username}
              onChange={(value) => setUsername(value)}
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Email:</span>{" "}
              {departmentEmailPreview || "Se genera automáticamente desde el código"}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Referencias del bloque:</span>{" "}
              {departamentosFiltrados.length > 0
                ? departamentosFiltrados.map((item) => item.numero).join(", ")
                : "Aún no hay departamentos cargados para este bloque"}
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {allowPassword ? (
            <Field
              label="Contraseña"
              name="password"
              type="password"
              placeholder={
                initialValues?.id
                  ? "Dejar en blanco para no cambiar"
                  : "Mínimo 6 caracteres"
              }
              required={!initialValues?.id}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              La contraseña no se modifica en esta pantalla.
            </div>
          )}

          {mode === "admin" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Correo del admin:</span>{" "}
              {adminEmailPreview || "Selecciona un bloque"}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Correo del departamento:</span>{" "}
              {departmentEmailPreview || "Se genera automáticamente desde el código"}
            </div>
          )}
        </div>

        {showActive && (
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
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
          disabled={pending}
          className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Guardando..."
            : submitLabel ?? (mode === "admin" ? "Crear admin" : "Crear departamento")}
        </button>
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
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  required?: boolean;
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
        className="theme-input w-full rounded-2xl px-4 py-3"
        required={required}
      />
    </label>
  );
}
