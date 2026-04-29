alter table if exists public.buzon_sugerencias
  add column if not exists visto_admin boolean not null default false;

create index if not exists idx_buzon_sugerencias_bloque_visto_admin
  on public.buzon_sugerencias (bloque_id, visto_admin, created_at desc);
