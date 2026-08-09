import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const src = resolve(root, 'src');
const outputDirectory = resolve(root, 'artifacts/extensive-audit');
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const resolutionExtensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];
const ignored = new Set(['node_modules', 'dist', '.git', 'coverage']);
const controlNames = new Set([
  'button', 'a', 'Button', 'Link', 'NavLink', 'Input', 'Textarea', 'Select', 'Checkbox',
  'Switch', 'Slider', 'form', 'Dialog', 'AlertDialog', 'Sheet', 'PopoverTrigger',
  'DropdownMenuTrigger', 'SelectTrigger',
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
      // Try the next compiler location.
    }
  }
  throw new Error('TypeScript parser is unavailable. Run npm ci before the UI audit.');
}

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath, output);
    else if (extensions.has(extname(entry.name))) output.push(fullPath);
  }
  return output;
}

function elementName(ts, tag) {
  return ts.isIdentifier(tag) ? tag.text : tag.getText();
}

function attributes(ts, node, sourceFile) {
  const values = {};
  for (const property of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      values['...'] = property.expression.getText(sourceFile);
      continue;
    }
    const key = property.name.text;
    if (!property.initializer) values[key] = 'true';
    else if (ts.isStringLiteral(property.initializer)) values[key] = property.initializer.text;
    else values[key] = property.initializer.expression?.getText(sourceFile) ?? '';
  }
  return values;
}

function visibleText(ts, node, sourceFile) {
  let output = '';
  function visit(child) {
    if (ts.isJsxText(child)) output += ` ${child.text.replace(/\s+/g, ' ').trim()}`;
    else if (ts.isJsxExpression(child) && child.expression) {
      const expression = child.expression;
      if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) output += ` ${expression.text}`;
      else if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) output += ` {${expression.getText(sourceFile)}}`;
      else if (ts.isConditionalExpression(expression)) output += ` ${expression.whenTrue.getText(sourceFile)} ${expression.whenFalse.getText(sourceFile)}`;
    } else if (ts.isJsxElement(child)) {
      const name = elementName(ts, child.openingElement.tagName);
      if (!/(Icon|Loader|Chevron|Arrow|Circle|Heart|Share|Search|X)$/i.test(name) && !['svg', 'path'].includes(name)) {
        child.children.forEach(visit);
      }
    }
  }
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  return output.replace(/\s+/g, ' ').trim();
}

function csv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function resolveImport(fromFile, specifier, fileSet) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(src, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;

  for (const extension of resolutionExtensions) {
    const candidate = `${base}${extension}`;
    if (fileSet.has(candidate)) return candidate;
  }
  for (const extension of resolutionExtensions.slice(1)) {
    const candidate = join(base, `index${extension}`);
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function transitiveClosure(start, graph) {
  const visited = new Set();
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const dependency of graph.get(current) ?? []) stack.push(dependency);
  }
  return visited;
}

const ts = await loadTypeScript();
const files = (await collect(src)).sort();
const fileSet = new Set(files);
const pageRoot = resolve(src, 'pages');
const posixPath = (value) => value.replaceAll('\\', '/');
const isPageModule = (file) => posixPath(file).startsWith(`${posixPath(pageRoot)}/`);
const pages = files.filter(isPageModule);
const controls = [];
const controlsByFile = new Map();
const findings = [];
const importGraph = new Map();

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const labels = new Set();
  const localImports = new Set();

  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const resolved = resolveImport(file, match[1], fileSet);
    if (resolved) localImports.add(resolved);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const resolved = resolveImport(file, match[1], fileSet);
    if (resolved) localImports.add(resolved);
  }
  importGraph.set(file, localImports);

  function collectLabels(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const name = elementName(ts, open.tagName);
      const attrs = attributes(ts, open, sourceFile);
      if (['Label', 'label'].includes(name) && attrs.htmlFor) labels.add(attrs.htmlFor);
    }
    ts.forEachChild(node, collectLabels);
  }
  collectLabels(sourceFile);

  function addFinding(node, code, severity, message) {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    findings.push({ file: relative(root, file), line: location.line + 1, code, severity, message });
  }

  function hasAncestorAccessibleLabel(node) {
    let current = node.parent;
    while (current) {
      if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
        const opening = ts.isJsxElement(current) ? current.openingElement : current;
        const ancestorName = elementName(ts, opening.tagName);
        const ancestorAttrs = attributes(ts, opening, sourceFile);
        if (ancestorName === 'label' || (ancestorName === 'Field' && ancestorAttrs.label)) return true;
      }
      current = current.parent;
    }
    return false;
  }

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const name = elementName(ts, open.tagName);
      const attrs = attributes(ts, open, sourceFile);
      const text = visibleText(ts, node, sourceFile);
      const location = sourceFile.getLineAndCharacterOfPosition(open.getStart());

      if (controlNames.has(name)) {
        const control = {
          file: relative(root, file),
          page: isPageModule(file) ? relative(pageRoot, file) : '',
          line: location.line + 1,
          element: name,
          name: attrs['aria-label'] || attrs.title || attrs.placeholder || text,
          type: attrs.type || '',
          handler: attrs.onClick || attrs.onSubmit || attrs.onValueChange || attrs.onChange || '',
          destination: attrs.to || attrs.href || '',
          disabled: attrs.disabled || '',
        };
        controls.push(control);
        const list = controlsByFile.get(file) ?? [];
        list.push(control);
        controlsByFile.set(file, list);
      }

      if (name === 'button') {
        if (!attrs.type) addFinding(open, 'BUTTON_TYPE', 'high', 'Native button has no explicit type.');
        if (!text && !attrs['aria-label'] && !attrs['aria-labelledby'] && !attrs.title) addFinding(open, 'BUTTON_NAME', 'high', 'Icon-only button has no accessible name.');
      }
      if (name === 'Button' && !attrs.asChild && !text && !attrs['aria-label'] && !attrs['aria-labelledby'] && !attrs.title) {
        addFinding(open, 'BUTTON_NAME', 'high', 'Icon-only Button has no accessible name.');
      }
      if (['a', 'Link', 'NavLink'].includes(name) && attrs.target === '_blank') {
        const relValue = String(attrs.rel || '');
        if (!relValue.includes('noopener') || !relValue.includes('noreferrer')) addFinding(open, 'BLANK_REL', 'high', 'New-tab link lacks noopener noreferrer.');
      }
      if (name === 'img' && !Object.hasOwn(attrs, 'alt')) addFinding(open, 'IMAGE_ALT', 'high', 'Image has no alt attribute.');
      if (['div', 'span', 'p', 'li'].includes(name) && attrs.onClick && !attrs.role && !attrs.tabIndex) {
        addFinding(open, 'NONINTERACTIVE_CLICK', 'high', 'Non-interactive element has an onClick handler without keyboard semantics.');
      }
      if (name === 'form' && !attrs.onSubmit && !attrs.action) addFinding(open, 'FORM_SUBMIT', 'medium', 'Form has no submit handler or action.');
      if (['Input', 'Textarea', 'input', 'textarea'].includes(name)) {
        const reusablePrimitive = [
          'src/components/ui/input.jsx',
          'src/components/ui/textarea.jsx',
          'src/components/ui/PhoneInput.jsx',
        ].includes(posixPath(relative(root, file)));
        const inputType = String(attrs.type || '');
        if (!reusablePrimitive && !['hidden', 'file'].includes(inputType) && !attrs['aria-label'] && !attrs['aria-labelledby'] && !(attrs.id && labels.has(attrs.id)) && !hasAncestorAccessibleLabel(open)) {
          addFinding(open, 'FIELD_LABEL', 'medium', `${name} has no associated label or accessible name in its module.`);
        }
      }
      if (name === 'SelectTrigger' && !attrs['aria-label'] && !attrs['aria-labelledby'] && !(attrs.id && labels.has(attrs.id))) {
        addFinding(open, 'SELECT_LABEL', 'medium', 'Select trigger has no associated label or accessible name.');
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(sourceFile) === 'window' && node.expression.name.text === 'open') {
      const args = node.arguments.map((argument) => argument.getText(sourceFile));
      if (args[1]?.includes('_blank') && (!args[2]?.includes('noopener') || !args[2]?.includes('noreferrer'))) {
        addFinding(node, 'WINDOW_OPEN', 'high', 'window.open(_blank) lacks noopener,noreferrer.');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const pageExpandedControls = [];
const pageSummaries = pages.map((page) => {
  const pageName = relative(pageRoot, page);
  const closure = transitiveClosure(page, importGraph);
  const directControls = controlsByFile.get(page) ?? [];
  let expandedControls = 0;
  for (const originFile of closure) {
    for (const control of controlsByFile.get(originFile) ?? []) {
      expandedControls += 1;
      pageExpandedControls.push({
        page: pageName,
        origin: relative(root, originFile),
        inherited: originFile === page ? 'false' : 'true',
        line: control.line,
        element: control.element,
        name: control.name,
        type: control.type,
        handler: control.handler,
        destination: control.destination,
        disabled: control.disabled,
      });
    }
  }
  return {
    page: pageName,
    directControls: directControls.length,
    expandedControls,
    localModulesInClosure: closure.size,
  };
});

const byElement = Object.fromEntries([...new Set(controls.map((control) => control.element))]
  .sort().map((element) => [element, controls.filter((control) => control.element === element).length]));
const summary = {
  generatedAt: new Date().toISOString(),
  sourceFiles: files.length,
  pageModules: pages.length,
  directControlDeclarations: controls.length,
  pageExpandedControlInstances: pageExpandedControls.length,
  byElement,
  findings,
  pageSummaries,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, 'ui-control-inventory.json'), `${JSON.stringify({ ...summary, controls }, null, 2)}\n`);
const columns = ['page', 'file', 'line', 'element', 'name', 'type', 'handler', 'destination', 'disabled'];
await writeFile(join(outputDirectory, 'ui-control-inventory.csv'), `${columns.join(',')}\n${controls.map((control) => columns.map((key) => csv(control[key])).join(',')).join('\n')}\n`);
const expandedColumns = ['page', 'origin', 'inherited', 'line', 'element', 'name', 'type', 'handler', 'destination', 'disabled'];
await writeFile(join(outputDirectory, 'page-control-matrix.csv'), `${expandedColumns.join(',')}\n${pageExpandedControls.map((control) => expandedColumns.map((key) => csv(control[key])).join(',')).join('\n')}\n`);
await writeFile(join(outputDirectory, 'page-control-matrix.json'), `${JSON.stringify({ ...summary, controls: pageExpandedControls }, null, 2)}\n`);

console.log(`UI surface audit inspected ${pages.length} page modules and ${controls.length} unique control declarations.`);
console.log(`Expanded page/control matrix contains ${pageExpandedControls.length} control instances including shared components.`);
console.log(`Control breakdown: ${Object.entries(byElement).map(([key, value]) => `${key}=${value}`).join(', ')}`);
if (findings.length) {
  for (const finding of findings) console.error(`${finding.severity.toUpperCase()} ${finding.code} ${finding.file}:${finding.line} ${finding.message}`);
  process.exit(1);
}
console.log('UI surface audit passed: 0 actionable static interaction findings.');
