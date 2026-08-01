# Vercel staging preview

The Vercel staging project is `findit-marketplace-staging`.

Git repository: `mmugambiwa14-netizen/findit-marketplace`

Preview source branch: `feature/listing-intelligence-foundation`

Frontend framework: Vite

Build command: `npm run build`

Output directory: `dist`

The preview environment must use the FindIt Staging Supabase project and a browser-restricted MapTiler key. Production remains separate and must not be migrated or promoted through this preview project.

Supabase Auth must use `https://findit-marketplace-staging.vercel.app/` as its Site URL and allow both that exact URL and `https://findit-marketplace-staging.vercel.app/**` as redirect URLs. The GitHub Pages URLs remain allow-listed only for the legacy preview; they must not be the staging Site URL because Supabase uses the Site URL as the fallback after authentication.
