create or replace function private.auto_publish_ready_tour(p_tour_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tour public.listing_tours%rowtype;
begin
  select * into v_tour
  from public.listing_tours
  where id = p_tour_id
  for update;

  if not found
     or v_tour.status <> 'ready'
     or v_tour.deleted_at is not null
     or v_tour.removed_at is not null
     or v_tour.moderation_status in ('rejected', 'removed') then
    return false;
  end if;

  if v_tour.moderation_status <> 'approved' then
    update public.listing_tours
    set moderation_status = 'approved',
        approved_at = coalesce(approved_at, now()),
        rejection_reason = null
    where id = p_tour_id;

    insert into public.listing_tour_events (
      tour_id, actor_type, event_type, previous_status, next_status, metadata
    ) values (
      p_tour_id, 'system', 'tour_auto_approved', 'ready', 'ready',
      jsonb_build_object('reason', 'processing_validation_passed')
    );
  end if;

  begin
    perform public.promote_approved_tour(p_tour_id);
    return true;
  exception
    when sqlstate '22023' then
      return false;
  end;
end;
$$;

revoke all on function private.auto_publish_ready_tour(uuid) from public, anon, authenticated;
grant execute on function private.auto_publish_ready_tour(uuid) to service_role;

create or replace function private.auto_publish_ready_tour_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ready'
     and old.status is distinct from new.status
     and new.deleted_at is null
     and new.removed_at is null
     and coalesce(new.moderation_status, 'pending') not in ('rejected', 'removed') then
    perform private.auto_publish_ready_tour(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.auto_publish_ready_tour_trigger() from public, anon, authenticated;

drop trigger if exists listing_tours_auto_publish_ready on public.listing_tours;
create trigger listing_tours_auto_publish_ready
after update of status, moderation_status on public.listing_tours
for each row execute function private.auto_publish_ready_tour_trigger();

create or replace function private.retry_parent_peek_publication_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tour_id uuid;
begin
  if tg_table_name = 'listings' then
    if new.status in ('available', 'under_offer')
       and new.content_suspended_at is null
       and (new.expires_at is null or new.expires_at > now()) then
      for v_tour_id in
        select id from public.listing_tours
        where listing_id = new.id
          and status = 'ready'
          and moderation_status = 'approved'
          and published_at is null
          and deleted_at is null
          and removed_at is null
      loop
        perform private.auto_publish_ready_tour(v_tour_id);
      end loop;
    end if;
  elsif tg_table_name = 'services' and new.status = 'active' then
    for v_tour_id in
      select id from public.listing_tours
      where service_id = new.id
        and status = 'ready'
        and moderation_status = 'approved'
        and published_at is null
        and deleted_at is null
        and removed_at is null
    loop
      perform private.auto_publish_ready_tour(v_tour_id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.retry_parent_peek_publication_trigger() from public, anon, authenticated;

drop trigger if exists listings_retry_peek_publication on public.listings;
create trigger listings_retry_peek_publication
after insert or update of status, content_suspended_at, expires_at on public.listings
for each row execute function private.retry_parent_peek_publication_trigger();

drop trigger if exists services_retry_peek_publication on public.services;
create trigger services_retry_peek_publication
after insert or update of status on public.services
for each row execute function private.retry_parent_peek_publication_trigger();

do $$
declare
  v_tour_id uuid;
begin
  for v_tour_id in
    select id from public.listing_tours
    where status = 'ready'
      and moderation_status = 'pending'
      and deleted_at is null
      and removed_at is null
  loop
    perform private.auto_publish_ready_tour(v_tour_id);
  end loop;
end;
$$;