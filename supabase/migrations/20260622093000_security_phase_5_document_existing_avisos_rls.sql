-- Fase 5: documenta/reconcilia RLS existente para public.avisos.
-- No crea la tabla: refleja el estado observado en Supabase real.
-- TODO: evaluar en una fase futura si conviene exigir u.activo = true.

alter table public.avisos enable row level security;

drop policy if exists avisos_select_segun_rol on public.avisos;
create policy avisos_select_segun_rol
on public.avisos
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        u.rol = 'superadmin'::public.rol_usuario
        or u.bloque_id = avisos.bloque_id
      )
  )
);

drop policy if exists avisos_insert_admin on public.avisos;
create policy avisos_insert_admin
on public.avisos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        u.rol = 'superadmin'::public.rol_usuario
        or (
          u.rol = 'admin'::public.rol_usuario
          and u.bloque_id = avisos.bloque_id
        )
      )
  )
);

drop policy if exists avisos_update_admin on public.avisos;
create policy avisos_update_admin
on public.avisos
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        u.rol = 'superadmin'::public.rol_usuario
        or (
          u.rol = 'admin'::public.rol_usuario
          and u.bloque_id = avisos.bloque_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        u.rol = 'superadmin'::public.rol_usuario
        or (
          u.rol = 'admin'::public.rol_usuario
          and u.bloque_id = avisos.bloque_id
        )
      )
  )
);

drop policy if exists avisos_delete_admin on public.avisos;
create policy avisos_delete_admin
on public.avisos
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        u.rol = 'superadmin'::public.rol_usuario
        or (
          u.rol = 'admin'::public.rol_usuario
          and u.bloque_id = avisos.bloque_id
        )
      )
  )
);
