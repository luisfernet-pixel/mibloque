import { createClient } from "@/lib/supabase/server";

export default async function DepartamentosPage() {
  const supabase = await createClient();

  const { data: departamentos, error } = await supabase
    .from("departamentos")
    .select("id, numero, estado_ocupacion, activo")
    .order("numero", { ascending: true });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Departamentos
            </h1>
            <p className="text-gray-600">
              Datos reales desde Supabase
            </p>
          </div>

          <button className="rounded-xl bg-black px-4 py-2 text-white font-medium">
            Nuevo departamento
          </button>
        </div>

        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {error ? (
  <div className="p-6 text-red-600">
    Error cargando departamentos: {error.message}
  </div>
) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="px-4 py-3">Depto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Activo</th>
                  </tr>
                </thead>

                <tbody>
                  {departamentos?.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-semibold">
                        {item.numero}
                      </td>

                      <td className="px-4 py-3 capitalize">
                        {item.estado_ocupacion}
                      </td>

                      <td className="px-4 py-3">
                        {item.activo ? "Sí" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}