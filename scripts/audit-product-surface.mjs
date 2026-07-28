import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const srcRoot = resolve(root, 'src');
const outputDirectory = resolve(root, 'artifacts/product-audit');
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ignoredDirectories = new Set(['node_modules', 'dist', '.git', 'coverage']);
const resolutionExtensions = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'];
const controlNames = new Set([
  'button', 'a', 'Button', 'Link', 'NavLink', 'Input', 'Textarea', 'Select', 'Checkbox',
  'Switch', 'RadioGroup', 'Slider', 'form', 'Dialog', 'AlertDialog', 'Sheet',
  'PopoverTrigger', 'DropdownMenuTrigger', 'SelectTrigger', 'TabsTrigger',
]);

async function loadTypeScript() {
  const candidates = [
    'typescript',
    pathToFileURL(resolve(dirname(process.execPath), '../lib/node_modules/typescript/lib/typescript.js')).href,
    pathToFileURL(resolve(dirname(process.execPath), '../../lib/node_modules/typescript/lib/typescript.js')).href,
  ];
  for (const candidate of candidates) {
    try {
      const module = await import(candidate);
      return module.default ?? module;
    } catch {
      // Continue to the next installed/global compiler location.
    }
  }
  throw new Error('TypeScript parser is unavailable. Run npm ci or install TypeScript in the active Node toolchain.');
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, output);
    else if (sourceExtensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}

async function resolveLocalImport(file, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(srcRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(file), specifier);
  else return null;

  for (const extension of resolutionExtensions) {
    const candidate = `${base}${extension}`;
    if (await exists(candidate)) return candidate;
  }
  for (const extension of resolutionExtensions.slice(1)) {
    const candidate = join(base, `index${extension}`);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function elementName(tag) {
  return tag.getText().replace(/\s+/g, '');
}

function attributeMap(opening, sourceFile) {
  const output = {};
  for (const property of opening.attributes.properties) {
    if (ts.isJsxAttribute(property)) {
      const key = property.name.getText(sourceFile);
      if (!property.initializer) output[key] = 'true';
      else if (ts.isStringLiteral(property.initializer)) output[key] = property.initializer.text;
      else if (ts.isJsxExpression(property.initializer)) output[key] = property.initializer.expression?.getText(sourceFile) ?? '';
    } else if (ts.isJsxSpreadAttribute(property)) {
      output['...'] = property.expression.getText(sourceFile);
    }
  }
  return output;
}

function textContent(node, sourceFile) {
  const parts = [];
  const visit = (current) => {
    if (ts.isJsxText(current) && current.text.trim()) parts.push(current.text.replace(/\s+/g, ' ').trim());
    else if (ts.isJsxExpression(current) && current.expression) {
      if (
        ts.isStringLiteral(current.expression)
        || ts.isNoSubstitutionTemplateLiteral(current.expression)
        || ts.isIdentifier(current.expression)
        || ts.isPropertyAccessExpression(current.expression)
        || ts.isConditionalExpression(current.expression)
      ) parts.push(`{${current.expression.getText(sourceFile)}}`);
    } else if (ts.isJsxElement(current)) {
      const name = elementName(current.openingElement.tagName);
      if (!/(?:Icon|Loader|Chevron|Arrow|Circle|Flag|Heart|Share|X)$/i.test(name) && !['svg', 'path'].includes(name)) {
        current.children.forEach(visit);
      }
    }
  };
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function ancestorTriggerAction(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isJsxElement(current)) {
      const ancestorName = elementName(current.openingElement.tagName);
      if (/(?:Trigger|Close)$/.test(ancestorName)) return `${ancestorName} delegated action`;
    }
    current = current.parent;
  }
  return '';
}

function controlAction(name, attributes, node) {
  if (['Link', 'NavLink', 'a'].includes(name)) return attributes.to || attributes.href || '';
  if (name === 'form') return attributes.onSubmit || '';
  if (attributes.onClick) return attributes.onClick;
  if (attributes.onValueChange) return attributes.onValueChange;
  if (attributes.onChange) return attributes.onChange;
  if (attributes.onCheckedChange) return attributes.onCheckedChange;
  if (attributes.onOpenChange) return attributes.onOpenChange;
  if (attributes.type === 'submit') return 'form submit';
  if (attributes.asChild) return 'delegated child action';
  if (/(?:Trigger|Dialog|Sheet|Select|Checkbox|Switch|Slider|RadioGroup)/.test(name)) return 'component state action';
  return ancestorTriggerAction(node);
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function routeKind(path) {
  if (path.startsWith('/admin')) return 'admin';
  if (['/post', '/create-service', '/my-services', '/saved', '/profile', '/my-listings', '/settings', '/chats', '/chats/:conversationId', '/business-profiles', '/notifications'].includes(path)) return 'protected';
  if (['/create', '/messages', '/messages/:conversationId', '/faqs', '/support'].includes(path)) return 'compatibility';
  if (path === '*') return 'fallback';
  return 'public';
}

function addFinding(collection, { severity, code, file, line = null, message, evidence = '' }) {
  collection.push({ severity, code, file, line, message, evidence });
}

const ts = await loadTypeScript();
const files = (await collect(srcRoot)).sort();
const fileSet = new Set(files.map((file) => resolve(file)));
const fileInfo = new Map();
const failures = [];
const warnings = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX
    : file.endsWith('.jsx') ? ts.ScriptKind.JSX
      : file.endsWith('.ts') ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const imports = [];
  const controls = [];
  const labels = new Set();

  const previsit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const name = elementName(opening.tagName);
      const attributes = attributeMap(opening, sourceFile);
      if ((name === 'label' || name === 'Label') && attributes.htmlFor) labels.add(attributes.htmlFor);
    }
    ts.forEachChild(node, previsit);
  };
  previsit(sourceFile);

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const name = elementName(opening.tagName);
      const attributes = attributeMap(opening, sourceFile);
      const line = lineOf(sourceFile, opening);
      const label = attributes['aria-label'] || attributes.title || attributes.placeholder || textContent(node, sourceFile);

      if (controlNames.has(name)) {
        controls.push({
          file: relative(root, file),
          line,
          element: name,
          label,
          type: attributes.type || '',
          action: controlAction(name, attributes, node),
          destination: attributes.to || attributes.href || '',
          disabled: attributes.disabled || '',
          id: attributes.id || '',
        });
      }

      if (name === 'button' && !attributes.type) {
        addFinding(failures, { severity: 'high', code: 'BUTTON_TYPE', file: relative(root, file), line, message: 'Native button lacks an explicit type.' });
      }
      if (['a', 'Link', 'NavLink'].includes(name) && attributes.target === '_blank') {
        const rel = String(attributes.rel || '');
        if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
          addFinding(failures, { severity: 'high', code: 'BLANK_LINK_REL', file: relative(root, file), line, message: 'New-tab link lacks rel="noopener noreferrer".' });
        }
      }
      if (name === 'img' && !Object.hasOwn(attributes, 'alt')) {
        addFinding(failures, { severity: 'high', code: 'IMAGE_ALT', file: relative(root, file), line, message: 'Image lacks an alt attribute.' });
      }
      if (['div', 'span', 'p', 'li'].includes(name) && attributes.onClick && !attributes.role && !attributes.tabIndex) {
        addFinding(failures, { severity: 'high', code: 'NONINTERACTIVE_CLICK', file: relative(root, file), line, message: `${name} handles clicks without keyboard semantics.` });
      }
      if (name === 'a' && /^\//.test(attributes.href || '')) {
        addFinding(failures, { severity: 'medium', code: 'RAW_INTERNAL_ANCHOR', file: relative(root, file), line, message: 'Internal navigation uses a raw anchor instead of router navigation.' });
      }
      if (name === 'form' && !attributes.onSubmit) {
        addFinding(warnings, { severity: 'low', code: 'FORM_WITHOUT_SUBMIT_HANDLER', file: relative(root, file), line, message: 'Form has no explicit onSubmit handler; verify native submission is intentional.' });
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression.getText(sourceFile);
      const method = node.expression.name.text;
      if (target === 'window' && method === 'open') {
        const args = node.arguments.map((argument) => argument.getText(sourceFile));
        if (args[1]?.includes('_blank') && (!args[2] || !args[2].includes('noopener'))) {
          addFinding(failures, { severity: 'high', code: 'WINDOW_OPEN_NOOPENER', file: relative(root, file), line: lineOf(sourceFile, node), message: 'window.open(_blank) lacks noopener.' });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const resolvedImports = [];
  for (const specifier of imports) {
    const resolvedImport = await resolveLocalImport(file, specifier);
    if (resolvedImport) resolvedImports.push(resolve(resolvedImport));
  }
  fileInfo.set(resolve(file), { source, controls, imports: [...new Set(resolvedImports)] });

  const displayPath = relative(root, file).replaceAll('\\', '/');
  if (/images\.unsplash\.com/.test(source)) {
    addFinding(failures, { severity: 'high', code: 'REMOTE_LISTING_PLACEHOLDER', file: displayPath, message: 'Listing UI depends on a third-party image placeholder.' });
  }
  if (/window\.confirm\s*\(/.test(source)) {
    const firstLine = source.slice(0, source.search(/window\.confirm\s*\(/)).split(/\r?\n/).length;
    addFinding(warnings, { severity: 'low', code: 'NATIVE_CONFIRM', file: displayPath, line: firstLine, message: 'Blocking native confirmation is functional but inconsistent with the application dialog system.' });
  }
  if (/fonts\.googleapis\.com/.test(source)) {
    addFinding(warnings, { severity: 'medium', code: 'REMOTE_FONT_DEPENDENCY', file: displayPath, line: 1, message: 'The UI depends on a remote font stylesheet; offline/privacy-sensitive environments fall back to system fonts.' });
  }
  if (!displayPath.endsWith('src/lib/browserStorage.js') && !displayPath.endsWith('src/services/authService.js') && /\b(?:localStorage|sessionStorage)\b/.test(source)) {
    addFinding(failures, { severity: 'medium', code: 'UNSAFE_BROWSER_STORAGE', file: displayPath, message: 'Browser storage is accessed outside the guarded storage boundary.' });
  }
}

const appPath = resolve(srcRoot, 'App.jsx');
const appSource = await readFile(appPath, 'utf8');
const lazyMap = new Map();
for (const match of appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]@\/([^'"]+)['"]\)\);/g)) {
  lazyMap.set(match[1], `src/${match[2]}`);
}

const routes = [];
for (const match of appSource.matchAll(/<Route\b([\s\S]*?)(?:\/>|>)/g)) {
  const attributes = match[1];
  const pathMatch = attributes.match(/\bpath=["']([^"']+)["']/);
  if (!pathMatch) continue;
  const path = pathMatch[1];
  const componentMatch = attributes.match(/\belement=\{<([A-Za-z0-9_]+)/);
  const component = componentMatch?.[1] ?? '';
  const sourcePath = lazyMap.get(component) ?? '';
  const line = appSource.slice(0, match.index).split(/\r?\n/).length;
  routes.push({ path, kind: routeKind(path), component, source: sourcePath, line });
  if (sourcePath) {
    const candidates = resolutionExtensions.flatMap((extension) => [resolve(root, `${sourcePath}${extension}`), resolve(root, sourcePath, `index${extension}`)]);
    if (!candidates.some((candidate) => fileSet.has(candidate))) {
      addFinding(failures, { severity: 'critical', code: 'MISSING_ROUTE_MODULE', file: 'src/App.jsx', line, message: `Route ${path} resolves to missing module ${sourcePath}.` });
    }
  }
}
if (!routes.some((route) => route.path === '*')) {
  addFinding(failures, { severity: 'high', code: 'MISSING_FALLBACK_ROUTE', file: 'src/App.jsx', message: 'Application has no wildcard fallback route.' });
}

const duplicateRoutes = new Map();
for (const route of routes) duplicateRoutes.set(route.path, (duplicateRoutes.get(route.path) ?? 0) + 1);
for (const [path, count] of duplicateRoutes) {
  if (count > 1 && path !== '/tours') {
    addFinding(warnings, { severity: 'medium', code: 'DUPLICATE_ROUTE', file: 'src/App.jsx', message: `Route ${path} is declared ${count} times.` });
  }
}

const pageDirectory = resolve(srcRoot, 'pages');
const posixPath = (value) => value.replaceAll('\\', '/');
const pages = files.filter((file) => posixPath(resolve(file)).startsWith(`${posixPath(pageDirectory)}/`));
function importClosure(start) {
  const seen = new Set();
  const queue = [resolve(start)];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dependency of fileInfo.get(file)?.imports ?? []) {
      if (
        dependency.startsWith(resolve(srcRoot, 'components'))
        || dependency.startsWith(resolve(srcRoot, 'hooks'))
        || dependency.startsWith(resolve(srcRoot, 'lib'))
      ) queue.push(dependency);
    }
  }
  return [...seen];
}

const pageControls = [];
const sourceToRoutes = new Map();
for (const route of routes) {
  if (!route.source) continue;
  const routeFile = resolutionExtensions.map((extension) => resolve(root, `${route.source}${extension}`)).find((candidate) => fileSet.has(candidate));
  if (!routeFile) continue;
  if (!sourceToRoutes.has(routeFile)) sourceToRoutes.set(routeFile, []);
  sourceToRoutes.get(routeFile).push(route.path);
}
for (const page of pages) {
  const routePaths = sourceToRoutes.get(resolve(page)) ?? [];
  for (const file of importClosure(page)) {
    for (const control of fileInfo.get(file)?.controls ?? []) {
      pageControls.push({
        routes: routePaths.join(' | '),
        page: relative(pageDirectory, page),
        ...control,
        shared: resolve(file) !== resolve(page),
      });
    }
  }
}

const knownLimitations = [];
warnings.push(...knownLimitations);

const byElement = {};
for (const entry of [...fileInfo.values()].flatMap((info) => info.controls)) byElement[entry.element] = (byElement[entry.element] ?? 0) + 1;
const bySeverity = (findings) => findings.reduce((accumulator, finding) => {
  accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1;
  return accumulator;
}, {});

const result = {
  generatedAt: new Date().toISOString(),
  scope: {
    sourceModules: files.length,
    routedPatterns: routes.length,
    pageModules: pages.length,
    uniqueControlInstances: [...fileInfo.values()].flatMap((info) => info.controls).length,
    pageExpandedControlInstances: pageControls.length,
  },
  controlsByElement: Object.fromEntries(Object.entries(byElement).sort(([left], [right]) => left.localeCompare(right))),
  routes,
  failures,
  warnings,
  summary: {
    failureCount: failures.length,
    warningCount: warnings.length,
    failureSeverity: bySeverity(failures),
    warningSeverity: bySeverity(warnings),
  },
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, 'product-surface-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
const columns = ['routes', 'page', 'file', 'line', 'element', 'label', 'type', 'action', 'destination', 'disabled', 'id', 'shared'];
await writeFile(
  join(outputDirectory, 'page-control-matrix.csv'),
  `${columns.join(',')}\n${pageControls.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}\n`,
);
await writeFile(
  join(outputDirectory, 'route-matrix.csv'),
  `path,kind,component,source,line\n${routes.map((route) => [route.path, route.kind, route.component, route.source, route.line].map(csvCell).join(',')).join('\n')}\n`,
);

console.log(`Product surface audit: ${routes.length} route patterns, ${pages.length} page modules, ${result.scope.uniqueControlInstances} unique controls, ${pageControls.length} page-expanded controls.`);
console.log(`Findings: ${failures.length} failures, ${warnings.length} warnings.`);
if (failures.length) {
  for (const finding of failures) console.error(`- ${finding.code}: ${finding.file}${finding.line ? `:${finding.line}` : ''} — ${finding.message}`);
  process.exit(1);
}
