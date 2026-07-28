import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = process.cwd();
const outputDirectory = resolve(root, 'artifacts/extensive-audit');
const startedAt = new Date().toISOString();
const gates = [];

function runGate(name, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const gate = {
    name,
    command: [command, ...args].join(' '),
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    durationMs: Date.now() - started,
    output,
  };
  gates.push(gate);
  const marker = gate.status === 'passed' ? 'PASS' : 'FAIL';
  console.log(`[${marker}] ${name}`);
  if (output) console.log(output);
  return gate;
}

const productionEnv = {
  NODE_ENV: 'production',
  VITE_MODE: 'production',
  VITE_SUPABASE_URL: 'https://audit-runtime.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'audit-runtime-public-anon-key-0123456789',
  VITE_FEATURE_BUSINESS_PROFILES: 'true',
  VITE_FEATURE_MESSAGING: 'true',
  VITE_FEATURE_ESSENTIAL_NOTIFICATIONS: 'true',
  VITE_FEATURE_TOURS: 'false',
  VITE_FEATURE_TOURS_PREVIEW: 'false',
  TOURS_BACKEND_ENABLED: 'false',
  FINDIT_TOURS_RELEASE_ACCEPTED: 'false',
  FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: 'true',
  FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET: 'audit-runtime-notification-worker-secret',
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
};

runGate('complete contract suite', process.execPath, ['--experimental-strip-types', '--test', './tests/*.test.mjs']);
runGate('source graph', process.execPath, ['./scripts/verify-source-graph.mjs']);
runGate('repository hygiene', process.execPath, ['./scripts/verify-repository-hygiene.mjs']);
runGate('SQL migration boundary', process.execPath, ['./scripts/verify-sql-boundary.mjs']);
runGate('Base44 elimination', process.execPath, ['./scripts/verify-base44-elimination.mjs']);
runGate('product route and control surface', process.execPath, ['./scripts/audit-product-surface.mjs']);
runGate('expanded UI control surface', process.execPath, ['./scripts/audit-ui-surface.mjs']);
runGate('closed production environment', process.execPath, ['./scripts/validate-env.mjs'], { env: productionEnv });

const blocked = [
  {
    name: 'fresh dependency installation',
    status: 'blocked',
    reason: 'Package registry access is unavailable in the audit environment; the existing node_modules directory is incomplete and was not trusted.',
  },
  {
    name: 'installed ESLint, TypeScript and Vite build',
    status: 'blocked',
    reason: 'These gates require a successful locked dependency installation.',
  },
  {
    name: 'browser-driven interaction execution',
    status: 'blocked',
    reason: 'The app cannot be served without the installed Vite/React dependency tree.',
  },
  {
    name: 'live Supabase, RLS, storage, email and worker execution',
    status: 'blocked',
    reason: 'No authorized staging Supabase runtime or deployment credentials are available in this environment.',
  },
];

const failures = gates.filter((gate) => gate.status !== 'passed');
const report = {
  generatedAt: new Date().toISOString(),
  startedAt,
  status: failures.length ? 'failed' : 'dependency-independent-gates-passed',
  passed: gates.filter((gate) => gate.status === 'passed').length,
  failed: failures.length,
  gates,
  blocked,
};

// The repository hygiene gate forbids pictographic symbols anywhere in the
// tree, and it does not exempt generated evidence. Node's test reporter emits
// U+2714/U+2716 status glyphs into the captured gate output, so this artifact
// must be normalised to ASCII before it is written -- otherwise a second
// consecutive audit run fails on the file the first run produced. Keep these
// ranges in step with prohibitedUnicodeRanges in verify-repository-hygiene.mjs.
// Code points are used rather than literal glyphs so that this file does not
// itself contain a symbol the gate prohibits.
const prohibitedRanges = [[0x1f000, 0x1faff], [0x2300, 0x23ff], [0x2600, 0x27bf]];
const statusGlyphs = new Map([[0x2714, '[pass]'], [0x2716, '[fail]']]);
const asciiEvidence = (value) => [...value]
  .map((character) => {
    const codePoint = character.codePointAt(0);
    if (statusGlyphs.has(codePoint)) return statusGlyphs.get(codePoint);
    const prohibited = prohibitedRanges.some(([start, end]) => codePoint >= start && codePoint <= end);
    return prohibited ? '' : character;
  })
  .join('');

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  join(outputDirectory, 'extensive-audit-verification.json'),
  asciiEvidence(`${JSON.stringify(report, null, 2)}\n`),
);
if (failures.length) process.exit(1);
console.log(`Extensive dependency-independent audit passed: ${report.passed}/${gates.length} gates.`);
