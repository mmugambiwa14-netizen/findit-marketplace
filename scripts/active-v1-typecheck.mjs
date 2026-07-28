import { resolve } from 'node:path';
import ts from 'typescript';
import { collectActiveV1SourceGraph } from './lib/activeV1SourceGraph.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const graph = collectActiveV1SourceGraph(projectRoot);
const sourceFiles = graph.files.filter((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file));
const configPath = resolve(projectRoot, 'jsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);

if (config.error) {
  console.error(ts.formatDiagnosticsWithColorAndContext([config.error], {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n',
  }));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
const program = ts.createProgram({
  rootNames: sourceFiles,
  options: { ...parsed.options, noEmit: true },
});
const activeFiles = new Set(sourceFiles.map((file) => resolve(file).toLowerCase()));
const diagnostics = ts.getPreEmitDiagnostics(program).filter(
  (diagnostic) => !diagnostic.file
    || activeFiles.has(resolve(diagnostic.file.fileName).toLowerCase()),
);

if (diagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n',
  }));
  console.error(
    `Active V1 typecheck failed: ${diagnostics.length} diagnostics across ${sourceFiles.length} source modules.`,
  );
  process.exit(1);
}

console.log(`Active V1 typecheck passed: ${sourceFiles.length} source modules.`);
