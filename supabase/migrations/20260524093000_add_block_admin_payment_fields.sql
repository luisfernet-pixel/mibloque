alter table public.bloques
add column if not exists pago_banco text,
add column if not exists pago_numero_cuenta text,
add column if not exists pago_qr_url text;
