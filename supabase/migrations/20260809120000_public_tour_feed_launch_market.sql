-- Keep the public Peek feed aligned with the launch-market policy. The
-- underlying country rows remain intact for a later multi-market release.
do $$
declare
  listing_definition text;
begin
  select pg_get_functiondef('public.public_tour_feed(text,text,text,timestamptz,uuid,integer)'::regprocedure)
    into listing_definition;

  if position('l.country_code' in listing_definition) = 0 then
    listing_definition := replace(
      listing_definition,
      'and l.status in (''available'', ''under_offer'')',
      E'and l.country_code = ''ZW''\n      and l.status in (''available'', ''under_offer'')'
    );
  end if;

  if position('service.country_code' in listing_definition) = 0 then
    listing_definition := replace(
      listing_definition,
      'and service.status = ''active''',
      E'and service.country_code = ''ZW''\n      and service.status = ''active'''
    );
  end if;

  execute listing_definition;
end
$$;
