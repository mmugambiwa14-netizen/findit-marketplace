-- Align every Response Peek reader/binder with the canonical Tour lifecycle.
-- A published Tour remains in `ready`; publication is represented by a non-null
-- `published_at`. The legacy `status = 'published'` checks could never succeed
-- because `published` is not a valid listing_tours status.

do $migration$
declare
  target record;
  definition text;
  occurrence_count integer;
begin
  for target in
    select *
    from (values
      (
        'private.apply_pending_response_peek_binding()',
        'new.status <> ''published''',
        '(new.status <> ''ready'' or new.published_at is null)'
      ),
      (
        'private.bind_response_peek(uuid,uuid[])',
        'v_tour.status <> ''published''',
        '(v_tour.status <> ''ready'' or v_tour.published_at is null)'
      ),
      (
        'private.response_peek_request_candidates(uuid)',
        'v_tour.status <> ''published''',
        '(v_tour.status <> ''ready'' or v_tour.published_at is null)'
      ),
      (
        'private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamptz,uuid,integer)',
        'response.status = ''published''',
        'response.status = ''ready'' and response.published_at is not null'
      ),
      (
        'private.my_peek_request_activity_page(timestamptz,uuid,integer)',
        'response.status = ''published''',
        'response.status = ''ready'' and response.published_at is not null'
      ),
      (
        'private.public_response_peek_metadata(uuid)',
        't.status = ''published''',
        't.status = ''ready'' and t.published_at is not null'
      ),
      (
        'private.seller_unbound_response_peeks()',
        't.status = ''published''',
        't.status = ''ready'' and t.published_at is not null'
      )
    ) as targets(signature, previous_fragment, canonical_fragment)
  loop
    select pg_get_functiondef(to_regprocedure(target.signature))
    into definition;

    if definition is null then
      raise exception '20260809160000 required function is missing: %', target.signature;
    end if;

    occurrence_count :=
      (length(definition) - length(replace(definition, target.previous_fragment, '')))
      / length(target.previous_fragment);

    if occurrence_count <> 1 then
      raise exception
        '20260809160000 expected exactly one legacy publication predicate in %, found %',
        target.signature,
        occurrence_count;
    end if;

    execute replace(definition, target.previous_fragment, target.canonical_fragment);
  end loop;
end;
$migration$;

comment on function private.apply_pending_response_peek_binding() is
  'findit:20260805073000-trigger-boundary';
comment on function private.bind_response_peek(uuid, uuid[]) is
  'Binds a ready, published, approved Response Peek to one or more compatible requests.';
comment on function private.public_response_peek_metadata(uuid) is
  'Returns metadata only for a ready, published, approved Response Peek bound to an answered request.';
