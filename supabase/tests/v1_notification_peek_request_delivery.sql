begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  public.is_safe_notification_link('/peek-requests'),
  'seller Peek Request notifications retain the workspace route'
);

select extensions.ok(
  public.is_safe_notification_link('/peek-requests?request=11111111-1111-4111-8111-111111111111'),
  'request-scoped seller notification deep links are accepted'
);

select extensions.ok(
  public.is_safe_notification_link('/property/11111111-1111-4111-8111-111111111111?responsePeek=22222222-2222-4222-8222-222222222222#peek-threads'),
  'buyer Response Peek notification deep links are accepted'
);

select extensions.ok(
  public.is_safe_notification_link('/service/11111111-1111-4111-8111-111111111111#peek-threads'),
  'safe Peek Request fragments remain valid on a canonical detail route'
);

select extensions.ok(
  not public.is_safe_notification_link('https://example.test/peek-requests'),
  'external notification destinations remain rejected'
);

select extensions.ok(
  not public.is_safe_notification_link('/peek-requests?redirect=https://example.test'),
  'arbitrary Peek Request query strings remain rejected'
);

select extensions.ok(
  not public.is_safe_notification_link('/property/11111111-1111-4111-8111-111111111111?responsePeek=not-a-uuid#peek-threads'),
  'malformed Response Peek identities remain rejected'
);

select * from extensions.finish();
rollback;
