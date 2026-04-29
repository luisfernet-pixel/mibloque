-- Optimiza RLS para evitar re-evaluar auth.uid() por fila.
-- Mantiene la misma lógica de acceso, solo cambia auth.uid() -> (select auth.uid()).

do $$
declare
  p record;
  v_qual text;
  v_with_check text;
  v_stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'departamentos',
        'cuotas',
        'pagos',
        'gastos',
        'avisos',
        'configuracion_bloque',
        'confirmaciones_pago'
      )
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    v_qual := case
      when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(select auth.uid())')
    end;

    v_with_check := case
      when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    v_stmt := format(
      'alter policy %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );

    if v_qual is not null then
      v_stmt := v_stmt || format(' using (%s)', v_qual);
    end if;

    if v_with_check is not null then
      v_stmt := v_stmt || format(' with check (%s)', v_with_check);
    end if;

    execute v_stmt;
  end loop;
end
$$;
