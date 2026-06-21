"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/superadmin/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues?: {
    id?: string;
    nombre?: string;
    codigo?: string;
    activo?: boolean;
    cuota_mensual?: number;
    dia_vencimiento?: number;
    valor_mora?: number;
    saldo_inicial?: number;
  };
  submitLabel?: string;
  deleteLabel?: string;
  showDelete?: boolean;
  deleteAction?: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

export default function BlockCreateForm({
  action,
  initialValues,
  submitLabel = "Crear bloque",
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-3.5">
      {state.message && (
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

      <form action={formAction} className="space-y-3">
        {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-white/80">Nombre del bloque</span>
            <input
              name="nombre"
              placeholder="Conjunto Central"
              defaultValue={initialValues?.nombre}
              className="theme-input w-full rounded-2xl px-3 py-2"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">Código</span>
            <input
              name="codigo"
              placeholder="BLOQUE-01"
              defaultValue={initialValues?.codigo}
              className="theme-input w-full rounded-2xl px-3 py-2 uppercase"
              required
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">Cuota mensual (Bs)</span>
            <input
              type="number"
              name="cuota_mensual"
              step="0.01"
              defaultValue={initialValues?.cuota_mensual ?? 0}
              className="theme-input w-full rounded-2xl px-3 py-2"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">Día de vencimiento</span>
            <input
              type="number"
              name="dia_vencimiento"
              min={1}
              max={28}
              defaultValue={initialValues?.dia_vencimiento ?? 15}
              className="theme-input w-full rounded-2xl px-3 py-2"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">Mora mensual (Bs)</span>
            <input
              type="number"
              name="valor_mora"
              step="0.01"
              defaultValue={initialValues?.valor_mora ?? 0}
              className="theme-input w-full rounded-2xl px-3 py-2"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-semibold text-white/80">Saldo inicial (Bs)</span>
            <input
              type="number"
              name="saldo_inicial"
              step="0.01"
              defaultValue={initialValues?.saldo_inicial ?? 0}
              className="theme-input w-full rounded-2xl px-3 py-2"
              required
            />
          </label>
        </div>

        <label className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={initialValues?.activo ?? true}
            className="h-4 w-4 rounded border-white/30 bg-white/10"
          />
          <span className="text-sm font-semibold text-white/80">Activo</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando..." : submitLabel}
        </button>
      </form>
    </div>
  );
}
