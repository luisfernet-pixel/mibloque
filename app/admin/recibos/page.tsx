import { createClient } from "@/lib/supabase/server";

export default async function AdminRecibosPage() {
  const supabase = await createClient();

  const { data: vecinos } = await supabase
    .from("vecinos")
    .select("id,nombre,departamento")
    .order("nombre");

  const { data: recibos } = await supabase
    .from("recibos")
    .select(`
      id,
      titulo,
      monto,
      estado,
      fecha,
      vecinos(nombre, departamento)
    `)
    .order("fecha", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">Recibos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Publica recibos para cada vecino.
        </p>
      </div>

      <form
        action="/admin/recibos/upload"
        method="post"
        encType="multipart/form-data"
        className="panel p-6 grid gap-4"
      >
        <select name="vecino_id" required className="input">
          <option value="">Seleccionar vecino</option>

          {vecinos?.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.nombre} - Depto {v.departamento}
            </option>
          ))}
        </select>

        <input
          name="titulo"
          placeholder="Ej: Recibo Abril 2026"
          required
          className="input"
        />

        <input
          name="monto"
          type="number"
          step="0.01"
          placeholder="Monto"
          required
          className="input"
        />

        <select name="estado" className="input">
          <option>Pagado</option>
          <option>Pendiente</option>
          <option>Vencido</option>
        </select>

        <input
          name="archivo"
          type="file"
          accept="application/pdf"
          required
          className="input"
        />

        <button className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white py-3 font-medium">
          Publicar recibo
        </button>
      </form>

      <div className="space-y-3">
        {recibos?.map((r: any) => (
          <div key={r.id} className="panel p-4">
            <div className="font-semibold">{r.titulo}</div>

            <div className="text-sm text-slate-400">
              {r.vecinos?.nombre} - Depto {r.vecinos?.departamento}
            </div>

            <div className="text-sm text-slate-400">
              Bs {Number(r.monto).toFixed(2)} | {r.estado} | {r.fecha}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}