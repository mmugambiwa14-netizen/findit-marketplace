import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTE_KEY = '__findit_route';

function normalizeBasePath(value) {
  const basePath = String(value || '').trim();
  if (!/^\/[A-Za-z0-9._~/-]*\/$/.test(basePath) || basePath.includes('//')) {
    throw new Error('Pages base path must be an absolute path ending in one slash.');
  }
  return basePath;
}

export function renderPagesFallback(basePathInput) {
  const basePath = normalizeBasePath(basePathInput);
  const serializedBasePath = JSON.stringify(basePath);
  const serializedRouteKey = JSON.stringify(ROUTE_KEY);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Opening PeekaListing</title>
  </head>
  <body>
    <script>
      (function() {
        var basePath = ${serializedBasePath};
        var routeKey = ${serializedRouteKey};
        var currentPath = window.location.pathname;
        var route = currentPath.startsWith(basePath)
          ? currentPath.slice(basePath.length)
          : '';
        var destination = new URL(basePath, window.location.origin);
        destination.searchParams.set(
          routeKey,
          route + window.location.search + window.location.hash
        );
        window.location.replace(destination.toString());
      })();
    </script>
  </body>
</html>
`;
}

async function main() {
  const [outputDirectory = 'dist', basePath] = process.argv.slice(2);
  const outputPath = resolve(outputDirectory, '404.html');
  await writeFile(outputPath, renderPagesFallback(basePath), 'utf8');
  console.log(`Created Pages SPA fallback at ${outputPath}`);
}

const directRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (directRun) {
  await main();
}
