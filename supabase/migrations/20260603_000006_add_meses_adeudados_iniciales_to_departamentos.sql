alter table public.departamentos
  add column if not exists meses_adeudados_iniciales integer not null default 0;

alter table public.departamentos
  drop constraint if exists departamentos_meses_adeudados_iniciales_check;

alter table public.departamentos
  add constraint departamentos_meses_adeudados_iniciales_check
  check (meses_adeudados_iniciales >= 0);

update public.departamentos d
set meses_adeudados_iniciales = u.meses_adeudados_iniciales
from public.usuarios u
where u.departamento_id = d.id
  and u.rol = 'vecino'
  and coalesce(u.meses_adeudados_iniciales, 0) > 0
  and d.meses_adeudados_iniciales = 0;