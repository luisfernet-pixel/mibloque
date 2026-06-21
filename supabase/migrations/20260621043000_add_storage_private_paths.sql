-- Fase 2B-1: columnas de path para migrar Storage publico a acceso protegido.
-- No cambia buckets ni policies de Storage.

alter table public.confirmaciones_pago
  add column if not exists comprobante_path text;

alter table public.gastos
  add column if not exists comprobante_path text;

alter table public.pagos
  add column if not exists comprobante_path text;

alter table public.bloques
  add column if not exists pago_qr_path text;
