// src/lib/noRealtimeClient.js
//
// Aliased over `@supabase/realtime-js` in vite.config.js.
//
// Realtime is disabled for this project (see the [realtime] section of
// supabase/config.toml) and no file in src/ ever calls `supabase.channel(...)`.
// @supabase/supabase-js's `createClient()` nonetheless constructs a
// RealtimeClient unconditionally, which pulls in the real package plus its
// bundled Phoenix websocket transport -- ~150 KB of dead weight in the
// initial bundle (measured; see docs/audit/AUDIT_SUMMARY.md, finding F-01).
//
// This stub implements only the surface SupabaseClient actually touches:
// `setAuth` is called on every auth state change, so it must be a real no-op.
// `channel` throws immediately so that wiring up realtime in the future fails
// loudly at the call site instead of silently doing nothing -- the fix is to
// remove this alias, not to work around the throw.
export class RealtimeClient {
  constructor() {}

  setAuth() {}

  getChannels() {
    return [];
  }

  channel() {
    throw new Error(
      'Realtime is stubbed out of this build (see the @supabase/realtime-js ' +
        'alias in vite.config.js). Remove that alias before calling supabase.channel().'
    );
  }

  removeChannel() {
    return Promise.resolve('ok');
  }

  removeAllChannels() {
    return Promise.resolve([]);
  }
}
