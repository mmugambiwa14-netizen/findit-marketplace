begin;

create or replace function public.is_safe_notification_link(p_link text)
returns boolean
language sql
immutable
set search_path = 'public'
as $$
  select p_link is null or (
    length(p_link) between 1 and 200
    and (
      p_link in ('/my-listings', '/profile', '/settings', '/chats', '/saved', '/post')
      or p_link ~ '^/(property|car|machinery|service|chats|messages)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  );
$$;

commit;
