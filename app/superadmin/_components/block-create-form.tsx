"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/superadmin/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

export default function BlockCreateForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

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

      <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-white/80">
            Nombre del bloque
          </span>
          <input
            name="nombre"
            placeholder="Conjunto Central"
            className="theme-input w-full rounded-2xl px-4 py-3"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-white/80">
            Código
          </span>
          <input
            name="codigo"
            placeholder="BLOQUE-01"
            className="theme-input w-full rounded-2xl px-4 py-3 uppercase"
            required
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creando..." : "Crear bloque"}
        </button>
      </form>
    </div>
  );
}
