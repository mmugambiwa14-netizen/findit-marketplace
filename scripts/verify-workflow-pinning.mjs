import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowsDirectory = resolve(process.cwd(), '.github/workflows');
const approvedActions = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['denoland/setup-deno', '22d081ff2d3a40755e97629de92e3bcbfa7cf2ed'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
]);
const failures = [];
let referenceCount = 0;

for (const fileName of (await readdir(workflowsDirectory)).filter((name) => /\.ya?ml$/i.test(name)).sort()) {
  const source = await readFile(resolve(workflowsDirectory, fileName), 'utf8');
  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)) {
    referenceCount += 1;
    const reference = match[1];
    if (reference.startsWith('./')) continue;
    const separator = reference.lastIndexOf('@');
    if (separator <= 0) {
      failures.push(`${fileName}: action reference is missing an immutable ref: ${reference}`);
      continue;
    }
    const action = reference.slice(0, separator);
    const ref = reference.slice(separator + 1);
    const approvedRef = approvedActions.get(action);
    if (!approvedRef) {
      failures.push(`${fileName}: unapproved third-party action: ${action}`);
      continue;
    }
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      failures.push(`${fileName}: ${action} must use a 40-character commit SHA, found ${ref}`);
      continue;
    }
    if (ref !== approvedRef) {
      failures.push(`${fileName}: ${action} ref ${ref} does not match approved ${approvedRef}`);
    }
  }
}

if (referenceCount === 0) failures.push('no workflow action references were inspected');

if (failures.length) {
  console.error('Workflow pinning verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Workflow pinning verification passed: ${referenceCount} immutable action references inspected.`);
