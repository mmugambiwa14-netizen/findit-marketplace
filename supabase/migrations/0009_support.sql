-- 0009_support.sql
-- Replaces: SupportTicket, SupportMessage, SupportAgent, SupportSetting,
-- TicketActivityLog, TicketAttachment, TicketTemplate entities.
-- Kept as Core Infrastructure per agreed plan; only the AI auto-triage step
-- (originally an InvokeLLM call inside Base44's createTicket function) is
-- replaced with a simple rule-based priority mapping in the service layer,
-- not in the schema -- this table looks identical to the original either way.

create table public.support_agents (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references public.users(id),
  name                      text not null,
  email                     text not null,
  role                      text,
  availability              text not null default 'available' check (availability in ('available', 'busy', 'offline')),
  max_concurrent_tickets    integer not null default 10
);

create table public.support_tickets (
  id                    uuid primary key default gen_random_uuid(),
  ticket_number         text not null unique,
  user_id               uuid not null references public.users(id),
  user_phone            text,
  user_type             ticket_user_type not null default 'individual',
  category              text not null,
  subcategory           text,
  priority              ticket_priority not null default 'medium',
  status                ticket_status not null default 'open',
  subject               text not null,
  description           text not null,
  listing_id            uuid references public.listings(id),
  listing_category      ticket_listing_category,
  related_order_id      text,
  assigned_to           uuid references public.support_agents(id),
  assigned_team         ticket_assigned_team,
  source                ticket_source not null default 'web',
  resolution_notes      text,
  resolved_at           timestamptz,
  closed_at             timestamptz,
  satisfaction_rating   integer check (satisfaction_rating between 1 and 5),
  satisfaction_comment  text,
  tags                  jsonb not null default '[]',
  fraud_type            ticket_fraud_type,
  dispute_type          ticket_dispute_type,
  risk_score            numeric(5,2),
  unread_count          integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_support_tickets_status_priority on public.support_tickets(status, priority);
create index idx_support_tickets_user on public.support_tickets(user_id);
create index idx_support_tickets_assigned on public.support_tickets(assigned_to);

create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function set_updated_at();

create table public.support_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets(id) on delete cascade,
  sender_id      uuid not null references public.users(id),
  sender_type    ticket_sender_type not null,
  message        text not null,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index idx_support_messages_ticket on public.support_messages(ticket_id, created_at);

create table public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.support_tickets(id) on delete cascade,
  message_id    uuid references public.support_messages(id) on delete cascade,
  filename      text not null,
  file_url      text not null,
  file_size     integer,
  file_type     text,
  uploaded_by   uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create index idx_ticket_attachments_ticket on public.ticket_attachments(ticket_id);

create table public.ticket_activity_log (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets(id) on delete cascade,
  actor_id       uuid references public.users(id),
  actor_type     ticket_actor_type not null,
  action         text not null,
  old_value      text,
  new_value      text,
  description    text,
  created_at     timestamptz not null default now()
);

create index idx_ticket_activity_log_ticket on public.ticket_activity_log(ticket_id, created_at);

create table public.ticket_templates (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid references public.admin_teams(id),
  title          text not null,
  content        text not null,
  category       text,
  is_active      boolean not null default true,
  usage_count    integer not null default 0
);

create table public.support_settings (
  key                       text primary key,
  kind                      support_setting_kind not null default 'settings',
  sla_hours                 integer,
  auto_close_days           integer,
  support_email             text,
  escalation_email          text,
  auto_response_enabled     boolean not null default false,
  template_subject          text,
  template_body             text,
  template_variables        jsonb not null default '[]'
);
