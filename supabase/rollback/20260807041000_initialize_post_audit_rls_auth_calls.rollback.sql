begin;

-- Restore the exact pre-migration policy expressions. Authorization semantics
-- are unchanged, but this intentionally restores per-row auth.uid() evaluation.

alter policy business_applications_owner_read
on public.business_applications
using (user_id = auth.uid() or public.is_admin());

alter policy category_approvals_owner_read
on public.business_category_approvals
using (user_id = auth.uid() or public.is_admin());

alter policy managed_listing_requests_owner_read
on public.managed_listing_requests
using (requester_user_id = auth.uid() or public.is_admin());

alter policy business_application_responses_owner_read
on public.business_application_responses
using (user_id = auth.uid() or public.is_admin());

alter policy peek_request_fulfilments_owner_read
on public.peek_request_fulfilments
using (owner_id = auth.uid() or public.is_admin());

commit;
