#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const stages = [
  { id: 'repository-contracts', args: ['--test', 'tests/safetyOperationsJourneyContracts.test.mjs'], hosted: false },
  { id: 'admin-smoke', args: ['scripts/phase3-admin-smoke-local.mjs'], hosted: true },
  { id: 'notifications-smoke', args: ['scripts/phase3-notifications-smoke-local.mjs'], hosted: true },
];

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 40000) output = output.slice(-40000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => resolve({ status: 'failed', exitCode: null, error: error.message, output }));
    child.on('close', (code) => resolve({ status: code === 0 ? 'passed' : 'failed', exitCode: code, output }));
  });
}

const hosted = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
const report = { journey: 'safety-operations', generatedAt: new Date().toISOString(), hostedEnvironmentAvailable: hosted, status: 'running', stages: [] };

for (const stage of stages) {
  if (stage.hosted && !hosted) {
    report.stages.push({ id: stage.id, status: 'skipped', reason: 'Hosted Supabase credentials are unavailable.' });
    continue;
  }
  const result = await run(stage.args);
  report.stages.push({ id: stage.id, ...result });
  if (result.status === 'failed') {
    report.status = 'failed';
    break;
  }
}

if (report.status === 'running') report.status = report.stages.some((stage) => stage.status === 'skipped') ? 'repository-passed-hosted-pending' : 'passed';
await mkdir('artifacts/certification', { recursive: true });
await writeFile('artifacts/certification/safety-operations-journey.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'failed' ? 1 : 0;
