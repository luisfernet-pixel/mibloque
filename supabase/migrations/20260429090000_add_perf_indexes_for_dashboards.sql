-- Indices de performance para consultas frecuentes en paneles admin/vecino/superadmin.
-- Todos son "if not exists" para mantener la migracion idempotente.

create index if not exists idx_avisos_bloque_publicado_created
  on public.avisos (bloque_id, publicado, created_at desc);

create index if not exists idx_confirmaciones_bloque_estado_created
  on public.confirmaciones_pago (bloque_id, estado, created_at desc);

create index if not exists idx_confirmaciones_depto_estado_created
  on public.confirmaciones_pago (departamento_id, estado, created_at desc);

create index if not exists idx_confirmaciones_cuota_depto_estado_revisado
  on public.confirmaciones_pago (cuota_id, departamento_id, estado, revisado_at desc);

create index if not exists idx_cuotas_depto_estado_anio_mes
  on public.cuotas (departamento_id, estado, anio, mes);

create index if not exists idx_cuotas_bloque_periodo
  on public.cuotas (bloque_id, periodo desc);

create index if not exists idx_cuotas_bloque_created
  on public.cuotas (bloque_id, created_at desc);

create index if not exists idx_departamentos_bloque_numero
  on public.departamentos (bloque_id, numero);

create index if not exists idx_gastos_bloque_fecha
  on public.gastos (bloque_id, fecha_gasto desc);

create index if not exists idx_notif_bloque_depto_leida_tipo_created
  on public.notificaciones_vecino (bloque_id, departamento_id, leida, tipo, created_at desc);

create index if not exists idx_pagos_bloque_fecha
  on public.pagos (bloque_id, fecha_pago desc);

create index if not exists idx_pagos_depto_fecha
  on public.pagos (departamento_id, fecha_pago desc);

create index if not exists idx_usuarios_rol_created
  on public.usuarios (rol, created_at desc);

create index if not exists idx_usuarios_bloque_rol_created
  on public.usuarios (bloque_id, rol, created_at desc);

create index if not exists idx_usuarios_bloque_depto_rol_activo
  on public.usuarios (bloque_id, departamento_id, rol, activo);

create index if not exists idx_buzon_vecino_estado_respuesta_leida
  on public.buzon_sugerencias (vecino_id, estado, respuesta_leida);

create index if not exists idx_buzon_bloque_visto_admin_estado_created
  on public.buzon_sugerencias (bloque_id, visto_admin, estado, created_at desc);
