import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Departamentos",
};

export default async function VecinosPage() {
  const supabase = await createClient();

  const [{ data: vecinos }, { data: bloques }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, username, email, bloque_id, departamento_id, activo, created_at")
      .eq("rol", "vecino")
      .order("created_at", { ascending: false }),
    supabase.from("bloques").select("id, nombre"),
  ]);

  const bloqueMap = new Map(
    (bloques ?? []).map((item) => [item.id, item.nombre] as const)
  );

  return (
    <main className="space-y-6">
      <section className="theme-hero rounded-[30px] p-6 shadow-2xl ring-1 ring-white/10 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
          Superadmin
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          Departamentos
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Edita, desactiva o crea registros de departamentos.
        </p>
        <div className="mt-6">
          <Link
            href="/superadmin/vecinos/nuevo"
            className="btn-primary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
          >
            Nuevo departamento
          </Link>
        </div>
      </section>

      <section className="theme-panel rounded-[30px] p-6 shadow-xl ring-1 ring-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/10 text-left text-slate-200">
              <tr>
                <th className="px-5 py-4">Nombre</th>
                <th className="px-5 py-4">CÃ³digo</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Bloque</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vecinos?.map((item) => (
                <tr key={item.id} className="border-t border-white/10 text-white">
                  <td className="px-5 py-4">{item.nombre}</td>
                  <td className="px-5 py-4">{item.username}</td>
                  <td className="px-5 py-4">{item.email}</td>
                  <td className="px-5 py-4">{bloqueMap.get(item.bloque_id) ?? "-"}</td>
                  <td className="px-5 py-4">
                    {item.activo ? "Activo" : "Desactivado"}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/superadmin/vecinos/${item.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}

              {(!vecinos || vecinos.length === 0) && (
                <tr className="border-t border-white/10 text-slate-300">
                  <td colSpan={6} className="px-5 py-6 text-center">
                    No hay departamentos registrados.
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
