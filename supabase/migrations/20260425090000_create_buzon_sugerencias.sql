create table if not exists public.buzon_sugerencias (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null references public.bloques(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  vecino_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('sugerencia', 'reclamo')),
  asunto text not null,
  mensaje text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondido')),
  respuesta text,
  respondido_at timestamptz,
  respondido_por uuid references public.usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_buzon_sugerencias_bloque_estado_created
  on public.buzon_sugerencias (bloque_id, estado, created_at desc);

create index if not exists idx_buzon_sugerencias_vecino_created
  on public.buzon_sugerencias (vecino_id, created_at desc);
