#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const stages = [
  ['repository-hygiene', ['scripts/verify-repository-hygiene.mjs']],
  ['production-boundary', ['scripts/audit-production.mjs']],
  ['source-graph', ['scripts/verify-source-graph.mjs']],
  ['sql-boundary', ['scripts/verify-sql-boundary.mjs']],
  ['release-contracts', ['--test', 'tests/finalReleaseCertificationContracts.test.mjs']],
  ['buyer-journey', ['scripts/certify-buyer-journey.mjs']],
  ['verified-business-journey', ['scripts/certify-verified-business-journey.mjs']],
  ['peek-fulfilment-journey', ['scripts/certify-peek-fulfilment-journey.mjs']],
  ['listing-publication', ['scripts/certify-listing-publication-journey.mjs']],
  ['safety-operations', ['scripts/certify-safety-operations-journey.mjs']],
];

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 60000) output = output.slice(-60000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => resolve({ status: 'failed', exitCode: null, error: error.message, output }));
    child.on('close', (code) => resolve({ status: code === 0 ? 'passed' : 'failed', exitCode: code, output }));
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  status: 'running',
  hostedEvidenceComplete: false,
  stages: [],
  externalBlockerLedger: 'docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md',
};

for (const [id, args] of stages) {
  const result = await run(args);
  report.stages.push({ id, ...result });
  if (result.status === 'failed') {
    report.status = 'failed';
    break;
  }
}

if (report.status === 'running') {
  const journeyPending = report.stages.some((stage) => /repository-passed-hosted-pending/.test(stage.output || ''));
  report.hostedEvidenceComplete = !journeyPending;
  report.status = journeyPending ? 'repository-certified-hosted-pending' : 'passed';
}

await mkdir('artifacts/certification', { recursive: true });
await writeFile('artifacts/certification/final-release.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'failed' ? 1 : 0;
