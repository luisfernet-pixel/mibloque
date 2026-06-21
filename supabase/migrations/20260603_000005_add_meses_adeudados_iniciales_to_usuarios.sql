alter table public.usuarios
add column if not exists meses_adeudados_iniciales int not null default 0;

alter table public.usuarios
add constraint usuarios_meses_adeudados_iniciales_non_negative
check (meses_adeudados_iniciales >= 0);

