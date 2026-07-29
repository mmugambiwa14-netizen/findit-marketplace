-- Non-destructive rollback capsule for 0074.
-- Disable nearby recommendations without guessing the prior operator-selected
-- timeout or weakening the global timeout ceiling.

update public.recommendation_service_policies
set enabled = false, updated_at = now()
where service_name = 'nearby_service';
