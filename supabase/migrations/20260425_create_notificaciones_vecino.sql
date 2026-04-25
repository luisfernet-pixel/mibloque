create table if not exists public.notificaciones_vecino (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null references public.bloques(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  tipo text not null default 'info',
  titulo text not null,
  mensaje text not null,
  leida boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notificaciones_vecino_departamento_created
  on public.notificaciones_vecino (departamento_id, created_at desc);
