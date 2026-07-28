import { spawnSync } from 'node:child_process';

const allowedAdvisories = new Set([
  // FindIt uses React Router's declarative browser mode. It has no RSC routes,
  // server actions, or RSC request handler, so this advisory has no reachable
  // execution surface in the production application.
  'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
]);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this gate through `npm run audit:production`.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [npmCli, 'audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(result.stderr || 'npm audit did not return valid JSON.');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};

function isAllowed(name, visited = new Set()) {
  if (visited.has(name)) return true;
  visited.add(name);
  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return false;

  return vulnerability.via.every((cause) => {
    if (typeof cause === 'string') return isAllowed(cause, visited);
    return allowedAdvisories.has(cause.url);
  });
}

const actionable = Object.entries(vulnerabilities)
  .filter(([, vulnerability]) => ['moderate', 'high', 'critical'].includes(vulnerability.severity))
  .filter(([name]) => !isAllowed(name));

const acknowledged = Object.keys(vulnerabilities).filter((name) => isAllowed(name));

if (actionable.length > 0) {
  console.error('Production dependency audit failed:');
  for (const [name, vulnerability] of actionable) {
    console.error(`- ${name}: ${vulnerability.severity}`);
  }
  process.exit(1);
}

console.log('Production dependency audit passed: no reachable Moderate, High, or Critical advisories.');
if (acknowledged.length > 0) {
  console.log(`Acknowledged unreachable RSC-only advisory for: ${acknowledged.join(', ')}.`);
}
