-- Rollback capsule for 20260809160000_response_peek_publication_state_alignment.sql.
-- This intentionally restores the exact legacy predicates for migration rollback
-- verification; applying it reintroduces the defect repaired by the migration.

do $rollback$
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
        '(new.status <> ''ready'' or new.published_at is null)',
        'new.status <> ''published'''
      ),
      (
        'private.bind_response_peek(uuid,uuid[])',
        '(v_tour.status <> ''ready'' or v_tour.published_at is null)',
        'v_tour.status <> ''published'''
      ),
      (
        'private.response_peek_request_candidates(uuid)',
        '(v_tour.status <> ''ready'' or v_tour.published_at is null)',
        'v_tour.status <> ''published'''
      ),
      (
        'private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamptz,uuid,integer)',
        'response.status = ''ready'' and response.published_at is not null',
        'response.status = ''published'''
      ),
      (
        'private.my_peek_request_activity_page(timestamptz,uuid,integer)',
        'response.status = ''ready'' and response.published_at is not null',
        'response.status = ''published'''
      ),
      (
        'private.public_response_peek_metadata(uuid)',
        't.status = ''ready'' and t.published_at is not null',
        't.status = ''published'''
      ),
      (
        'private.seller_unbound_response_peeks()',
        't.status = ''ready'' and t.published_at is not null',
        't.status = ''published'''
      )
    ) as targets(signature, canonical_fragment, previous_fragment)
  loop
    select pg_get_functiondef(to_regprocedure(target.signature))
    into definition;

    if definition is null then
      raise exception '20260809160000 rollback required function is missing: %', target.signature;
    end if;

    occurrence_count :=
      (length(definition) - length(replace(definition, target.canonical_fragment, '')))
      / length(target.canonical_fragment);

    if occurrence_count <> 1 then
      raise exception
        '20260809160000 rollback expected exactly one canonical publication predicate in %, found %',
        target.signature,
        occurrence_count;
    end if;

    execute replace(definition, target.canonical_fragment, target.previous_fragment);
  end loop;
end;
$rollback$;

comment on function private.apply_pending_response_peek_binding() is
  'findit:20260805073000-trigger-boundary';
