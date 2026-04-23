"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "@/app/superadmin/actions";

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
  mode: "admin" | "vecino";
  blocks: Block[];
  departamentos: Departamento[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  initialValues?: {
    id?: string;
    nombre?: string;
    email?: string;
    username?: string;
    bloque_id?: string;
    departamento_id?: string;
    activo?: boolean;
  };
  allowPassword?: boolean;
  showActive?: boolean;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

export default function UserCreateForm({
  mode,
  blocks,
  departamentos,
  action,
  submitLabel,
  initialValues,
  allowPassword = true,
  showActive = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedBlockId, setSelectedBlockId] = useState(
    () => initialValues?.bloque_id ?? blocks[0]?.id ?? ""
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    () => initialValues?.departamento_id ?? ""
  );
  const [username, setUsername] = useState(initialValues?.username ?? "");

  const departamentosFiltrados = useMemo(
    () => departamentos.filter((item) => item.bloque_id === selectedBlockId),
    [departamentos, selectedBlockId]
  );

  const emailPreview =
    mode === "vecino"
      ? `${(username || initialValues?.username || "").trim().toLowerCase()}@mibloque.local`
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
          <Field
            label="Nombre"
            name="nombre"
            placeholder="Ej. Juan Perez"
            defaultValue={initialValues?.nombre}
          />

          {mode === "admin" ? (
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="admin@bloque.com"
              defaultValue={initialValues?.email}
            />
          ) : (
            <Field
              label="Usuario"
              name="username"
              placeholder="24-202"
              value={username}
              onChange={(value) => setUsername(value)}
            />
          )}
        </div>

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

          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">
              Bloque
            </span>
            <select
              name="bloque_id"
              value={selectedBlockId}
              onChange={(e) => {
                setSelectedBlockId(e.target.value);
                setSelectedDepartmentId("");
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
        </div>

        {mode === "vecino" && (
          <>
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-white/80">
                Departamento
              </span>
              <select
                name="departamento_id"
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="theme-input w-full rounded-2xl px-4 py-3"
                required
              >
                <option value="">Selecciona un departamento</option>
                {departamentosFiltrados.map((depto) => (
                  <option key={depto.id} value={depto.id}>
                    {depto.numero}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Email:</span>{" "}
              {emailPreview || "Se genera automáticamente desde el usuario"}
            </div>
          </>
        )}

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
            : submitLabel ?? (mode === "admin" ? "Crear admin" : "Crear vecino")}
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
