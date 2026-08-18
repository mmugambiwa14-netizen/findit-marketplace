import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readWorkflow = (name) => readFileSync(resolve(root, '.github', 'workflows', name), 'utf8');

test('production worker feature flags are evaluated after the environment is attached', () => {
  const maintenance = readWorkflow('maintenance-workers-production.yml');
  const push = readWorkflow('web-push-delivery.yml');

  assert.doesNotMatch(
    maintenance,
    /^\s+if:\s+vars\.FINDIT_(?:TOURS|RECOMMENDATION|ESSENTIAL_NOTIFICATIONS|TRANSACTIONAL_EMAIL)_WORKERS_ENABLED/m,
  );
  assert.doesNotMatch(push, /^\s+if:\s+\$\{\{\s*vars\.FINDIT_WEB_PUSH_WORKERS_ENABLED/m);
  assert.match(maintenance, /FINDIT_TOURS_WORKERS_ENABLED:\s*\$\{\{\s*vars\.FINDIT_TOURS_WORKERS_ENABLED\s*\}\}/);
  assert.match(push, /FINDIT_WEB_PUSH_WORKERS_ENABLED:\s*\$\{\{\s*vars\.FINDIT_WEB_PUSH_WORKERS_ENABLED\s*\}\}/);
  assert.match(push, /Web Push delivery is disabled for this environment/);
  assert.match(maintenance, /environment:\s*cloudflare-production-workers/);
  assert.match(push, /environment:\s*cloudflare-production-workers/);
  assert.match(
    maintenance,
    /group:\s*findit-production-maintenance-workers[\s\S]*?cancel-in-progress:\s*true/,
  );
  assert.doesNotMatch(maintenance, /apt-get\s+(?:update|install)/);
  assert.match(maintenance, /command -v ffmpeg[\s\S]*?ffmpeg -version/);
});
