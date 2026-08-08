begin;

-- Keep notification navigation same-origin and route-bounded while allowing the
-- active Peek Request journeys emitted by create_peek_request and Response Peek
-- binding. No arbitrary query strings or fragments are accepted.
create or replace function public.is_safe_notification_link(p_link text)
returns boolean
language sql
immutable
set search_path = 'public'
as $$
  select p_link is null or (
    length(p_link) between 1 and 200
    and (
      p_link in ('/my-listings', '/profile', '/settings', '/chats', '/saved', '/post', '/peek-requests')
      or p_link ~ '^/peek-requests\?request=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or p_link ~ '^/(chats|messages)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or p_link ~ '^/(property|car|machinery|service)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\?responsePeek=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?(#peek-threads)?$'
    )
  );
$$;

comment on function public.is_safe_notification_link(text) is
  'Allows only bounded same-origin PeekaListing notification destinations, including Peek Request and Response Peek deep links.';

commit;
