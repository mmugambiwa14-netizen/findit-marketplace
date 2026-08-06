#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const stages = [
  ['search-scale', 'scripts/phase7-search-scale-smoke-local.mjs'],
  ['messaging-scale', 'scripts/messaging-scale-smoke-local.mjs'],
  ['peek-scale', 'scripts/tours-scale-smoke-local.mjs'],
  ['notification-scale', 'scripts/notification-scale-smoke-local.mjs'],
];

function run(script) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [script], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 50000) output = output.slice(-50000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => resolve({ status: 'failed', durationMs: Date.now() - startedAt, error: error.message, output }));
    child.on('close', (code) => resolve({ status: code === 0 ? 'passed' : 'failed', exitCode: code, durationMs: Date.now() - startedAt, output }));
  });
}

const hosted = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const report = { generatedAt: new Date().toISOString(), status: hosted ? 'running' : 'hosted-pending', hostedEnvironmentAvailable: hosted, stages: [] };

if (hosted) {
  for (const [id, script] of stages) {
    const result = await run(script);
    report.stages.push({ id, script, ...result });
    if (result.status === 'failed') {
      report.status = 'failed';
      break;
    }
  }
  if (report.status === 'running') report.status = 'passed';
} else {
  report.stages = stages.map(([id, script]) => ({ id, script, status: 'skipped', reason: 'Hosted Supabase credentials are unavailable.' }));
}

await mkdir('artifacts/certification', { recursive: true });
await writeFile('artifacts/certification/release-scale.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'failed' ? 1 : 0;
