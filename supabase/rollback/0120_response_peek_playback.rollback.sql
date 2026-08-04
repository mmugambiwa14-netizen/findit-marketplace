-- Roll back 0120_response_peek_playback.sql

drop function if exists public.public_response_peek_metadata(uuid);
