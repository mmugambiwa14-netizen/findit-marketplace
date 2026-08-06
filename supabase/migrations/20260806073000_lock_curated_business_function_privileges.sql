begin;

revoke all on function public.get_my_publishing_access() from anon, authenticated;
revoke all on function public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[]) from anon, authenticated;
revoke all on function public.submit_managed_listing_request(text,text,text,text,text,text,text,text) from anon, authenticated;
revoke all on function public.can_publish_in_category(text) from anon, authenticated;
revoke all on function public.admin_list_business_applications(text,integer,timestamptz) from anon, authenticated;
revoke all on function public.admin_review_business_application(uuid,text,text) from anon, authenticated;
revoke all on function public.admin_review_business_category(uuid,text,text) from anon, authenticated;
revoke all on function public.admin_list_managed_listing_requests(text,integer,timestamptz) from anon, authenticated;
revoke all on function public.admin_update_managed_listing_request(uuid,text,text,uuid) from anon, authenticated;
revoke all on function public.respond_to_business_application(uuid,text) from anon, authenticated;
revoke all on function public.request_additional_business_categories(text[]) from anon, authenticated;
revoke all on function public.get_my_managed_listing_requests() from anon, authenticated;
revoke all on function public.enforce_curated_listing_publisher() from anon, authenticated;
revoke all on function public.enforce_curated_service_publisher() from anon, authenticated;

grant execute on function public.get_my_publishing_access() to authenticated;
grant execute on function public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[]) to authenticated;
grant execute on function public.submit_managed_listing_request(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.can_publish_in_category(text) to authenticated;
grant execute on function public.admin_list_business_applications(text,integer,timestamptz) to authenticated;
grant execute on function public.admin_review_business_application(uuid,text,text) to authenticated;
grant execute on function public.admin_review_business_category(uuid,text,text) to authenticated;
grant execute on function public.admin_list_managed_listing_requests(text,integer,timestamptz) to authenticated;
grant execute on function public.admin_update_managed_listing_request(uuid,text,text,uuid) to authenticated;
grant execute on function public.respond_to_business_application(uuid,text) to authenticated;
grant execute on function public.request_additional_business_categories(text[]) to authenticated;
grant execute on function public.get_my_managed_listing_requests() to authenticated;

commit;
