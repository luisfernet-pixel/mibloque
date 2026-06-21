import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { ensureHistoricalDebtCuotas } from "@/lib/cuotas-sync";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string }>;
};

function parseMonths(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

export default async function DepartamentoDeudaPage({ params, searchParams }: Props) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const bloqueId = usuario.perfil.bloque_id;

  if (!bloqueId) redirect("/login");

  async function guardarDeudaInicial(formData: FormData) {
    "use server";

    const auth = await requireAdmin();
    if (!auth) redirect("/login");

    const deptoId = String(formData.get("departamento_id") || "").trim();
    const mesesAdeudadosIniciales = parseMonths(formData.get("meses_adeudados_iniciales"));
    if (!deptoId) return;

    const supabaseAdmin = createAdminClient();
    const { data: departamento } = await supabaseAdmin
      .from("departamentos")
      .select("id, numero, bloque_id")
      .eq("id", deptoId)
      .maybeSingle();

    if (!departamento || departamento.bloque_id !== auth.perfil.bloque_id) {
      throw new Error("No tienes acceso a ese departamento.");
    }

    const { data: vecino } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("rol", "vecino")
      .eq("departamento_id", deptoId)
      .maybeSingle();

    if (!vecino) {
      throw new Error("Primero debe existir un vecino asignado a este departamento.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({ meses_adeudados_iniciales: mesesAdeudadosIniciales })
      .eq("id", vecino.id);

    if (updateError) {
      throw updateError;
    }

    await ensureHistoricalDebtCuotas(supabaseAdmin, {
      bloqueId: departamento.bloque_id,
      departamentoId: departamento.id,
      mesesAdeudadosIniciales,
    });

    redirect(`/admin/departamentos/${deptoId}?ok=1`);
  }

  const [{ data: departamento }, { data: vecino }] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, numero, bloque_id, estado_ocupacion, activo")
      .eq("id", id)
      .eq("bloque_id", bloqueId)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, nombre, meses_adeudados_iniciales")
      .eq("rol", "vecino")
      .eq("departamento_id", id)
      .maybeSingle(),
  ]);

  if (!departamento) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Departamento {departamento.numero}</h1>
            <p className="text-gray-600">Carga la deuda inicial del vecino desde aqui.</p>
          </div>
          <Link href="/admin/departamentos" className="rounded-xl border px-4 py-2 font-medium text-gray-700">
            Volver
          </Link>
        </div>

        {query.ok === "1" ? (
          <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-green-800">
            Deuda inicial guardada.
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Vecino asignado</p>
            <p className="font-semibold text-gray-900">{vecino?.nombre ?? "Sin vecino asignado"}</p>
            <p className="text-sm text-gray-600">Estado: {departamento.estado_ocupacion}</p>
          </div>

          {vecino ? (
            <form action={guardarDeudaInicial} className="space-y-3">
              <input type="hidden" name="departamento_id" value={departamento.id} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">Meses adeudados iniciales</span>
                <input
                  type="number"
                  name="meses_adeudados_iniciales"
                  min={0}
                  step={1}
                  defaultValue={vecino.meses_adeudados_iniciales ?? 0}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </label>
              <button type="submit" className="rounded-xl bg-black px-4 py-2 font-medium text-white">
                Guardar deuda inicial
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-gray-600">
              Primero asigna un vecino a este departamento. Luego podrás cargar la deuda inicial desde aqui.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
