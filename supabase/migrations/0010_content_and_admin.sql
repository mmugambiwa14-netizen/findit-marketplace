-- 0010_content_and_admin.sql
-- Replaces: Announcement, FAQ, EmailTemplate, Terms entities.

create table public.announcements (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  content             text not null,
  announcement_type   announcement_type not null,
  target_audience     announcement_audience not null default 'all',
  visibility_scope    announcement_visibility not null default 'current_only',
  status              announcement_status not null default 'draft',
  scheduled_for       timestamptz,
  published_at        timestamptz,
  expires_at          timestamptz,
  published_by        uuid references public.users(id),
  created_at          timestamptz not null default now()
);

create index idx_announcements_status on public.announcements(status);

create table public.faqs (
  id              uuid primary key default gen_random_uuid(),
  category        faq_category not null,
  question        text not null,
  answer          text not null,
  "order"         integer not null default 0,
  status          content_status not null default 'draft',
  views           integer not null default 0,
  helpful_count   integer not null default 0
);

create index idx_faqs_category on public.faqs(category, "order");

create table public.email_templates (
  id                     uuid primary key default gen_random_uuid(),
  template_key           text not null unique,
  name                   text not null,
  description            text,
  subject                text not null,
  body                   text not null,
  available_variables    jsonb not null default '[]',
  is_active              boolean not null default true
);

create table public.terms (
  id                 uuid primary key default gen_random_uuid(),
  section            terms_section not null,
  title              text not null,
  content            text not null,
  version            integer not null default 1,
  effective_date     date,
  status             content_status not null default 'draft',
  last_updated_by    uuid references public.users(id),
  created_at         timestamptz not null default now(),
  unique (section, version)
);
