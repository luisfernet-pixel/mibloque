alter table public.configuracion_bloque
add column if not exists saldo_inicial numeric;

update public.configuracion_bloque
set saldo_inicial = 0
where saldo_inicial is null;

alter table public.configuracion_bloque
alter column saldo_inicial set default 0,
alter column saldo_inicial set not null;
