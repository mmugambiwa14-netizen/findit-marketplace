import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Behavioural test runner.
//
// This is deliberately separate from `npm run test:contracts` (node --test over
// tests/*.test.mjs). Those contract tests read source files as text and assert
// on their contents; they cannot observe runtime behaviour. The suites under
// tests/behaviour/ import the real modules and render the real components, so a
// regression that leaves the source text intact still fails here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@supabase/realtime-js': fileURLToPath(
        new URL('./src/lib/noRealtimeClient.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/behaviour/setup.js'],
    include: ['tests/behaviour/**/*.test.{js,jsx}'],
    // The contract suite owns tests/*.test.mjs and runs under node --test.
    exclude: ['node_modules/**', 'dist/**', 'tests/*.test.mjs'],
    restoreMocks: true,
    clearMocks: true,
    // supabaseClient.js fails closed when these are absent, which is the
    // production behaviour we want everywhere except the test process itself.
    env: {
      VITE_SUPABASE_URL: 'https://behaviour-tests.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_behaviour_tests',
    },
  },
});
