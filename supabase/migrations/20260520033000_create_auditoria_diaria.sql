create table if not exists public.auditoria_diaria (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null references public.bloques(id) on delete cascade,
  fecha_control date not null,
  cobrado_dashboard numeric(12,2) not null default 0,
  gastado_dashboard numeric(12,2) not null default 0,
  por_cobrar_dashboard numeric(12,2) not null default 0,
  cobrado_auditoria numeric(12,2) not null default 0,
  gastado_auditoria numeric(12,2) not null default 0,
  por_cobrar_auditoria numeric(12,2) not null default 0,
  saldo_dashboard numeric(12,2) not null default 0,
  saldo_auditoria numeric(12,2) not null default 0,
  diferencia_total numeric(12,2) not null default 0,
  tiene_diferencia boolean not null default false,
  detalle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_auditoria_diaria_bloque_fecha
  on public.auditoria_diaria (bloque_id, fecha_control);

create index if not exists idx_auditoria_diaria_bloque_created
  on public.auditoria_diaria (bloque_id, created_at desc);

alter table public.auditoria_diaria enable row level security;

drop policy if exists auditoria_diaria_admin_read on public.auditoria_diaria;
create policy auditoria_diaria_admin_read
on public.auditoria_diaria
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('admin', 'superadmin')
      and u.bloque_id = auditoria_diaria.bloque_id
      and u.activo = true
  )
);

drop policy if exists auditoria_diaria_service_all on public.auditoria_diaria;
create policy auditoria_diaria_service_all
on public.auditoria_diaria
for all
to service_role
using (true)
with check (true);
