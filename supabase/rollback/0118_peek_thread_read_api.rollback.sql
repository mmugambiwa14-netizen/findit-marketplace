-- Roll back the phase 3 public read function only. Phase 1 data remains intact.
drop function if exists public.peek_thread_page(
  uuid, uuid, text, text, integer, timestamptz, uuid, integer
);
