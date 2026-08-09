begin;

create index if not exists web_push_delivery_jobs_user_id_idx
  on public.web_push_delivery_jobs(user_id);

commit;
