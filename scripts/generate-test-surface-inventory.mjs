import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'artifacts/certification/test-surface-inventory.json');
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

function posix(path) {
  return path.replaceAll('\\', '/');
}

async function collectFiles(directory, predicate = () => true, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, predicate, output);
    else if (predicate(path)) output.push(path);
  }
  return output;
}

function routeKind(path) {
  if (path.startsWith('/admin')) return 'admin';
  if (['/post', '/create-service', '/my-services', '/saved', '/profile', '/my-listings', '/peek-requests', '/settings', '/chats', '/chats/:conversationId', '/business-profiles', '/notifications'].includes(path)) return 'protected';
  if (['/create', '/messages', '/messages/:conversationId', '/faqs', '/support', '/tours'].includes(path)) return 'compatibility';
  if (path === '*') return 'fallback';
  return 'public';
}

function areaFromPath(path) {
  const name = posix(path).toLowerCase();
  if (name.includes('/admin') || name.includes('admin')) return 'admin';
  if (name.includes('auth') || name.includes('login') || name.includes('register') || name.includes('password') || name.includes('mfa')) return 'auth';
  if (name.includes('business') || name.includes('managedlisting')) return 'business';
  if (name.includes('message') || name.includes('chat') || name.includes('inquir')) return 'messaging';
  if (name.includes('notification')) return 'notifications';
  if (name.includes('tour') || name.includes('peek')) return 'peeks';
  if (name.includes('service')) return 'services';
  if (name.includes('listing') || name.includes('property') || name.includes('machinery') || name.includes('car')) return 'listings';
  if (name.includes('taxonomy') || name.includes('schema')) return 'taxonomy';
  if (name.includes('recommendation') || name.includes('contextual')) return 'recommendations';
  if (name.includes('storage') || name.includes('media') || name.includes('upload') || name.includes('image')) return 'media';
  if (name.includes('location') || name.includes('map') || name.includes('search') || name.includes('discover')) return 'discovery';
  if (name.includes('security') || name.includes('rls') || name.includes('private') || name.includes('privilege')) return 'security';
  if (name.includes('pwa') || name.includes('worker') || name.includes('manifest') || name.includes('deployment') || name.includes('cloudflare')) return 'platform';
  if (name.includes('profile') || name.includes('saved') || name.includes('favourite')) return 'accounts';
  if (name.includes('accessibility') || name.includes('viewport') || name.includes('ui') || name.includes('navigation')) return 'ui';
  return 'foundation';
}

const ownerByArea = Object.freeze({
  admin: 'test:e2e:admin',
  auth: 'test:e2e:auth',
  business: 'test:e2e:business',
  messaging: 'test:e2e:messaging',
  notifications: 'test:e2e:notifications',
  peeks: 'test:e2e:peeks',
  services: 'test:e2e:services',
  listings: 'test:e2e:listings',
  taxonomy: 'test:taxonomy',
  recommendations: 'test:recommendations',
  media: 'test:media',
  discovery: 'test:e2e:public',
  security: 'test:security',
  platform: 'test:pwa',
  accounts: 'test:e2e:accounts',
  ui: 'test:components',
  foundation: 'test:unit',
});

function routeOwner(kind, path) {
  if (kind === 'admin') return { suite: 'test:e2e:admin', spec: 'e2e/admin/admin-critical.spec.js' };
  if (kind === 'protected') return { suite: 'test:e2e:authenticated', spec: 'e2e/authenticated/protected-routes.spec.js' };
  if (kind === 'compatibility') return { suite: 'test:e2e:routing', spec: 'e2e/public/routing.spec.js' };
  if (kind === 'fallback') return { suite: 'test:e2e:public', spec: 'e2e/public/routing.spec.js' };
  if (['/login', '/register', '/forgot-password', '/reset-password'].includes(path)) return { suite: 'test:e2e:auth', spec: 'e2e/auth/auth-foundation.spec.js' };
  if (path === '/peek') return { suite: 'test:e2e:peeks', spec: 'e2e/peeks/peek-catalogue.spec.js' };
  if (path === '/services' || path === '/service/:id') return { suite: 'test:e2e:services', spec: 'e2e/services/services-public.spec.js' };
  if (path.includes(':id') || path.includes(':sellerId')) return { suite: 'test:e2e:details', spec: 'e2e/public/detail-routes.spec.js' };
  return { suite: 'test:e2e:public', spec: 'e2e/public/public-routes.spec.js' };
}

function classificationForTest(path) {
  const area = areaFromPath(path);
  const runtimePriorityAreas = new Set([
    'admin', 'auth', 'business', 'messaging', 'notifications', 'peeks', 'services',
    'listings', 'taxonomy', 'media', 'discovery', 'security', 'platform', 'accounts', 'ui',
  ]);
  if (runtimePriorityAreas.has(area)) {
    return {
      classification: 'strengthen',
      reason: 'Retain the existing contract coverage and add runtime, browser, database, or adversarial coverage at the same boundary.',
    };
  }
  return {
    classification: 'retain',
    reason: 'The test protects a valid deterministic repository contract and remains part of certification.',
  };
}

function extractRoutes(appSource) {
  const lazyMap = new Map();
  for (const match of appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]@\/([^'"]+)['"]\)\);/g)) {
    lazyMap.set(match[1], `src/${match[2]}`);
  }
  const routes = [];
  for (const match of appSource.matchAll(/<Route\b([\s\S]*?)(?:\/>|>)/g)) {
    const attributes = match[1];
    const path = attributes.match(/\bpath=["']([^"']+)["']/)?.[1];
    if (!path) continue;
    const component = attributes.match(/\belement=\{<([A-Za-z0-9_]+)/)?.[1] || '';
    const kind = routeKind(path);
    routes.push({
      path,
      kind,
      component,
      source: lazyMap.get(component) || '',
      owner: routeOwner(kind, path),
    });
  }
  return routes;
}

function extractFeatureFlags(source) {
  const objectBody = source.match(/export const featureFlags\s*=\s*(?:Object\.freeze\()?\{([\s\S]*?)\}\)?;/)?.[1] || '';
  return [...objectBody.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]).sort();
}

function qualifiedName(schema, name) {
  return `${String(schema || 'public').replaceAll('"', '')}.${String(name).replaceAll('"', '')}`;
}

function extractSqlObjects(migrationSources) {
  const tables = new Set();
  const functions = new Set();
  const policies = new Set();
  const triggers = new Set();
  const buckets = new Set();

  for (const { path, source } of migrationSources) {
    for (const match of source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:("?[A-Za-z_][A-Za-z0-9_]*"?)\.)?("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) {
      tables.add(qualifiedName(match[1], match[2]));
    }
    for (const match of source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:("?[A-Za-z_][A-Za-z0-9_]*"?)\.)?("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) {
      functions.add(qualifiedName(match[1], match[2]));
    }
    for (const match of source.matchAll(/create\s+policy\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s+on\s+(?:("?[A-Za-z_][A-Za-z0-9_]*"?)\.)?("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) {
      policies.add(`${qualifiedName(match[3], match[4])}:${match[1] || match[2]}`);
    }
    for (const match of source.matchAll(/create\s+(?:constraint\s+)?trigger\s+("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) {
      triggers.add(`${posix(relative(root, path))}:${match[1].replaceAll('"', '')}`);
    }
    if (/storage\.buckets/i.test(source)) {
      for (const match of source.matchAll(/'(listing-images|marketplace-images|tour-[a-z-]+|[a-z][a-z0-9-]{2,}-media)'/gi)) buckets.add(match[1]);
    }
  }
  return {
    tables: [...tables].sort(),
    functions: [...functions].sort(),
    policies: [...policies].sort(),
    triggers: [...triggers].sort(),
    buckets: [...buckets].sort(),
  };
}

function exportedActions(source) {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)|export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g)]
    .map((match) => match[1] || match[2]);
}

const srcFiles = await collectFiles(resolve(root, 'src'), (path) => sourceExtensions.has(extname(path)));
const testFiles = await collectFiles(resolve(root, 'tests'), (path) => path.endsWith('.test.mjs'));
const sqlTestFiles = await collectFiles(resolve(root, 'supabase/tests'), (path) => path.endsWith('.sql'));
const migrationFiles = await collectFiles(resolve(root, 'supabase/migrations'), (path) => path.endsWith('.sql'));
const edgeDirectories = (await readdir(resolve(root, 'supabase/functions'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
  .map((entry) => entry.name)
  .sort();

const appSource = await readFile(resolve(root, 'src/App.jsx'), 'utf8');
const featureFlagSource = await readFile(resolve(root, 'src/lib/featureFlags.js'), 'utf8');
const routes = extractRoutes(appSource);
const featureFlags = extractFeatureFlags(featureFlagSource).map((name) => {
  const area = areaFromPath(name);
  return { name, area, owner: ownerByArea[area] || 'test:unit' };
});

const existingTests = testFiles.sort().map((path) => {
  const file = posix(relative(root, path));
  const area = areaFromPath(file);
  return { file, area, owner: ownerByArea[area], ...classificationForTest(file) };
});

const databaseTests = sqlTestFiles.sort().map((path) => {
  const file = posix(relative(root, path));
  const area = areaFromPath(file);
  return { file, area, owner: area === 'security' ? 'test:rls' : 'test:db', classification: 'retain' };
});

const interactionPattern = /(?:Dialog|Sheet|Form|Step|Uploader|Gate|Panel|Settings|Moderation|Create|Edit|Delete|Remove|Report|Request)/i;
const interactionSurfaces = [];
const codeModules = [];
for (const path of srcFiles.sort()) {
  const file = posix(relative(root, path));
  const source = await readFile(path, 'utf8');
  const area = areaFromPath(file);
  const actions = exportedActions(source);
  if (file.startsWith('src/repositories/') || file.startsWith('src/services/') || file.startsWith('src/domain/')) {
    codeModules.push({ file, area, owner: ownerByArea[area], exportedActions: actions });
  }
  if (interactionPattern.test(file) || /<(?:form|Dialog|AlertDialog|Sheet)\b/.test(source)) {
    interactionSurfaces.push({ file, area, owner: ownerByArea[area] });
  }
}

const migrationSources = await Promise.all(migrationFiles.map(async (path) => ({ path, source: await readFile(path, 'utf8') })));
const databaseObjects = extractSqlObjects(migrationSources);
const database = {
  tables: databaseObjects.tables.map((name) => ({ name, owner: 'test:db' })),
  functions: databaseObjects.functions.map((name) => {
    const area = areaFromPath(name);
    return { name, area, owner: area === 'security' || area === 'admin' ? 'test:rls' : 'test:db' };
  }),
  policies: databaseObjects.policies.map((name) => ({ name, owner: 'test:rls' })),
  triggers: databaseObjects.triggers.map((name) => ({ name, owner: 'test:db' })),
  buckets: databaseObjects.buckets.map((name) => ({ name, owner: 'test:media' })),
};
const edgeFunctions = edgeDirectories.map((name) => {
  const area = areaFromPath(name);
  return { name, area, owner: ownerByArea[area], suite: `test:edge:${area}` };
});

const orphaned = {
  routes: routes.filter((item) => !item.owner?.suite).map((item) => item.path),
  interactions: interactionSurfaces.filter((item) => !item.owner).map((item) => item.file),
  codeModules: codeModules.filter((item) => !item.owner).map((item) => item.file),
  edgeFunctions: edgeFunctions.filter((item) => !item.owner).map((item) => item.name),
  existingTests: existingTests.filter((item) => !item.classification || !item.owner).map((item) => item.file),
  databaseTests: databaseTests.filter((item) => !item.owner).map((item) => item.file),
  databaseTables: database.tables.filter((item) => !item.owner).map((item) => item.name),
  databaseFunctions: database.functions.filter((item) => !item.owner).map((item) => item.name),
  rlsPolicies: database.policies.filter((item) => !item.owner).map((item) => item.name),
  triggers: database.triggers.filter((item) => !item.owner).map((item) => item.name),
  storageBuckets: database.buckets.filter((item) => !item.owner).map((item) => item.name),
};
const orphanCount = Object.values(orphaned).reduce((total, items) => total + items.length, 0);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repositoryCommit: process.env.GITHUB_SHA || null,
  policy: {
    noProductionData: true,
    destructiveProductionTesting: false,
    runtimeTargets: ['local-supabase', 'authorized-staging'],
    existingTestClassifications: ['retain', 'strengthen', 'consolidate', 'replace', 'obsolete'],
  },
  summary: {
    sourceModules: srcFiles.length,
    routePatterns: routes.length,
    interactionSurfaces: interactionSurfaces.length,
    codeModules: codeModules.length,
    featureFlags: featureFlags.length,
    existingNodeTestFiles: existingTests.length,
    existingSqlTestFiles: databaseTests.length,
    migrations: migrationFiles.length,
    edgeFunctions: edgeFunctions.length,
    databaseTables: database.tables.length,
    databaseFunctions: database.functions.length,
    rlsPolicies: database.policies.length,
    triggers: database.triggers.length,
    storageBuckets: database.buckets.length,
    orphanedSurfaces: orphanCount,
  },
  requiredOwners: ownerByArea,
  routes,
  interactionSurfaces,
  codeModules,
  featureFlags,
  backend: {
    edgeFunctions,
    database,
    migrations: migrationFiles.map((path) => posix(relative(root, path))).sort(),
  },
  existingTests,
  databaseTests,
  plannedRuntimeSuites: [
    'test:unit', 'test:components', 'test:taxonomy', 'test:db', 'test:rls',
    'test:e2e:smoke', 'test:e2e:critical', 'test:e2e:full', 'test:a11y',
    'test:visual', 'test:pwa', 'test:security', 'test:concurrency',
    'test:load:smoke', 'test:load:normal', 'test:exploratory', 'test:certify',
  ],
  orphaned,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Test surface inventory written to ${posix(relative(root, outputPath))}.`);
console.log(`${routes.length} routes, ${interactionSurfaces.length} interaction surfaces, ${edgeFunctions.length} Edge Functions, ${existingTests.length + databaseTests.length} existing test files.`);
console.log(`Orphaned critical surfaces: ${orphanCount}.`);
if (orphanCount > 0) process.exit(1);
