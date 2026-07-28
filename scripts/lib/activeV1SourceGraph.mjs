import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const extensions = ['', '.js', '.jsx', '.ts', '.tsx'];

function resolveSourceImport(sourceRoot, fromFile, specifier) {
  let candidate;
  if (specifier.startsWith('@/')) candidate = join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = resolve(dirname(fromFile), specifier);
  else return null;

  for (const extension of extensions) {
    const file = `${candidate}${extension}`;
    if (existsSync(file) && extname(file)) return normalize(file);
  }
  for (const extension of extensions.slice(1)) {
    const file = join(candidate, `index${extension}`);
    if (existsSync(file)) return normalize(file);
  }
  return null;
}

function importsIn(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

export function collectActiveV1SourceGraph(projectRoot, entry = 'src/App.jsx') {
  const normalizedRoot = resolve(projectRoot);
  const sourceRoot = join(normalizedRoot, 'src');
  const pending = [join(normalizedRoot, entry)];
  const files = new Set();
  const imports = [];

  while (pending.length) {
    const file = pending.pop();
    if (files.has(file)) continue;
    files.add(file);

    for (const specifier of importsIn(file)) {
      imports.push({
        file: relative(normalizedRoot, file).replaceAll('\\', '/'),
        specifier,
      });
      const dependency = resolveSourceImport(sourceRoot, file, specifier);
      if (dependency && !files.has(dependency)) pending.push(dependency);
    }
  }

  return {
    files: [...files].sort(),
    imports,
  };
}
