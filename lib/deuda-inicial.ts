import { compareYearMonth, getCurrentBoliviaYearMonth } from "@/lib/bolivia-time";

export async function getDeudaInicialState(supabase: any, bloqueId: string, departamentoId: string) {
  const current = getCurrentBoliviaYearMonth();
  const [{ data: cuotas }, { data: pago }, { data: comprobanteAprobado }] = await Promise.all([
    supabase.from("cuotas").select("anio, mes, estado").eq("bloque_id", bloqueId).eq("departamento_id", departamentoId),
    supabase.from("pagos").select("id").eq("bloque_id", bloqueId).eq("departamento_id", departamentoId).limit(1).maybeSingle(),
    supabase.from("confirmaciones_pago").select("id").eq("bloque_id", bloqueId).eq("departamento_id", departamentoId).eq("estado", "aprobado").limit(1).maybeSingle(),
  ]);
  const historicas = (cuotas ?? []).filter((cuota: { anio?: number | null; mes?: number | null }) =>
    compareYearMonth(Number(cuota.anio || 0), Number(cuota.mes || 0), current.year, current.month) === -1
  );
  return {
    mesesActuales: historicas.length,
    tienePagos: Boolean(pago || comprobanteAprobado) || historicas.some((cuota: { estado?: string | null }) => String(cuota.estado || "").toLowerCase() === "pagado"),
  };
}