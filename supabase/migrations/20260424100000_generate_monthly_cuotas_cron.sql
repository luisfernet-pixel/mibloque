-- Generacion automatica de cuotas mensuales (confiable e idempotente)
-- - Evita duplicados por bloque/departamento/anio/mes
-- - Corre diariamente a las 00:10 hora Bolivia (04:10 UTC)
-- - Si un dia falla, al siguiente se recupera sola

-- 1) Limpieza preventiva de duplicados historicos (si existieran)
with ranked as (
  select
    ctid,
    row_number() over (
      partition by bloque_id, departamento_id, anio, mes
      order by created_at nulls last, id
    ) as rn
  from public.cuotas
)
delete from public.cuotas q
using ranked r
where q.ctid = r.ctid
  and r.rn > 1;

-- 2) Restriccion unica para blindar duplicados futuros
create unique index if not exists cuotas_bloque_depto_anio_mes_uidx
  on public.cuotas (bloque_id, departamento_id, anio, mes);

-- 3) Funcion que crea cuotas del mes objetivo
create or replace function public.generate_monthly_cuotas(
  p_target_date date default ((now() at time zone 'America/La_Paz')::date)
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from p_target_date)::int;
  v_month int := extract(month from p_target_date)::int;
  v_periodo text := to_char(p_target_date, 'YYYY-MM');
  v_inserted int := 0;
begin
  insert into public.cuotas (
    bloque_id,
    departamento_id,
    anio,
    mes,
    periodo,
    monto_base,
    mora_acumulada,
    monto_total,
    fecha_vencimiento,
    estado,
    created_at,
    updated_at
  )
  select
    d.bloque_id,
    d.id,
    v_year,
    v_month,
    v_periodo,
    coalesce(cfg.cuota_mensual, 0),
    coalesce(cfg.valor_mora, 0),
    coalesce(cfg.cuota_mensual, 0),
    make_date(
      v_year,
      v_month,
      least(greatest(coalesce(cfg.dia_vencimiento, 15), 1), 28)
    ),
    'pendiente',
    now(),
    now()
  from public.departamentos d
  left join public.configuracion_bloque cfg
    on cfg.bloque_id = d.bloque_id
  where coalesce(d.activo, true) = true
  on conflict (bloque_id, departamento_id, anio, mes) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.generate_monthly_cuotas(date) is
  'Genera cuotas del mes objetivo para todos los departamentos activos. Idempotente por bloque/departamento/anio/mes.';

-- 4) Ejecuta una vez para asegurar que el mes actual exista desde ya
select public.generate_monthly_cuotas();

-- 5) Agenda en pg_cron (si la extension esta disponible)
do $cron$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege then
      raise notice 'No se pudo crear pg_cron por permisos. Activalo en el proyecto Supabase.';
  end;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'generate-monthly-cuotas') then
      perform cron.unschedule(
        (select jobid from cron.job where jobname = 'generate-monthly-cuotas' limit 1)
      );
    end if;

    -- 04:10 UTC = 00:10 America/La_Paz
    perform cron.schedule(
      'generate-monthly-cuotas',
      '10 4 * * *',
      $$select public.generate_monthly_cuotas();$$
    );
  end if;
end
$cron$;
