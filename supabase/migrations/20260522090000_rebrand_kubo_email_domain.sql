begin;

with params as (
  select '@' || concat(chr(109), chr(105), chr(98), chr(108), chr(111), chr(113), chr(117), chr(101), '.app') as old_domain
)
update public.usuarios u
set email = regexp_replace(u.email, p.old_domain || '$', '@kubo.app', 'i')
from params p
where u.email ~* (p.old_domain || '$');

with params as (
  select '@' || concat(chr(109), chr(105), chr(98), chr(108), chr(111), chr(113), chr(117), chr(101), '.app') as old_domain
)
update auth.users u
set
  email = regexp_replace(u.email, p.old_domain || '$', '@kubo.app', 'i'),
  raw_user_meta_data = case
    when raw_user_meta_data ? 'email' then
      jsonb_set(
        raw_user_meta_data,
        '{email}',
        to_jsonb(regexp_replace(coalesce(raw_user_meta_data->>'email', u.email), p.old_domain || '$', '@kubo.app', 'i')),
        true
      )
    else raw_user_meta_data
  end
from params p
where u.email ~* (p.old_domain || '$');

with params as (
  select '@' || concat(chr(109), chr(105), chr(98), chr(108), chr(111), chr(113), chr(117), chr(101), '.app') as old_domain
)
update auth.identities i
set
  provider_id = regexp_replace(i.provider_id, p.old_domain || '$', '@kubo.app', 'i'),
  identity_data = case
    when identity_data ? 'email' then
      jsonb_set(
        identity_data,
        '{email}',
        to_jsonb(regexp_replace(coalesce(identity_data->>'email', i.provider_id), p.old_domain || '$', '@kubo.app', 'i')),
        true
      )
    else identity_data
  end
from params p
where i.provider_id ~* (p.old_domain || '$')
  or (i.identity_data->>'email') ~* (p.old_domain || '$');

commit;
