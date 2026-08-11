begin;

-- The three-argument resolver gives p_country_code a default, while a second
-- two-argument overload exposed the same call shape. PostgreSQL therefore
-- could not resolve ordinary two-argument calls. Remove only the redundant
-- wrapper: the optional third argument preserves both two- and three-argument
-- invocation behaviour without an ambiguous function catalogue.
drop function public.resolve_category_taxonomy(text, text);

revoke all on function public.resolve_category_taxonomy(text, text, text)
  from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text, text)
  to anon, authenticated;

do $verify$
begin
  if (
    select pronargdefaults
    from pg_proc
    where oid = 'public.resolve_category_taxonomy(text,text,text)'::regprocedure
  ) <> 1 then
    raise exception 'market-scoped taxonomy resolver must retain its optional country argument';
  end if;

  if to_regprocedure('public.resolve_category_taxonomy(text,text)') is not null then
    raise exception 'redundant two-argument taxonomy resolver still exists';
  end if;

  perform * from public.resolve_category_taxonomy('property', 'house_sale');
end;
$verify$;

commit;
