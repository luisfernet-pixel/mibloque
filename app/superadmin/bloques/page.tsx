import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Bloques",
};

export default async function BloquesPage() {
  const supabase = await createClient();

  const { data: bloques } = await supabase
    .from("bloques")
    .select("id, nombre, codigo, activo, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Bloques registrados
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Revisa los bloques activos y crea nuevos desde el mismo panel.
        </p>

        <div className="mt-6">
          <Link
            href="/superadmin/bloques/nuevo"
            className="btn-primary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
          >
            Nuevo bloque
          </Link>
        </div>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/10 text-left text-slate-200">
              <tr>
                <th className="px-5 py-4">Nombre</th>
                <th className="px-5 py-4">Código</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Fecha</th>
                <th className="px-5 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bloques?.map((item) => (
                <tr key={item.id} className="border-t border-white/10 text-white">
                  <td className="px-5 py-4">{item.nombre}</td>
                  <td className="px-5 py-4">{item.codigo}</td>
                  <td className="px-5 py-4">
                    {item.activo ? "Activo" : "Pausado"}
                  </td>
                  <td className="px-5 py-4">
                    {new Date(item.created_at).toLocaleDateString("es-BO")}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/superadmin/bloques/${item.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Abrir ficha
                    </Link>
                  </td>
                </tr>
              ))}

              {(!bloques || bloques.length === 0) && (
                <tr className="border-t border-white/10 text-slate-300">
                  <td colSpan={5} className="px-5 py-6 text-center">
                    Todavía no hay bloques registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
