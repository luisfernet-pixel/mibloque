alter table if exists public.bloques
  add column if not exists recibo_consecutivo bigint not null default 1;

alter table if exists public.pagos
  add column if not exists numero_recibo text;

create unique index if not exists idx_pagos_bloque_numero_recibo_unique
  on public.pagos (bloque_id, numero_recibo)
  where numero_recibo is not null;
