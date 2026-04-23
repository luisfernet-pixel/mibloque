import type { Metadata } from "next";
import BlockCreateForm from "@/app/superadmin/_components/block-create-form";
import { createBlockAction } from "@/app/superadmin/actions";

export const metadata: Metadata = {
  title: "Nuevo bloque",
};

export default function NuevoBloquePage() {
  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Crear nuevo bloque
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Añade un bloque para luego crear sus administradores y departamentos.
        </p>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <BlockCreateForm action={createBlockAction} />
      </section>
    </main>
  );
}
