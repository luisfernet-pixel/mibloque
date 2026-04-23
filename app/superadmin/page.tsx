import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SuperadminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "superadmin") {
    redirect("/login");
  }

  const { data: bloques } = await supabase
    .from("bloques")
    .select("id, nombre, codigo, activo, created_at")
    .order("created_at", { ascending: false });

  const { data: departamentos } = await supabase
    .from("departamentos")
    .select("id");

  const { data: cuotas } = await supabase
    .from("cuotas")
    .select("id, estado");

  const totalBloques = bloques?.length || 0;
  const totalDeptos = departamentos?.length || 0;
  const totalCuotas = cuotas?.length || 0;
  const pendientes =
    cuotas?.filter((x) => x.estado !== "pagado").length || 0;

  return (
    <main className="min-h-screen bg-[#324359] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-[#071426] p-8">
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">
                PANEL MAESTRO
              </p>

              <h1 className="mt-3 text-4xl font-bold text-white">
                SuperAdmin MiBloque
              </h1>

              <p className="mt-4 max-w-2xl text-slate-300">
                Control total de bloques, administradores y crecimiento
                comercial de la plataforma.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">
                Estado general
              </p>

              <div className="mt-4 text-4xl font-bold text-white">
                {totalBloques}
              </div>

              <p className="text-slate-300">Bloques activos en sistema</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card titulo="Bloques" valor={String(totalBloques)} />
          <Card titulo="Departamentos" valor={String(totalDeptos)} />
          <Card titulo="Cuotas" valor={String(totalCuotas)} />
          <Card titulo="Pendientes" valor={String(pendientes)} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/10">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">
                BLOQUES REGISTRADOS
              </p>
              <h2 className="text-2xl font-bold text-white">
                Lista operativa
              </h2>
            </div>

            <a
              href="/superadmin/bloques/nuevo"
              className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-black"
            >
              Nuevo bloque
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/10 text-left text-slate-200">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha</th>
                </tr>
              </thead>

              <tbody>
                {bloques?.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-white/10 text-white"
                  >
                    <td className="px-6 py-4">{item.nombre}</td>
                    <td className="px-6 py-4">{item.codigo}</td>
                    <td className="px-6 py-4">
                      {item.activo ? "Activo" : "Pausado"}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {(!bloques || bloques.length === 0) && (
                  <tr className="border-t border-white/10 text-slate-300">
                    <td colSpan={4} className="px-6 py-6 text-center">
                      No hay bloques registrados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-[#20354d] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
        {titulo}
      </p>
      <p className="mt-3 text-4xl font-bold text-white">{valor}</p>
    </div>
  );
}