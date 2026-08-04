-- Keep internal trigger and upload-authorisation functions out of the public RPC surface.
revoke execute on function public.apply_pending_response_peek_binding() from public, anon, authenticated;

revoke execute on function public.authorize_response_peek_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) from public, anon, authenticated;
grant execute on function public.authorize_response_peek_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) to service_role;

-- Seller-facing response actions require a signed-in session but never anonymous access.
revoke execute on function public.bind_response_peek(uuid, uuid[]) from public, anon;
grant execute on function public.bind_response_peek(uuid, uuid[]) to authenticated;

revoke execute on function public.queue_response_peek_binding(uuid, uuid) from public, anon;
grant execute on function public.queue_response_peek_binding(uuid, uuid) to authenticated;
