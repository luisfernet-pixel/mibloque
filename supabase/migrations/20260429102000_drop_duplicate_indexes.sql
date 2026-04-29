-- Limpieza de indices duplicados detectados por Supabase advisors.
-- Se mantienen los equivalentes activos para no afectar consultas.

drop index if exists public.idx_buzon_sugerencias_bloque_estado_created;
drop index if exists public.idx_buzon_vecino_created;
alter table public.usuarios
  drop constraint if exists usuarios_username_unique;
