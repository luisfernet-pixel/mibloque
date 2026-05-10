create table if not exists public.gastos_cierres_mensuales (
  id uuid primary key default gen_random_uuid(),
  bloque_id uuid not null references public.bloques(id) on delete cascade,
  anio integer not null check (anio >= 2000),
  mes integer not null check (mes between 1 and 12),
  created_at timestamptz not null default timezone('utc', now()),
  unique (bloque_id, anio, mes)
);

alter table public.gastos_cierres_mensuales enable row level security;

drop policy if exists gastos_cierres_mensuales_admin_all on public.gastos_cierres_mensuales;
create policy gastos_cierres_mensuales_admin_all
on public.gastos_cierres_mensuales
for all
using (exists (
  select 1
  from public.usuarios u
  where u.id = auth.uid()
    and u.rol in ('admin', 'superadmin')
    and u.bloque_id = gastos_cierres_mensuales.bloque_id
))
with check (exists (
  select 1
  from public.usuarios u
  where u.id = auth.uid()
    and u.rol in ('admin', 'superadmin')
    and u.bloque_id = gastos_cierres_mensuales.bloque_id
));

create index if not exists idx_gastos_cierres_bloque_anio_mes
  on public.gastos_cierres_mensuales (bloque_id, anio, mes);
