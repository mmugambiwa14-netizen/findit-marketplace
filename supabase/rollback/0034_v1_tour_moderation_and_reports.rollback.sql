update public.marketplace_feature_controls set enabled = false, updated_at = now()
where feature_key = 'tours';

do $$
begin
  if exists (select 1 from public.reports where tour_id is not null) then
    raise exception 'cannot rollback 0034 while Tour reports exist';
  end if;
end $$;

drop function if exists public.admin_tour_queue(text, integer, integer);
drop function if exists public.report_tour(uuid, text, text);
drop function if exists public.owner_retry_failed_tour(uuid);
drop function if exists public.owner_remove_tour(uuid);
drop function if exists public.admin_reject_tour(uuid, text);
drop function if exists public.admin_approve_tour(uuid, text);
drop function if exists public.promote_approved_tour(uuid);

drop index if exists public.idx_reports_service;
drop index if exists public.idx_reports_tour;
alter table public.reports
  drop constraint if exists reports_tour_parent_consistency,
  drop column if exists tour_reason,
  drop column if exists target_type,
  drop column if exists tour_id,
  drop column if exists service_id;

-- Restore the pre-0034 browser insert contract after Tour-only columns are gone.
grant insert on table public.reports to authenticated;
