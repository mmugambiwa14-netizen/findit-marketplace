-- 0112_business_profile_url_scheme_constraint.sql
--
-- public.business_profiles.website and .social_links are rendered into anchor
-- href attributes on the public business profile page. They were validated
-- only by src/services/businessProfileContracts.js, which runs in the browser
-- and is therefore UX rather than enforcement -- a user calling PostgREST
-- directly with their own key could store `javascript:...` in either column.
-- React 18 warns about a `javascript:` href but still renders it, leaving the
-- link clickable, which makes this a stored XSS vector.
--
-- The render-time guard added in src/lib/safeUrl.js is the reliable boundary,
-- because it also covers rows written before this constraint existed. This
-- constraint is the server-side half: it stops such a value being stored at
-- all, by any client.
--
-- Note: a CHECK constraint may not contain a subquery, so the jsonb values are
-- validated through an IMMUTABLE helper rather than an inline EXISTS.

create or replace function public.jsonb_values_are_http_urls(p_value jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select case
    when p_value is null then true
    when jsonb_typeof(p_value) <> 'object' then false
    else not exists (
      select 1
      from jsonb_each_text(p_value) as link(key, value)
      where coalesce(value, '') <> ''
        and value !~* '^https?://[^[:space:]]+$'
    )
  end;
$function$;

alter table public.business_profiles
  drop constraint if exists business_profiles_website_scheme;

alter table public.business_profiles
  add constraint business_profiles_website_scheme
  check (
    website is null
    or website = ''
    or website ~* '^https?://[^[:space:]]+$'
  );

alter table public.business_profiles
  drop constraint if exists business_profiles_social_links_scheme;

alter table public.business_profiles
  add constraint business_profiles_social_links_scheme
  check (public.jsonb_values_are_http_urls(social_links));
