-- Unifica politicas SELECT permisivas duplicadas en confirmaciones_pago
-- para reducir costo de evaluacion RLS sin cambiar acceso efectivo.

drop policy if exists admin_select_confirmaciones_pago on public.confirmaciones_pago;
drop policy if exists vecino_select_confirmaciones_pago on public.confirmaciones_pago;

create policy confirmaciones_select_admin_o_vecino
on public.confirmaciones_pago
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and (
        (
          u.rol = 'superadmin'::rol_usuario
          or (u.rol = 'admin'::rol_usuario and u.bloque_id = confirmaciones_pago.bloque_id)
        )
        or (
          u.rol = 'vecino'::rol_usuario
          and u.departamento_id = confirmaciones_pago.departamento_id
        )
      )
  )
);
