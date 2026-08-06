#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const stages = [
  {
    id: 'repository-contracts',
    command: process.execPath,
    args: ['--test', 'tests/listingPublicationJourneyContracts.test.mjs'],
    always: true,
  },
  {
    id: 'hosted-listing-smoke',
    command: process.execPath,
    args: ['scripts/phase4-listing-creation-smoke-local.mjs'],
    always: false,
  },
];

function run(stage) {
  return new Promise((resolve) => {
    const child = spawn(stage.command, stage.args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 40_000) output = output.slice(-40_000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => resolve({ status: 'failed', exitCode: null, output, error: error.message }));
    child.on('close', (code) => resolve({ status: code === 0 ? 'passed' : 'failed', exitCode: code, output }));
  });
}

const hasHostedEnvironment = Boolean(
  process.env.SUPABASE_URL
  && process.env.SUPABASE_ANON_KEY
  && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const report = {
  journey: 'listing-publication',
  generatedAt: new Date().toISOString(),
  status: 'running',
  hostedEnvironmentAvailable: hasHostedEnvironment,
  stages: [],
};

for (const stage of stages) {
  if (!stage.always && !hasHostedEnvironment) {
    report.stages.push({ id: stage.id, status: 'skipped', reason: 'Hosted Supabase credentials are unavailable.' });
    continue;
  }
  const result = await run(stage);
  report.stages.push({ id: stage.id, ...result });
  if (result.status === 'failed') {
    report.status = 'failed';
    break;
  }
}

if (report.status === 'running') {
  report.status = report.stages.some((stage) => stage.status === 'skipped') ? 'repository-passed-hosted-pending' : 'passed';
}

await mkdir('artifacts/certification', { recursive: true });
await writeFile('artifacts/certification/listing-publication-journey.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'failed' ? 1 : 0;
