-- 0112_business_profile_url_scheme_constraint.rollback.sql
--
-- WARNING: removes the server-side scheme check on business profile links,
-- allowing `javascript:` and `data:` URLs to be stored again. The render-time
-- guard in src/lib/safeUrl.js still refuses to render them, so this alone does
-- not reopen the stored XSS -- but it does let hostile values back into the
-- table, where any future consumer that skips the guard would be exposed.

alter table public.business_profiles
  drop constraint if exists business_profiles_social_links_scheme;

alter table public.business_profiles
  drop constraint if exists business_profiles_website_scheme;

drop function if exists public.jsonb_values_are_http_urls(jsonb);
