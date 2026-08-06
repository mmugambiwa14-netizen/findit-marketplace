import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const stages = [
  ['search', 'scripts/phase7-search-scale-smoke-local.mjs'],
  ['public-peek-catalogue', 'scripts/tours-public-catalogue-smoke-local.mjs'],
  ['listing-peek-integration', 'scripts/tours-listing-integration-smoke-local.mjs'],
  ['notifications', 'scripts/phase3-notifications-smoke-local.mjs'],
  ['messaging', 'scripts/phase3-messaging-smoke-local.mjs'],
];

function runStage(name, script) {
  return new Promise((resolveStage) => {
    const startedAt = new Date();
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on('close', (code, signal) => {
      resolveStage({
        name,
        script,
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code,
        signal,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        stdout: stdout.slice(-20_000),
        stderr: stderr.slice(-20_000),
      });
    });
  });
}

async function main() {
  for (const [, script] of stages) {
    await access(resolve(script), constants.R_OK);
  }

  const report = {
    journey: 'buyer-discovery-to-peek-request-notification-chat',
    startedAt: new Date().toISOString(),
    status: 'running',
    stages: [],
  };

  for (const [name, script] of stages) {
    console.log(`\n=== Buyer journey stage: ${name} ===`);
    const result = await runStage(name, script);
    report.stages.push(result);
    if (result.status !== 'passed') {
      report.status = 'failed';
      break;
    }
  }

  report.finishedAt = new Date().toISOString();
  if (report.status === 'running') report.status = 'passed';
  await mkdir('artifacts/certification', { recursive: true });
  await writeFile(
    'artifacts/certification/buyer-journey.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  console.log(`\nBuyer journey certification: ${report.status.toUpperCase()}`);
  if (report.status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  console.error('Buyer journey certification could not start:', error);
  process.exitCode = 1;
});
