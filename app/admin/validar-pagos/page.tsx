import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function aprobarPago(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") || "");

  if (!id) return;

  const { data: pago } = await supabase
    .from("confirmaciones_pago")
    .select("id, cuota_id")
    .eq("id", id)
    .single();

  if (!pago) return;

  await supabase
    .from("confirmaciones_pago")
    .update({
      estado: "aprobado",
      revisado_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase
    .from("cuotas")
    .update({
      estado: "pagado",
    })
    .eq("id", pago.cuota_id);

  redirect("/admin/validar-pagos");
}

export default async function ValidarPagosPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("confirmaciones_pago")
    .select(`
      id,
      created_at,
      monto_reportado,
      referencia,
      comprobante_url,
      estado,
      departamentos:departamento_id(numero),
      cuotas:cuota_id(periodo)
    `)
    .order("created_at", { ascending: false });

  const items = data || [];

  return (
    <main className="min-h-screen bg-[#324359] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-[#071426] p-8 text-white">
          <h1 className="text-3xl font-bold">Validar pagos</h1>
          <p className="text-slate-300">
            Aprueba comprobantes enviados por vecinos
          </p>
        </section>

        <section className="space-y-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="rounded-3xl bg-white/10 p-5 text-white"
            >
              <div className="grid gap-4 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-300">Depto</p>
                  <p className="font-bold">{item.departamentos?.numero}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-300">Periodo</p>
                  <p className="font-bold">{item.cuotas?.periodo}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-300">Monto</p>
                  <p className="font-bold">Bs {item.monto_reportado}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-300">Estado</p>
                  <p className="font-bold">{item.estado}</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300">
                Ref: {item.referencia || "-"}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={item.comprobante_url}
                  target="_blank"
                  className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-black"
                >
                  Ver comprobante
                </a>

                {item.estado === "pendiente" && (
                  <form action={aprobarPago}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="rounded-2xl bg-green-500 px-4 py-2 font-bold text-black"
                    >
                      Aprobar pago
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}