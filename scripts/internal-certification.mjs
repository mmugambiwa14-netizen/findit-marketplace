import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = resolve(root, 'artifacts/certification/internal-certification.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const OUTPUT_LIMIT = 16_000;

function run(command, args, options = {}) {
  const startedAt = new Date();
  const started = process.hrtime.bigint();
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, CI: '1', ...options.env },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return {
    command: [command, ...args].join(' '),
    startedAt: startedAt.toISOString(),
    durationMs: Math.round(durationMs),
    status: result.status,
    signal: result.signal || null,
    passed: result.status === 0,
    output: output.length > OUTPUT_LIMIT ? `${output.slice(0, OUTPUT_LIMIT)}\n[output truncated]` : output,
    spawnError: result.error?.message || null,
  };
}

async function sha256(path) {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 ? String(result.stdout || '').trim() : null;
}

const migrations = (await readdir(resolve(root, 'supabase/migrations')))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const commit = process.env.GITHUB_SHA
  || commandOutput('git', ['rev-parse', 'HEAD'])
  || 'unavailable';
const gitStatus = commandOutput('git', ['status', '--porcelain']);

const gates = [
  {
    name: 'verify:workflow-pinning',
    command: process.execPath,
    args: ['./scripts/verify-workflow-pinning.mjs'],
  },
  ...[
    'verify:hygiene',
    'verify:source-graph',
    'verify:sql-boundary',
    'verify:deployment-security',
    'audit:production',
    'lint',
    'typecheck:migration',
    'typecheck:active',
    'typecheck:edge-functions',
    'test:contracts',
    'verify:base44-elimination',
    'build',
  ].map((script) => ({
    name: script,
    command: npmCommand,
    args: ['run', script],
  })),
];

const results = gates.map((gate) => ({
  gate: gate.name,
  ...run(gate.command, gate.args),
}));

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  repository: 'mmugambiwa14-netizen/findit-marketplace',
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || null,
  commit,
  environment: {
    node: process.version,
    npm: commandOutput(npmCommand, ['--version']),
    operatingSystem: `${platform()} ${release()}`,
    continuousIntegration: process.env.CI === '1' || process.env.CI === 'true',
    cleanCheckout: gitStatus === '',
    gitStatusAvailable: gitStatus !== null,
  },
  sourceBoundary: {
    migrationCount: migrations.length,
    migrationTip: migrations.at(-1) || null,
    packageSha256: await sha256(resolve(root, 'package.json')),
    packageLockSha256: await sha256(resolve(root, 'package-lock.json')),
    deploymentConfigurationSha256: await sha256(resolve(root, 'vercel.json')),
    mapProviderSha256: await sha256(resolve(root, 'src/lib/mapProvider.js')),
  },
  summary: {
    gateCount: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    certified: results.every((result) => result.passed),
  },
  gates: results,
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Internal certification report written to ${reportPath}`);
console.log(`${report.summary.passed}/${report.summary.gateCount} gates passed.`);

if (!report.summary.certified) process.exit(1);
