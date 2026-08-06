begin;

create table if not exists public.disposable_email_domains (
  domain text primary key,
  added_at timestamptz not null default now()
);

comment on table public.disposable_email_domains is
  'Blocklist of disposable email domains enforced by the before-user-created auth hook.';

alter table public.disposable_email_domains enable row level security;
revoke all on public.disposable_email_domains from anon, authenticated;

insert into public.disposable_email_domains (domain) values
  ('0-mail.com'), ('10minutemail.com'), ('10minutemail.net'), ('20minutemail.com'),
  ('33mail.com'), ('anonbox.net'), ('byom.de'), ('chacuo.net'), ('dispostable.com'),
  ('discard.email'), ('emailondeck.com'), ('fakeinbox.com'), ('fakemail.net'),
  ('fakemailgenerator.com'), ('getairmail.com'), ('getnada.com'), ('guerrillamail.com'),
  ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamailblock.com'),
  ('harakirimail.com'), ('inboxbear.com'), ('inboxkitten.com'), ('jetable.org'),
  ('mailcatch.com'), ('maildrop.cc'), ('maileater.com'), ('mailinator.com'),
  ('mailinator.net'), ('mailnesia.com'), ('mailsac.com'), ('mailtemp.info'),
  ('mintemail.com'), ('mohmal.com'), ('moakt.com'), ('mytemp.email'), ('nada.email'),
  ('no-spam.ws'), ('nowmymail.com'), ('objectmail.com'), ('sharklasers.com'),
  ('spam4.me'), ('spamgourmet.com'), ('temp-mail.io'), ('temp-mail.org'),
  ('tempinbox.com'), ('tempmail.com'), ('tempmail.dev'), ('tempmail.net'),
  ('tempmailo.com'), ('tempr.email'), ('throwawaymail.com'), ('trashmail.com'),
  ('trashmail.de'), ('trashmail.net'), ('wegwerfmail.de'), ('yopmail.com'),
  ('yopmail.fr'), ('yopmail.net'), ('yovy.co'), ('yuurok.com')
on conflict (domain) do nothing;

create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  email_address text;
  email_domain text;
begin
  email_address := lower(btrim(coalesce(
    event #>> '{user,email}',
    event #>> '{record,email}',
    event #>> '{email}',
    ''
  )));

  if email_address = '' then
    return '{}'::jsonb;
  end if;

  email_domain := split_part(email_address, '@', 2);
  if email_domain = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'A valid email address is required.'
      )
    );
  end if;

  if exists (
    select 1
    from public.disposable_email_domains d
    where d.domain = email_domain
       or email_domain like '%.' || d.domain
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Disposable email addresses are not allowed. Use a permanent address.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$function$;

revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

commit;
