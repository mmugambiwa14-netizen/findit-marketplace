import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { join, relative } from 'node:path'

function copyFirstPartyPublicAssets() {
  const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      if (statSync(absolutePath).isDirectory()) visit(absolutePath);
      else files.push(absolutePath);
    }
  };

  return {
    name: 'copy-first-party-public-assets',
    apply: 'build',
    generateBundle() {
      visit(publicRoot);
      files.forEach((absolutePath) => {
        this.emitFile({
          type: 'asset',
          fileName: relative(publicRoot, absolutePath).replaceAll('\\', '/'),
          source: readFileSync(absolutePath),
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  // GitHub Pages serves the staging build beneath the repository name. Keep
  // local and custom-domain builds rooted at "/" unless a deploy explicitly
  // supplies VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/',
  // Preview-only media stays outside production. The build plugin below copies
  // only first-party runtime assets from public/ into the hosted artifact.
  publicDir: command === 'serve' || mode === 'preview' ? 'public' : false,
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Realtime is disabled (supabase/config.toml [realtime]) and unused
      // (no `.channel()` call anywhere in src/), but createClient() always
      // instantiates a RealtimeClient. Alias it to a stub that keeps the
      // methods SupabaseClient actually calls and throws if `.channel()` is
      // ever invoked for real. See src/lib/noRealtimeClient.js.
      '@supabase/realtime-js': fileURLToPath(new URL('./src/lib/noRealtimeClient.js', import.meta.url)),
    },
  },
  // Note: splitting node_modules into a separate vendor chunk was measured and
  // deliberately rejected. It shrinks the entry chunk but breaks scope-hoisting
  // between application and vendor code, taking the initial payload from
  // 589 KB raw / 173 KB gzip to 752 KB / 218 KB -- worse for every first-time
  // visitor. Reducing what the shell imports is the real fix, not re-chunking.
  plugins: [
    react(),
    copyFirstPartyPublicAssets(),
  ]
}));
