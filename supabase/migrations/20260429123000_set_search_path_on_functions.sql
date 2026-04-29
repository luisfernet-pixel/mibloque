-- Hardening: fija search_path en funciones públicas recomendadas por advisors.
-- No cambia la lógica de negocio.

alter function public.set_updated_at()
  set search_path = public;

alter function public.generar_siguiente_mes_cuotas(text)
  set search_path = public;

alter function public.recalcular_mora_bloque(text)
  set search_path = public;
