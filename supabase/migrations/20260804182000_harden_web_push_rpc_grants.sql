revoke all on function public.register_web_push_subscription(text,text,text,text,text) from public, anon;
revoke all on function public.disable_web_push_subscription(text) from public, anon;
revoke all on function public.enqueue_web_push_for_alert() from public, anon, authenticated;

grant execute on function public.register_web_push_subscription(text,text,text,text,text) to authenticated;
grant execute on function public.disable_web_push_subscription(text) to authenticated;
