-- Fase 2C-2: RLS para buzon_sugerencias.
-- No modifica datos. No toca otras tablas.

alter table public.buzon_sugerencias enable row level security;

drop policy if exists buzon_sugerencias_superadmin_all on public.buzon_sugerencias;
create policy buzon_sugerencias_superadmin_all
on public.buzon_sugerencias
for all
to authenticated
using (
  public.kubo_is_superadmin()
)
with check (
  public.kubo_is_superadmin()
);

drop policy if exists buzon_sugerencias_admin_select_by_block on public.buzon_sugerencias;
create policy buzon_sugerencias_admin_select_by_block
on public.buzon_sugerencias
for select
to authenticated
using (
  bloque_id is not null
  and public.kubo_is_admin_for_block(bloque_id)
);

drop policy if exists buzon_sugerencias_admin_update_by_block on public.buzon_sugerencias;
create policy buzon_sugerencias_admin_update_by_block
on public.buzon_sugerencias
for update
to authenticated
using (
  bloque_id is not null
  and public.kubo_is_admin_for_block(bloque_id)
)
with check (
  bloque_id is not null
  and public.kubo_is_admin_for_block(bloque_id)
);

drop policy if exists buzon_sugerencias_admin_delete_by_block on public.buzon_sugerencias;
create policy buzon_sugerencias_admin_delete_by_block
on public.buzon_sugerencias
for delete
to authenticated
using (
  bloque_id is not null
  and public.kubo_is_admin_for_block(bloque_id)
);

drop policy if exists buzon_sugerencias_vecino_select_own on public.buzon_sugerencias;
create policy buzon_sugerencias_vecino_select_own
on public.buzon_sugerencias
for select
to authenticated
using (
  vecino_id = (select auth.uid())
  and exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.activo = true
      and u.rol = 'vecino'::public.rol_usuario
      and u.bloque_id = buzon_sugerencias.bloque_id
      and u.departamento_id = buzon_sugerencias.departamento_id
  )
);

drop policy if exists buzon_sugerencias_vecino_insert_own on public.buzon_sugerencias;
create policy buzon_sugerencias_vecino_insert_own
on public.buzon_sugerencias
for insert
to authenticated
with check (
  vecino_id = (select auth.uid())
  and exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.activo = true
      and u.rol = 'vecino'::public.rol_usuario
      and u.bloque_id = buzon_sugerencias.bloque_id
      and u.departamento_id = buzon_sugerencias.departamento_id
  )
);
