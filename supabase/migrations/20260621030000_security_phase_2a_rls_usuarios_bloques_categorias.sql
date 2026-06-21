-- Fase 2A: RLS para usuarios, bloques y categorias_gasto.
-- Documenta los cambios aplicados manualmente y probados en Supabase.

create or replace function public.kubo_auth_role()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select u.rol
  from public.usuarios u
  where u.id = (select auth.uid())
    and u.activo = true
  limit 1
$$;

create or replace function public.kubo_auth_bloque_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.bloque_id
  from public.usuarios u
  where u.id = (select auth.uid())
    and u.activo = true
  limit 1
$$;

create or replace function public.kubo_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.kubo_auth_role() = 'superadmin'::public.rol_usuario, false)
$$;

create or replace function public.kubo_is_admin_for_block(target_bloque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.kubo_auth_role() = 'admin'::public.rol_usuario
    and public.kubo_auth_bloque_id() = target_bloque_id,
    false
  )
$$;

create or replace function public.kubo_is_admin_or_superadmin_for_block(target_bloque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.kubo_is_superadmin()
    or public.kubo_is_admin_for_block(target_bloque_id),
    false
  )
$$;

alter table public.usuarios enable row level security;

drop policy if exists usuarios_select_own on public.usuarios;
create policy usuarios_select_own
on public.usuarios
for select
to authenticated
using (
  id = (select auth.uid())
);

drop policy if exists usuarios_select_admin_same_block on public.usuarios;
create policy usuarios_select_admin_same_block
on public.usuarios
for select
to authenticated
using (
  public.kubo_is_admin_for_block(bloque_id)
);

drop policy if exists usuarios_superadmin_all on public.usuarios;
create policy usuarios_superadmin_all
on public.usuarios
for all
to authenticated
using (
  public.kubo_is_superadmin()
)
with check (
  public.kubo_is_superadmin()
);

drop policy if exists usuarios_admin_update_vecinos_same_block on public.usuarios;
create policy usuarios_admin_update_vecinos_same_block
on public.usuarios
for update
to authenticated
using (
  rol = 'vecino'::public.rol_usuario
  and public.kubo_is_admin_for_block(bloque_id)
)
with check (
  rol = 'vecino'::public.rol_usuario
  and public.kubo_is_admin_for_block(bloque_id)
);

alter table public.bloques enable row level security;

drop policy if exists bloques_select_own_or_superadmin on public.bloques;
create policy bloques_select_own_or_superadmin
on public.bloques
for select
to authenticated
using (
  public.kubo_is_superadmin()
  or id = public.kubo_auth_bloque_id()
);

drop policy if exists bloques_superadmin_all on public.bloques;
create policy bloques_superadmin_all
on public.bloques
for all
to authenticated
using (
  public.kubo_is_superadmin()
)
with check (
  public.kubo_is_superadmin()
);

alter table public.categorias_gasto enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categorias_gasto'
  loop
    execute format('drop policy if exists %I on public.categorias_gasto', p.policyname);
  end loop;
end
$$;

create policy categorias_gasto_select_by_block
on public.categorias_gasto
for select
to authenticated
using (
  public.kubo_is_superadmin()
  or (
    bloque_id is not null
    and public.kubo_is_admin_for_block(bloque_id)
  )
);

create policy categorias_gasto_insert_by_block
on public.categorias_gasto
for insert
to authenticated
with check (
  public.kubo_is_superadmin()
  or (
    bloque_id is not null
    and public.kubo_is_admin_for_block(bloque_id)
  )
);

create policy categorias_gasto_update_by_block
on public.categorias_gasto
for update
to authenticated
using (
  public.kubo_is_superadmin()
  or (
    bloque_id is not null
    and public.kubo_is_admin_for_block(bloque_id)
  )
)
with check (
  public.kubo_is_superadmin()
  or (
    bloque_id is not null
    and public.kubo_is_admin_for_block(bloque_id)
  )
);

create policy categorias_gasto_delete_by_block
on public.categorias_gasto
for delete
to authenticated
using (
  public.kubo_is_superadmin()
  or (
    bloque_id is not null
    and public.kubo_is_admin_for_block(bloque_id)
  )
);
