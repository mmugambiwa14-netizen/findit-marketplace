-- Preserve notification immutability while permitting PostgreSQL's nested
-- ON DELETE SET NULL action to detach a deleted listing. A direct user update
-- runs at trigger depth 1 and remains forbidden.

create or replace function public.protect_alert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  protected_content_changed boolean;
  nested_listing_detach_only boolean;
begin
  protected_content_changed :=
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.type is distinct from old.type
    or new.event_type is distinct from old.event_type
    or new.source_key is distinct from old.source_key
    or new.link is distinct from old.link
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at;

  nested_listing_detach_only :=
    pg_trigger_depth() > 1
    and old.listing_id is not null
    and new.listing_id is null
    and new.id is not distinct from old.id
    and new.user_id is not distinct from old.user_id
    and new.title is not distinct from old.title
    and new.message is not distinct from old.message
    and new.type is not distinct from old.type
    and new.event_type is not distinct from old.event_type
    and new.source_key is not distinct from old.source_key
    and new.link is not distinct from old.link
    and new.created_at is not distinct from old.created_at;

  if auth.uid() = old.user_id
     and not public.is_admin()
     and protected_content_changed
     and not nested_listing_detach_only then
    raise exception 'notification content requires a trusted operation'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function public.protect_alert_fields() is
  'Protects immutable notification content while allowing nested FK detachment when a listing is deleted.';
