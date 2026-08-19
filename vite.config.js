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
  // Cloudflare Pages and the custom domain are rooted at "/" unless a deploy
  // explicitly supplies VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/',
  // Preview-only media stays outside production. The build plugin below copies
  // only first-party runtime assets from public/ into the hosted artifact.
  publicDir: command === 'serve' || mode === 'preview' ? 'public' : false,
  logLevel: 'error', // Suppress warnings, only show errors
  // Source maps reconstruct original source from the shipped bundle. Vite
  // already defaults this to false; it is stated explicitly so the intent
  // survives a config edit, and scripts/verify-bundle-secrets.mjs fails the
  // build if a .map ever reaches dist/.
  build: { sourcemap: false },
  esbuild: {
    // `debugger` is dropped outright. console.log/info/debug are marked pure so
    // they are eliminated when their result is unused -- there are currently
    // none in src/, so this is a forward guard rather than a cleanup.
    //
    // console.error and console.warn are deliberately NOT dropped: the four
    // console.error call sites (AppErrorBoundary, main bootstrap, AuthContext)
    // are the only production error visibility this app has, and each logs an
    // Error object rather than a token, session or request body.
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug'],
    legalComments: 'none',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Note: splitting node_modules into a separate vendor chunk was measured and
  // deliberately rejected. It shrinks the entry chunk but breaks scope-hoisting
  // between application and vendor code, taking the initial payload from the
  // current ~737 KB raw / ~219 KB gzip closure to a larger payload. The build
  // budget measures that awaited bootstrap closure; reducing what the shell
  // imports remains the real optimization, not hiding bytes in vendor chunks.
  plugins: [
    react(),
    copyFirstPartyPublicAssets(),
  ]
}));
