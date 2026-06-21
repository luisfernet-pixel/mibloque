"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/superadmin/actions";

type Block = {
  id: string;
  nombre: string;
};

type Props = {
  blocks: Block[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues: {
    id: string;
    bloque_id: string;
    numero: string;
    activo: boolean;
  };
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

export default function DepartmentStructureForm({ blocks, action, initialValues }: Props) {
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

      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input type="hidden" name="id" value={initialValues.id} />

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-white/80">Bloque</span>
          <select
            name="bloque_id"
            defaultValue={initialValues.bloque_id}
            className="theme-input w-full rounded-2xl px-3 py-2"
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

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-white/80">Numero</span>
          <input
            name="numero"
            placeholder="101 / 3B / 4-A"
            defaultValue={initialValues.numero}
            className="theme-input w-full rounded-2xl px-3 py-2 uppercase"
            required
          />
        </label>

        <label className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={initialValues.activo}
            className="h-4 w-4 rounded border-white/30 bg-white/10"
          />
          <span className="text-sm font-semibold text-white/80">Activo</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}