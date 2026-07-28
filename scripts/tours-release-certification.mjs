import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = process.cwd();
const results = [];

function run(name, command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const record = {
    name,
    status: result.status === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - startedAt,
  };
  if (options.capture) {
    record.stdout = result.stdout?.trim() || '';
    record.stderr = result.stderr?.trim() || '';
    if (record.stdout) console.log(record.stdout);
    if (record.stderr) console.error(record.stderr);
  }
  results.push(record);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed with exit code ${result.status}`);
}

function runPackageScript(name, script) {
  if (process.platform === 'win32') {
    run(name, process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`]);
    return;
  }

  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) {
    run(name, process.execPath, [npmExecPath, 'run', script]);
    return;
  }

  run(name, 'npm', ['run', script]);
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}

async function validateJsonTree() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (extname(entry.name) === '.json') files.push(path);
    }
  }
  await walk(root);
  for (const file of files) JSON.parse(await readFile(file, 'utf8'));
  results.push({ name: 'JSON configuration validation', status: 'passed', files: files.length });
  console.log(`JSON configuration validation passed: ${files.length} files.`);
}


const testFiles = (await readdir(resolve(root, 'tests')))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => `./tests/${name}`);
const tourTestFiles = testFiles.filter((name) => name.split('/').at(-1).startsWith('tour'));

const productionBase = {
  NODE_ENV: 'production',
  VITE_SUPABASE_URL: 'https://findit-release.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'release-anon-key',
  VITE_FEATURE_BUSINESS_PROFILES: 'true',
  VITE_FEATURE_MESSAGING: 'true',
  VITE_FEATURE_ESSENTIAL_NOTIFICATIONS: 'true',
  VITE_AUTH_GOOGLE_ENABLED: 'true',
  VITE_FEATURE_GOOGLE_OAUTH: 'true',
  VITE_FEATURE_INTERNATIONAL_LISTING: 'true',
  VITE_FEATURE_MANUAL_LOCATION: 'true',
  VITE_FEATURE_CURRENT_LOCATION: 'true',
  VITE_FEATURE_REPORTING: 'true',
  VITE_FEATURE_PAYMENTS: 'false',
  VITE_FEATURE_SUBSCRIPTIONS: 'false',
  VITE_FEATURE_ESCROW: 'false',
  VITE_FEATURE_PREMIUM_LISTINGS: 'false',
  VITE_FEATURE_AI_MODERATION: 'false',
  VITE_FEATURE_AI_BAN_EVASION: 'false',
  VITE_FEATURE_AI_TICKET_TRIAGE: 'false',
  VITE_FEATURE_AI_SUPPORT_CHAT: 'false',
  VITE_FEATURE_SCHEDULED_REMINDERS: 'false',
  VITE_FEATURE_MARKETING_EMAILS: 'false',
  VITE_FEATURE_LISTING_EXPIRY: 'false',
  VITE_FEATURE_LISTING_FRESHNESS_REMINDERS: 'false',
  VITE_FEATURE_TOURS_PREVIEW: 'false',
  FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: 'true',
  FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET: 'release-notification-fanout-secret',
};

try {
  run('Complete repository contracts', process.execPath, ['--experimental-strip-types', '--test', ...testFiles]);
  run('Tours contracts', process.execPath, ['--experimental-strip-types', '--test', ...tourTestFiles]);
  run('Source graph', process.execPath, ['./scripts/verify-source-graph.mjs']);
  run('Repository hygiene', process.execPath, ['./scripts/verify-repository-hygiene.mjs']);
  run('SQL boundary', process.execPath, ['./scripts/verify-sql-boundary.mjs']);
  run('Product surface audit', process.execPath, ['./scripts/audit-product-surface.mjs']);
  run('Base44 elimination', process.execPath, ['./scripts/verify-base44-elimination.mjs']);
  await validateJsonTree();

  run('Closed Tours production environment', process.execPath, ['./scripts/validate-env.mjs'], {
    env: {
      ...productionBase,
      VITE_FEATURE_TOURS: 'false',
      TOURS_BACKEND_ENABLED: 'false',
      FINDIT_TOURS_RELEASE_ACCEPTED: 'false',
      FINDIT_TOURS_ACCEPTANCE_ID: '',
    },
  });

  run('Accepted Tours production environment', process.execPath, ['./scripts/validate-env.mjs'], {
    env: {
      ...productionBase,
      VITE_FEATURE_TOURS: 'true',
      TOURS_BACKEND_ENABLED: 'true',
      FINDIT_TOURS_RELEASE_ACCEPTED: 'true',
      FINDIT_TOURS_ACCEPTANCE_ID: 'tour-acceptance-2026-07-27-staging-001',
      FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: 'true',
      TOUR_PROCESSOR_URL: 'https://processor.findit.invalid/jobs',
      TOUR_PROCESSOR_SECRET: 'release-processor-secret',
      TOUR_PROCESSING_CALLBACK_URL: 'https://findit-release.supabase.co/functions/v1/tour-processing-callback',
      FINDIT_TOUR_PROCESSING_WORKER_SECRET: 'release-processing-secret',
      FINDIT_TOUR_CLEANUP_WORKER_SECRET: 'release-cleanup-secret',
      FINDIT_TOUR_CACHE_WORKER_SECRET: 'release-cache-secret',
      FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET: 'release-observability-secret',
    },
  });

  const installed = await exists(resolve(root, 'node_modules/.bin/vite'));
  if (installed) {
    for (const [name, script] of [
      ['ESLint', 'lint'],
      ['TypeScript project check', 'typecheck'],
      ['Migration TypeScript check', 'typecheck:migration'],
      ['Active source check', 'typecheck:active'],
      ['Production build', 'build'],
      ['Production dependency audit', 'audit:production'],
    ]) runPackageScript(name, script);
  } else {
    const installBlockReason = process.env.FINDIT_INSTALL_BLOCK_REASON?.trim()
      || 'Locked dependencies are not installed in this workspace.';
    for (const name of ['ESLint', 'TypeScript project check', 'Migration TypeScript check', 'Active source check', 'Production build', 'Production dependency audit']) {
      results.push({ name, status: 'blocked', reason: installBlockReason });
    }
    console.warn(`Installed-toolchain gates are blocked: ${installBlockReason}`);
  }

  await mkdir(resolve(root, 'artifacts'), { recursive: true });
  const manifest = {
    milestone: 7,
    title: 'Scale Hardening and Release Certification',
    generatedAt: new Date().toISOString(),
    result: results.some((item) => item.status === 'failed') ? 'failed'
      : results.some((item) => item.status === 'blocked') ? 'conditionally-passed'
        : 'passed',
    results,
    liveAcceptance: {
      status: 'required',
      gates: [
        'Apply migrations through 0044 to an authorized local and staging Supabase runtime.',
        'Run Tour, messaging, listing-search, notification fan-out, observability and lifecycle smoke suites against staging.',
        'Inspect production-scale query plans and worker queues.',
        'Complete mobile/browser playback acceptance and rollback rehearsal.',
      ],
    },
  };
  const output = resolve(root, 'artifacts/milestone-7-release-certification.json');
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Release certification manifest written to ${output}`);
  if (manifest.result === 'failed') process.exit(1);
} catch (error) {
  await mkdir(resolve(root, 'artifacts'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/milestone-7-release-certification.json'), `${JSON.stringify({
    milestone: 7,
    title: 'Scale Hardening and Release Certification',
    generatedAt: new Date().toISOString(),
    result: 'failed',
    error: error instanceof Error ? error.message : String(error),
    results,
  }, null, 2)}\n`);
  console.error(error);
  process.exit(1);
}
