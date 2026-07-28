import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['./scripts/tours-public-catalogue-smoke-local.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FINDIT_TOUR_FEED_FIXTURE_COUNT: process.env.FINDIT_TOUR_FEED_FIXTURE_COUNT || '48',
  },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
