-- Rollback capsule for 20260809180000_allow_referential_notification_detach.sql.

create or replace function public.protect_alert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() = old.user_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.type is distinct from old.type
    or new.event_type is distinct from old.event_type
    or new.source_key is distinct from old.source_key
    or new.link is distinct from old.link
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'notification content requires a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
