import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireBlockAdmin } from "@/lib/auth";
import { ensureHistoricalDebtCuotas } from "@/lib/cuotas-sync";
import DeudaInicialInput from "@/components/admin/deuda-inicial-input";
import { compareYearMonth, getCurrentBoliviaYearMonth } from "@/lib/bolivia-time";

function parseMonths(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

type DepartamentoRow = {
  id: string;
  numero: string | null;
  estado_ocupacion: string | null;
  activo: boolean | null;
};

type VecinoRow = {
  departamento_id: string | null;
  nombre: string | null;
};

type CuotaRow = {
  departamento_id: string | null;
  anio: number | null;
  mes: number | null;
};

export default async function DepartamentosPage({
  searchParams,
}: {
  searchParams?: Promise<{ confirm?: string; ok?: string }>;
}) {
  const usuario = await requireAdmin();
  if (!usuario) redirect("/login");

  const bloqueId = usuario.perfil.bloque_id;
  if (!bloqueId) redirect("/login");

  const params = (await searchParams) ?? {};
  const confirmed = params.confirm === "1";

  if (!confirmed) {
    return (
      <main className="min-h-screen bg-[#324359] p-4 text-white md:p-6">
        <div className="mx-auto max-w-5xl">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#071426] shadow-2xl">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-5 md:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                  Carga inicial
                </p>
                <h1 className="mt-2 text-3xl font-bold leading-tight text-white md:text-5xl">
                  Deudas antiguas de departamentos
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Antes de entrar, revisa bien la carga inicial. Esto define el historial desde el
                  arranque del bloque.
                </p>
                <div className="mt-3.5">
                  <Link
                    href="/admin/departamentos?confirm=1"
                    className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 hover:text-white"
                  >
                    OK, continuar
                  </Link>
                </div>
              </div>

              <div className="border-t border-white/10 bg-[#10233b] p-3 lg:border-l lg:border-t-0 md:p-3.5">
                <p className="text-sm font-semibold text-white">Importante</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  Usalo con cuidado
                </p>
                <div className="mt-2.5 space-y-2 text-xs leading-5 text-slate-200">
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    Esta carga se hace normalmente una sola vez al inicio del sistema.
                  </p>
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    El administrador del bloque debe revisar bien los meses antes de guardar.
                  </p>
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    Si luego se cambia sin control, el historial de pagos y recibos puede quedar
                    alterado.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  async function guardarDeudaInicial(formData: FormData) {
    "use server";

    const auth = await requireBlockAdmin();
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

    await ensureHistoricalDebtCuotas(supabaseAdmin, {
      bloqueId: departamento.bloque_id,
      departamentoId: departamento.id,
      mesesAdeudadosIniciales,
    });

    redirect("/admin/departamentos?confirm=1&ok=1");
  }

  const supabase = createAdminClient();
  const current = getCurrentBoliviaYearMonth();

  const [{ data: departamentos, error }, { data: vecinos }, { data: cuotas }] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, numero, estado_ocupacion, activo")
      .eq("bloque_id", bloqueId)
      .order("numero", { ascending: false }),
    supabase
      .from("usuarios")
      .select("departamento_id, nombre")
      .eq("bloque_id", bloqueId)
      .eq("rol", "vecino")
      .eq("activo", true),
    supabase
      .from("cuotas")
      .select("departamento_id, anio, mes")
      .eq("bloque_id", bloqueId),
  ]);

  const departamentosRows = (departamentos ?? []) as DepartamentoRow[];
  const vecinosRows = (vecinos ?? []) as VecinoRow[];
  const cuotasRows = (cuotas ?? []) as CuotaRow[];

  const vecinoPorDepto = new Map<string, string>();
  for (const vecino of vecinosRows) {
    const key = String(vecino.departamento_id || "");
    if (!key || vecinoPorDepto.has(key)) continue;
    vecinoPorDepto.set(key, String(vecino.nombre || "Sin vecino asignado"));
  }

  const deudaInicialPorDepto = new Map<string, number>();
  for (const cuota of cuotasRows) {
    const deptoId = String(cuota.departamento_id || "");
    const anio = Number(cuota.anio || 0);
    const mes = Number(cuota.mes || 0);
    if (!deptoId || !anio || !mes) continue;
    if (compareYearMonth(anio, mes, current.year, current.month) !== -1) continue;
    deudaInicialPorDepto.set(deptoId, (deudaInicialPorDepto.get(deptoId) || 0) + 1);
  }

  return (
    <main className="min-h-screen bg-[#324359] p-4 text-white md:p-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071426] shadow-2xl">
          <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
            <div className="p-3 md:p-3.5">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                Carga inicial
              </p>
              <h1 className="mt-1.5 text-lg font-bold text-white md:text-2xl">
                Deudas antiguas de departamentos
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
                Usa esta pantalla solo al comenzar con un bloque o para corregir un caso puntual.
                Aqui defines cuantos meses arrastra cada departamento.
              </p>
            </div>

            <div className="border-t border-white/10 bg-[#10233b] p-3 lg:border-l lg:border-t-0 md:p-3.5">
              <p className="text-sm font-semibold text-white">Importante</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                Usalo con cuidado
              </p>
              <div className="mt-2.5 space-y-2 text-xs leading-5 text-slate-200">
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  Esta carga se hace normalmente una sola vez al inicio del sistema.
                </p>
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  El administrador del bloque debe revisar bien los meses antes de guardar.
                </p>
                <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  Si luego se cambia sin control, el historial de pagos y recibos puede quedar
                  alterado.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#213b59] shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 md:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
                Tabla de carga
              </p>
              <h2 className="mt-1 text-base font-bold text-white md:text-lg">
                Meses adeudados por departamento
              </h2>
            </div>
          </div>

          {error ? (
            <div className="p-6 text-red-200">Error cargando departamentos: {error.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-white md:text-xs">
                <thead className="bg-white/5 text-left text-slate-200">
                  <tr>
                    <th className="px-3 py-1.5">Depto</th>
                    <th className="px-3 py-1.5">Vecino</th>
                    <th className="px-3 py-1.5">Deuda inicial</th>
                  </tr>
                </thead>

                <tbody>
                  {departamentosRows.map((item) => (
                    <tr key={item.id} className="border-t border-white/10 transition hover:bg-white/5">
                      <td className="px-3 py-2 font-semibold text-white">{item.numero}</td>
                      <td className="px-3 py-2 text-slate-200">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
                          {vecinoPorDepto.get(item.id) || "Sin vecino asignado"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <form action={guardarDeudaInicial} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="departamento_id" value={item.id} />
                          <DeudaInicialInput
                            name="meses_adeudados_iniciales"
                            defaultValue={deudaInicialPorDepto.get(item.id) ?? 0}
                          />
                          <button
                            type="submit"
                            className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                          >
                            Guardar
                          </button>
                        </form>
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


