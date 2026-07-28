import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { collectActiveV1SourceGraph } from '../scripts/lib/activeV1SourceGraph.mjs';

const projectRoot = resolve(import.meta.dirname, '..');

test('the complete App route module graph has no Base44 runtime dependency', () => {
  const graph = collectActiveV1SourceGraph(projectRoot);
  const violations = graph.imports
    .filter(({ specifier }) => specifier === '@base44/sdk' || specifier === '@/api/base44Client')
    .map(({ file, specifier }) => `${file} -> ${specifier}`);

  assert.ok(graph.files.length > 100, `route graph unexpectedly small: ${graph.files.length} modules`);
  assert.deepEqual(violations, [], `active V1 route graph contains Base44 imports:\n${violations.join('\n')}`);
});
