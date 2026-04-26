alter table if exists public.buzon_sugerencias
  add column if not exists respuesta_leida boolean not null default false;

create index if not exists idx_buzon_sugerencias_vecino_respuesta_leida
  on public.buzon_sugerencias (vecino_id, respuesta_leida, respondido_at desc);
