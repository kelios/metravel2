import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli, runNodeCli, writeJsonFile, writeTextFile } from './cli-test-utils';

const { analyzeGraph, validateLedger, findings, checkFixture, BASELINE_PATH } = require('@/scripts/guard-unimported-modules');
const guardPath = path.resolve(process.cwd(), 'scripts/guard-unimported-modules.js');
type Authority = { commit: string; blob: string };
type Row = { path: string; reason: string; owner: string };
const temporaryRoots: string[] = [];
const ledger = (paths: string[]) => ({ contractVersion: 1, entries: [...paths].sort().map((file): Row => ({ path: file, reason: 'Existing reviewed debt', owner: 'test-fixture/domain' })) });

function fixture(files: Record<string, string> = {}) {
  const root = makeTempDir('metravel-unimported-');
  temporaryRoots.push(root);
  writeJsonFile(path.join(root, 'tsconfig.json'), { compilerOptions: { paths: { '@/*': ['./*'] }, typeRoots: ['./types'] } });
  writeTextFile(path.join(root, '.unimported-modules-fixture'), 'isolated fixture\n');
  for (const [file, text] of Object.entries(files)) writeTextFile(path.join(root, file), text);
  return root;
}

function putLedger(root: string, paths: string[]) {
  writeJsonFile(path.join(root, BASELINE_PATH), ledger(paths));
}

function git(root: string, ...args: string[]) {
  const result = runCli('git', ['-C', root, '-c', 'user.name=Module guard fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', ...args]);
  if (result.status !== 0) throw new Error(`Git fixture failed: ${result.stderr}`);
  return result.stdout.trim();
}

function commit(root: string, message: string) {
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

function authorityAt(root: string, revision = 'HEAD'): Authority {
  return { commit: git(root, 'rev-parse', revision), blob: git(root, 'rev-parse', `${revision}:${BASELINE_PATH}`) };
}

function repository(paths = ['components/debt.ts']) {
  const root = fixture(Object.fromEntries(paths.map((file) => [file, 'export const debt = 1;'])));
  git(root, 'init', '--quiet', '--initial-branch=main');
  const before = commit(root, 'Before ledger initialization');
  putLedger(root, paths);
  commit(root, 'Reviewed first ledger introduction');
  return { root, before, authority: authorityAt(root) };
}

function cleanGraph(root: string) {
  const graph = analyzeGraph(root);
  expect(graph.errors).toEqual([]);
  return graph;
}

function checked(root: string, authority: Authority) {
  const result = checkFixture(root, authority);
  expect(result.graph.errors).toEqual([]);
  return result;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removeDir(root);
});

describe('module production reachability', () => {
  it('follows aliases, barrels and default route reexports by path identity', () => {
    const root = fixture({
      'app/index.tsx': "export { default } from '@/components/barrel';",
      'components/barrel/index.ts': "export { default } from '../Screen'; export { value } from '../../utils/value';",
      'components/Screen.tsx': 'export default function Screen() { return null; }',
      'utils/value.ts': 'export const value = 1;',
      'utils/notImported.ts': 'export const value = 1;',
    });
    const graph = cleanGraph(root);
    expect(graph.unreachable).toEqual(['utils/notImported.ts']);
    expect(graph.runtime).toEqual(['app/index.tsx', 'components/Screen.tsx', 'components/barrel/index.ts', 'utils/value.ts'].sort());
    expect(findings(graph, ledger([]))).toEqual([{ path: 'utils/notImported.ts', kind: 'unreachable' }]);
  });

  it('keeps test-only dependencies, root and app helpers, and isolated cycles dead', () => {
    const root = fixture({
      'app/index.tsx': 'export default function Route() { return null; }',
      'app/helper.ts': 'export const helper = 1;',
      'queryClient.ts': 'export const client = 1;',
      'utils/cycleA.ts': "import './cycleB'; export const a = 1;",
      'utils/cycleB.ts': "import './cycleA'; export const b = 1;",
      'components/unitOnly.ts': 'export const unitOnly = 1;',
      'components/e2eOnly.ts': 'export const e2eOnly = 1;',
      '__tests__/consumer.test.ts': "import '@/components/unitOnly';",
      'e2e/consumer.spec.ts': "import '@/components/e2eOnly';",
      'jest.config.js': "require('./components/unitOnly');",
      'playwright.config.ts': "import './components/e2eOnly';",
    });
    expect(cleanGraph(root).unreachable).toEqual(['app/helper.ts', 'components/e2eOnly.ts', 'components/unitOnly.ts', 'queryClient.ts', 'utils/cycleA.ts', 'utils/cycleB.ts']);
  });

  it('recognizes reserved native-intent/API entries and platform route families by exports', () => {
    const root = fixture({
      'app/+native-intent.tsx': "import '@/utils/intent'; export function redirectSystemPath() {}",
      'app/items+api.ts': "import '@/utils/server'; export async function GET() {}",
      'app/index.web.tsx': 'export default () => null;',
      'app/index.native.tsx': 'export default () => null;',
      'app/invalid+api.ts': 'export const helper = 1;',
      'app/not-a-route.d.ts': 'export interface RouteData {}',
      'utils/intent.ts': 'export const intent = 1;',
      'utils/server.ts': 'export const server = 1;',
    });
    const graph = cleanGraph(root);
    expect(graph.unreachable).toEqual(['app/invalid+api.ts', 'app/not-a-route.d.ts']);
    expect(graph.runtime).toEqual(expect.arrayContaining(['app/+native-intent.tsx', 'app/items+api.ts', 'app/index.native.tsx', 'app/index.web.tsx', 'utils/intent.ts', 'utils/server.ts']));
  });

  it('does not root app helpers through erased default or reserved-name declarations', () => {
    const root = fixture({
      'app/type-helper.ts': 'export default interface Model {}',
      'app/types+api.ts': 'export type GET = () => void;',
      'app/declared+api.ts': 'export declare function GET(): void;',
      'app/+native-intent.ts': 'export type redirectSystemPath = () => void;',
    });
    const graph = cleanGraph(root);
    expect(graph.entries).toEqual([]);
    expect(graph.runtime).toEqual([]);
    expect(graph.unreachable).toEqual(['app/+native-intent.ts', 'app/declared+api.ts', 'app/type-helper.ts', 'app/types+api.ts']);
  });

  it.each([
    ['interface alias', 'app/helper.ts', 'interface Model {} export { Model as default };'],
    ['interface default identifier', 'app/helper.ts', 'interface Model {} export default Model;'],
    ['type alias', 'app/helper.ts', 'type Model = {}; export { Model as default };'],
    ['type-only namespace', 'app/helper.ts', 'namespace Model { export interface Value {} } export { Model as default };'],
    ['named type import', 'app/helper.ts', "import type { Named as Model } from '@/types/model'; export { Model as default };"],
    ['inline type import', 'app/helper.ts', "import { type Named as Model } from '@/types/model'; export { Model as default };"],
    ['default type import', 'app/helper.ts', "import type Model from '@/types/model'; export default Model;"],
    ['namespace type import', 'app/helper.ts', "import type * as Model from '@/types/model'; export { Model as default };"],
    ['API type alias', 'app/helper+api.ts', 'type Handler = () => void; export { Handler as GET };'],
    ['intent interface alias', 'app/+native-intent.ts', 'interface Handler {} export { Handler as redirectSystemPath };'],
  ])('does not root %s through a locally erased export binding', (_label, file, source) => {
    const root = fixture({ [file]: source, 'types/model.ts': 'export default interface Model {} export interface Named {}' });
    const graph = cleanGraph(root);
    expect(graph.entries).toEqual([]);
    expect(graph.runtime).toEqual([]);
    expect(graph.unreachable).toContain(file);
    expect(findings(graph, ledger([]))).toContainEqual({ path: file, kind: 'unreachable' });
  });

  it.each([
    ['function alias', 'app/index.tsx', 'function Screen() { return null; } export { Screen as default };'],
    ['interface/function merge', 'app/index.tsx', 'interface Screen {} function Screen() { return null; } export { Screen as default };'],
    ['interface/class merge', 'app/index.tsx', 'interface Screen {} class Screen {} export default Screen;'],
    ['type/value name pair', 'app/index.tsx', 'type Screen = {}; const Screen = () => null; export { Screen as default };'],
    ['runtime namespace', 'app/index.tsx', 'namespace Screen { export const value = 1; } export { Screen as default };'],
    ['ambient value alias', 'app/index.tsx', 'declare const Screen: unknown; export { Screen as default };'],
    ['ambient value identifier', 'app/index.tsx', 'declare function Screen(): void; export default Screen;'],
    ['runtime import alias', 'app/index.tsx', "interface Model {} import Screen from '@/components/Screen'; export { Screen as default };"],
    ['runtime reexport', 'app/index.tsx', "interface Model {} export { default } from '@/components/Screen';"],
    ['API value alias', 'app/items+api.ts', 'type Request = {}; function handler() {} export { handler as GET };'],
    ['intent value alias', 'app/+native-intent.ts', 'interface Intent {} function redirect() {} export { redirect as redirectSystemPath };'],
  ])('preserves %s as an emitted runtime entry', (_label, file, source) => {
    const root = fixture({ [file]: source, 'components/Screen.tsx': 'export default function Screen() { return null; }' });
    const graph = cleanGraph(root);
    expect(graph.entries).toContainEqual(expect.objectContaining({ path: file, kind: 'runtime' }));
    expect(graph.runtime).toContain(file);
    expect(graph.unreachable).not.toContain(file);
  });

  it('retains neutral base/web/native/iOS/Android paths and adapter reexports', () => {
    const root = fixture({
      'entry.js': "require('@/components/Adapter');",
      'components/Adapter.ts': 'export const value = 1;',
      'components/Adapter.web.ts': 'export const value = 1;',
      'components/Adapter.native.ts': 'export const value = 1;',
      'components/Adapter.ios.ts': 'export const value = 1;',
      'components/Adapter.android.ts': "export { value } from './Adapter.ios';",
    });
    expect(cleanGraph(root).unreachable).toEqual([]);
  });

  it('uses extension-before-platform Metro winners rather than marking every sibling live', () => {
    const root = fixture({
      'entry.js': "require('./components/Adapter'); require('./components/IndexOnly');",
      'components/Adapter.ts': 'export const value = 1;',
      'components/Adapter.web.tsx': 'export const value = 1;',
      'components/Adapter.native.js': 'export const value = 1;',
      'components/IndexOnly/index.ts': 'export const value = 1;',
      'components/IndexOnly/index.web.ts': 'export const value = 1;',
    });
    const graph = cleanGraph(root);
    expect(graph.unreachable).toEqual(['components/Adapter.native.js', 'components/Adapter.web.tsx']);
    expect(graph.runtime).toEqual(expect.arrayContaining(['components/Adapter.ts', 'components/IndexOnly/index.ts', 'components/IndexOnly/index.web.ts']));
  });

  it('keeps explicit platform/extension identities precise and substitutes absent JS with TS', () => {
    const root = fixture({
      'entry.js': "require('./components/Only.web'); require('./utils/exact.js'); require('./utils/substitute.js');",
      'components/Only.web.ts': 'export const value = 1;',
      'components/Only.ts': 'export const value = 1;',
      'components/Only.ios.ts': 'export const value = 1;',
      'utils/exact.js': 'exports.value = 1;',
      'utils/exact.ts': 'export const value = 1;',
      'utils/substitute.ts': 'export const value = 1;',
    });
    expect(cleanGraph(root).unreachable).toEqual(['components/Only.ios.ts', 'components/Only.ts', 'utils/exact.ts']);
  });

  it('collects literal lazy/import-equals forms without interpreting comments or unrelated strings', () => {
    const root = fixture({
      'app/index.tsx': "import('./../utils/dynamic'); require(`../utils/required`); import Equal = require('../utils/equal'); export default () => null; // require('../utils/comment')\nconst prose = \"import('../utils/string')\"; /* import '../utils/comment'; */",
      'utils/dynamic.ts': 'export const value = 1;',
      'utils/required.ts': 'export const value = 1;',
      'utils/equal.ts': 'export const value = 1;',
      'utils/comment.ts': 'export const value = 1;',
      'utils/string.ts': 'export const value = 1;',
    });
    expect(cleanGraph(root).unreachable).toEqual(['utils/comment.ts', 'utils/string.ts']);
  });

  it('records type-only/import-type/reference/ambient augmentation dependencies as compile-time usage', () => {
    const root = fixture({
      'app/index.tsx': "import type { Model } from '@/types/model'; import { type Named } from '@/types/named'; export type { Reexported } from '@/types/reexported'; type Inline = import('@/types/inline').Inline; export default () => null;",
      'types/model.ts': "import { Nested } from './nested'; export interface Model extends Nested {}",
      'types/named.ts': 'export interface Named {}',
      'types/nested.ts': 'export interface Nested {}',
      'types/reexported.ts': 'export interface Reexported {}',
      'types/inline.ts': 'export interface Inline {}',
      'types/ambient.d.ts': '/// <reference path="./reference.d.ts" />\ndeclare module "external-package" { export const value: number; }',
      'types/reference.d.ts': 'export interface Reference {}',
      'types/augmentation.d.ts': 'export {}; declare module "external-package" { interface Additional {} }',
      'types/unused.ts': 'export interface Unused {}',
      'types/unconfigured.d.ts': 'export interface Unconfigured {}',
    });
    const graph = cleanGraph(root);
    expect(graph.type).toEqual(['types/ambient.d.ts', 'types/augmentation.d.ts', 'types/inline.ts', 'types/model.ts', 'types/named.ts', 'types/nested.ts', 'types/reexported.ts', 'types/reference.d.ts']);
    expect(graph.runtime).toEqual(['app/index.tsx']);
    expect(graph.unreachable).toEqual(['types/unconfigured.d.ts', 'types/unused.ts']);
  });

  it('never executes source, config or tooling code', () => {
    const root = fixture();
    const marker = path.join(root, 'EXECUTED');
    const dangerous = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('Executed source');`;
    writeTextFile(path.join(root, 'app.config.js'), dangerous);
    writeTextFile(path.join(root, 'scripts/tool.js'), dangerous);
    writeTextFile(path.join(root, 'components/dead.js'), dangerous);
    expect(cleanGraph(root).unreachable).toEqual(['components/dead.js']);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('retains explicitly configured declaration files without rooting ordinary type-directory modules', () => {
    const root = fixture({
      'types/selected.d.ts': 'export interface Selected {}',
      'types/unselected.d.ts': 'export interface Unselected {}',
      'types/ordinary.ts': 'export interface Ordinary {}',
    });
    writeJsonFile(path.join(root, 'tsconfig.json'), { files: ['./types/selected.d.ts'] });
    const graph = cleanGraph(root);
    expect(graph.type).toEqual(['types/selected.d.ts']);
    expect(graph.runtime).toEqual([]);
    expect(graph.unreachable).toEqual(['types/ordinary.ts', 'types/unselected.d.ts']);
  });

  it('terminates builtin/package/asset imports and excluded test trees without granting their dependencies liveness', () => {
    const root = fixture({
      'entry.js': "require('node:fs'); require('external-package'); require('./image.png'); require('./__tests__/consumer.test.ts');",
      '__tests__/consumer.test.ts': "import '@/utils/testOnly';",
      'utils/testOnly.ts': 'export const value = 1;',
      'image.png': 'fixture asset bytes',
    });
    const graph = cleanGraph(root);
    expect(graph.runtime).toEqual(['entry.js']);
    expect(graph.unreachable).toEqual(['utils/testOnly.ts']);
  });

  it.each([
    ['missing literal', "import '@/utils/missing'; export default () => null;", 'resolution-error'],
    ['missing reference', '/// <reference path="../types/missing.d.ts" />\nexport default () => null;', 'resolution-error'],
    ['syntax error', 'export default function () { const value = ; }', 'parse-error'],
    ['escaping path', "import '../../outside'; export default () => null;", 'resolution-error'],
    ['opaque application loader', 'const target = "../utils/" + process.argv[2]; require(target); export default () => null;', 'opaque-loader'],
  ])('refuses %s with importer context', (_label, source, kind) => {
    const graph = analyzeGraph(fixture({ 'app/index.tsx': source }));
    expect(graph.errors).toEqual(expect.arrayContaining([expect.objectContaining({ kind, importer: 'app/index.tsx' })]));
  });

  it('refuses symlink dependencies escaping repository containment', () => {
    const outside = fixture({ 'outside.ts': 'export const value = 1;' });
    const root = fixture({ 'entry.js': "require('./utils/link');" });
    fs.mkdirSync(path.join(root, 'utils'));
    fs.symlinkSync(path.join(outside, 'outside.ts'), path.join(root, 'utils/link.ts'));
    expect(() => analyzeGraph(root)).toThrow(/source symlink escapes repository: utils\/link.ts/);
  });

  it('includes confined root source symlinks as candidates and rejects escaping root symlinks', () => {
    const root = fixture({ 'utils/orphan.ts': 'export const value = 1;' });
    fs.symlinkSync(path.join(root, 'utils/orphan.ts'), path.join(root, 'rootOrphan.ts'));
    expect(cleanGraph(root).unreachable).toEqual(['rootOrphan.ts', 'utils/orphan.ts']);
    const outside = fixture({ 'outside.ts': 'export const value = 1;' });
    fs.symlinkSync(path.join(outside, 'outside.ts'), path.join(root, 'escaped.ts'));
    expect(() => analyzeGraph(root)).toThrow(/source symlink escapes repository: escaped.ts/);
  });

  it('refuses root source-directory symlinks outside the repository before indexing their contents', () => {
    const outside = fixture({ 'components/external.ts': 'export const external = 1;' });
    const root = fixture();
    fs.symlinkSync(path.join(outside, 'components'), path.join(root, 'components'));
    expect(() => analyzeGraph(root)).toThrow(/source directory missing containment: components/);
  });

  it('retains internal root-directory aliases with confined source provenance', () => {
    const root = fixture({ 'entry.js': "require('./components/live');", 'local-source/live.ts': 'export const value = 1;' });
    fs.symlinkSync(path.join(root, 'local-source'), path.join(root, 'components'));
    const graph = cleanGraph(root);
    expect(graph.runtime).toEqual(['components/live.ts', 'entry.js']);
    expect(graph.sourceManifest.map((item: { path: string }) => item.path)).toEqual(['components/live.ts', 'entry.js']);
  });

  it('indexes nested confined directory aliases without exempting their orphan modules', () => {
    const root = fixture({
      'entry.js': "require('./components/alias/live');",
      'local-source/live.ts': 'export const value = 1;',
      'local-source/orphan.ts': 'export const value = 1;',
    });
    fs.mkdirSync(path.join(root, 'components'));
    fs.symlinkSync(path.join(root, 'local-source'), path.join(root, 'components/alias'));
    const graph = cleanGraph(root);
    expect(graph.runtime).toEqual(['components/alias/live.ts', 'entry.js']);
    expect(graph.unreachable).toEqual(['components/alias/orphan.ts']);
    expect(graph.sourceManifest.map((item: { path: string }) => item.path)).toEqual(['components/alias/live.ts', 'components/alias/orphan.ts', 'entry.js']);
  });

  it('refuses escaping nested directory aliases before reading their source', () => {
    const outside = fixture({ 'external/orphan.ts': 'export const value = 1;' });
    const root = fixture();
    fs.mkdirSync(path.join(root, 'components'));
    fs.symlinkSync(path.join(outside, 'external'), path.join(root, 'components/alias'));
    expect(() => analyzeGraph(root)).toThrow(/source directory missing containment: components\/alias/);
  });

  it('refuses directory alias cycles instead of recursing indefinitely', () => {
    const root = fixture({ 'components/orphan.ts': 'export const value = 1;' });
    fs.symlinkSync(path.join(root, 'components'), path.join(root, 'components/loop'));
    expect(() => analyzeGraph(root)).toThrow(/source directory symlink cycle: components\/loop/);
  });

  it('refuses an external tsconfig symlink without reading the external source policy', () => {
    const outside = fixture();
    const root = fixture();
    fs.unlinkSync(path.join(root, 'tsconfig.json'));
    fs.symlinkSync(path.join(outside, 'tsconfig.json'), path.join(root, 'tsconfig.json'));
    expect(analyzeGraph(root).errors).toEqual([expect.objectContaining({ kind: 'invalid-policy', message: 'tsconfig.json must be a confined repository file' })]);
  });

  it.each([
    "function require(value) { return value; } require('../components/dead');",
    "function load(require) { require('../components/dead'); }",
    "function load({ require }) { require('../components/dead'); }",
    "const [require] = [customLoader]; require('../components/dead');",
    "import { require } from 'custom-loader'; require('../components/dead');",
    "try {} catch (require) { require('../components/dead'); }",
    "for (const require of []) { require('../components/dead'); }",
    "function load() { if (true) { var require = customLoader; } require('../components/dead'); }",
    "if (true) { var require = customLoader; } require('../components/dead');",
    "class Loader { static { if (true) { var require = customLoader; } require('../components/dead'); } }",
    "switch (1) { case 1: const require = customLoader; require('../components/dead'); }",
    "const Loader = class require { load() { require('../components/dead'); } };",
    "({ require } = customLoader); require('../components/dead');",
    "({ load: require } = customLoader); require('../components/dead');",
    "[require] = customLoader; require('../components/dead');",
    "for (require of loaders) {} require('../components/dead');",
    "for (require in loaders) {} require('../components/dead');",
    "for ({ require } of loaders) {} require('../components/dead');",
  ])('does not confer liveness through a lexical require binding: %s', (source) => {
    const root = fixture({
      'app/index.tsx': `${source} export default () => null;`,
      'components/dead.ts': 'export const value = 1;',
    });
    expect(cleanGraph(root).unreachable).toEqual(['components/dead.ts']);
  });

  it.each([
    'function load() { var require = customLoader; }',
    'class Loader { static { var require = customLoader; } }',
    'for (const require of loaders) { require("../components/localOnly"); }',
  ])('keeps nested var scopes out of the enclosing require scope: %s', (nested) => {
    const root = fixture({
      'app/index.tsx': `${nested} require('../components/live'); export default () => null;`,
      'components/live.ts': 'export const value = 1;',
    });
    expect(cleanGraph(root).unreachable).toEqual([]);
  });

  it.each([
    'class Loader { require() { require("../components/live"); } }',
    'const loader = { require() { require("../components/live"); } };',
  ])('does not treat a method name as a lexical require binding: %s', (source) => {
    const root = fixture({
      'app/index.tsx': `${source} export default () => null;`,
      'components/live.ts': 'export const value = 1;',
    });
    expect(cleanGraph(root).unreachable).toEqual([]);
  });
});

describe('operator tooling data boundary', () => {
  it.each([
    ['direct parameter', 'function load(input) { return require(path.resolve(process.cwd(), input)); }'],
    ['immutable alias', 'function load(input) { const resolved = path.resolve(process.cwd(), input); return require(resolved); }'],
    ['parameter alias', 'function load(input) { const selected = input; return require(path.resolve(process.cwd(), selected)); }'],
    ['verified CLI result', "const { parseCliArgs } = require('./lib/cli-contract'); const CLI_SPEC = {}; const args = parseCliArgs(process.argv, CLI_SPEC); require(path.resolve(process.cwd(), args.input));"],
    ['cache clearing', 'function load(input) { const resolved = path.resolve(process.cwd(), input); delete require.cache[require.resolve(resolved)]; return require(resolved); }'],
  ])('allows %s only with zero inferred target edges', (_label, loader) => {
    const root = fixture({
      'scripts/operator.js': `const path = require('node:path'); ${loader}`,
      'scripts/lib/cli-contract.js': 'exports.parseCliArgs = () => ({});',
      'components/operatorSelected.ts': 'export const data = 1;',
    });
    const graph = cleanGraph(root);
    expect(graph.unreachable).toEqual(['components/operatorSelected.ts']);
    expect(graph.toolingInputs).toEqual([expect.objectContaining({ importer: 'scripts/operator.js', line: expect.any(Number), expression: expect.any(String), reason: expect.any(String) })]);
    expect(graph.provenance['components/operatorSelected.ts']).toBeUndefined();
  });

  it.each([
    ['source-controlled prefix', 'function load(input) { require(path.resolve(process.cwd(), "components/" + input)); }'],
    ['interpolated template', 'function load(input) { require(path.resolve(process.cwd(), `components/${input}`)); }'],
    ['arbitrary call', 'function load(input) { require(path.resolve(process.cwd(), transform(input))); }'],
    ['mutated parameter', 'function load(input) { input = "components/data"; require(path.resolve(process.cwd(), input)); }'],
    ['mutable alias', 'function load(input) { let target = path.resolve(process.cwd(), input); require(target); }'],
    ['shadowed path', 'function load(input, path) { require(path.resolve(process.cwd(), input)); }'],
    ['non-namespace path import', "import { resolve as fakePath } from 'node:path'; function load(input) { require(fakePath.resolve(process.cwd(), input)); }"],
    ['non-namespace path destructure', "const { path: fakePath } = require('node:path'); function load(input) { require(fakePath.resolve(process.cwd(), input)); }"],
    ['modified path resolver', 'path.resolve = customResolve; function load(input) { require(path.resolve(process.cwd(), input)); }'],
    ['shadowed process', 'function load(input, process) { require(path.resolve(process.cwd(), input)); }'],
    ['modified process cwd', 'process.cwd = customCwd; function load(input) { require(path.resolve(process.cwd(), input)); }'],
    ['modified process argv getter', 'process.argv = ["components/data"]; function getArg() { return process.argv[0]; } const input = getArg(); require(path.resolve(process.cwd(), input));'],
    ['unverified CLI-like getter', 'function getArg() { const prose = "process.argv"; return "components/data"; } const input = getArg(); require(path.resolve(process.cwd(), input));'],
    ['unverified CLI parser', 'const args = parseCliArgs(process.argv, {}); require(path.resolve(process.cwd(), args.input));'],
    ['different CLI export', "const { other: parseCliArgs } = require('./lib/cli-contract'); const args = parseCliArgs(process.argv, {}); require(path.resolve(process.cwd(), args.input));"],
    ['modified CLI parser', "let { parseCliArgs } = require('./lib/cli-contract'); parseCliArgs = customParser; const args = parseCliArgs(process.argv, {}); require(path.resolve(process.cwd(), args.input));"],
    ['modified CLI result', "const { parseCliArgs } = require('./lib/cli-contract'); const args = parseCliArgs(process.argv, {}); args.input = 'components/data'; require(path.resolve(process.cwd(), args.input));"],
    ['destructured path resolver mutation', '({ resolve: path.resolve } = customResolver); function load(input) { require(path.resolve(process.cwd(), input)); }'],
    ['destructured process cwd mutation', '[process.cwd] = customResolver; function load(input) { require(path.resolve(process.cwd(), input)); }'],
    ['deleted path resolver', 'delete path.resolve; require(path.resolve(process.cwd(), "components/data"));'],
    ['deleted process cwd', 'delete process.cwd; function load(input) { require(path.resolve(process.cwd(), input)); }'],
    ['deleted package resolver', 'delete require.resolve; require(path.join(path.dirname(require.resolve("external-package")), "helper.js"));'],
    ['for-of resolver assignment', 'for (path.resolve of resolvers) {} require(path.resolve(process.cwd(), "components/data"));'],
    ['for-in cwd assignment', 'for (process.cwd in resolvers) {} function load(input) { require(path.resolve(process.cwd(), input)); }'],
  ])('refuses %s rather than guessing module targets', (_label, loader) => {
    const graph = analyzeGraph(fixture({ 'scripts/operator.js': `const path = require('path'); ${loader}`, 'scripts/lib/cli-contract.js': 'exports.parseCliArgs = () => ({});' }));
    expect(graph.toolingInputs).toEqual([]);
    expect(graph.errors).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'opaque-loader', importer: 'scripts/operator.js' })]));
  });

  it('refuses an otherwise permitted loader when its script is application-reachable', () => {
    const graph = analyzeGraph(fixture({
      'app/index.tsx': "import '@/scripts/operator'; export default () => null;",
      'scripts/operator.js': "const path = require('node:path'); export function load(input) { require(path.resolve(process.cwd(), input)); }",
    }));
    expect(graph.toolingInputs).toEqual([]);
    expect(graph.errors).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'opaque-loader', importer: 'scripts/operator.js' })]));
  });

  it('preserves exact fixed tooling loads as source dependencies', () => {
    const root = fixture({
      'scripts/tool.js': "const path = require('path'); const source = path.resolve(process.cwd(), 'components/data.ts'); require(source);",
      'components/data.ts': 'export const data = 1;',
      'components/unrelated.ts': 'export const data = 1;',
    });
    const graph = cleanGraph(root);
    expect(graph.toolingInputs).toEqual([]);
    expect(graph.unreachable).toEqual(['components/unrelated.ts']);
  });
});

describe('exact reviewed ledger metadata and findings', () => {
  it.each([
    ['version', { contractVersion: 2, entries: [] }],
    ['missing entries', { contractVersion: 1 }],
    ['blank reason', { contractVersion: 1, entries: [{ path: 'utils/a.ts', reason: ' ', owner: 'owner' }] }],
    ['blank owner', { contractVersion: 1, entries: [{ path: 'utils/a.ts', reason: 'reason', owner: '' }] }],
    ['duplicate', { contractVersion: 1, entries: [...ledger(['utils/a.ts']).entries, ...ledger(['utils/a.ts']).entries] }],
    ['unsorted', { contractVersion: 1, entries: ledger(['utils/a.ts', 'utils/b.ts']).entries.reverse() }],
    ...['/utils/a.ts', '../utils/a.ts', 'utils/../a.ts', 'utils\\a.ts', '__tests__/a.test.ts', 'utils/a.json'].map((invalid) => [invalid, { contractVersion: 1, entries: [{ path: invalid, reason: 'reason', owner: 'owner' }] }]),
  ])('rejects %s as invalid ledger policy', (_label, value) => {
    expect(() => validateLedger(value)).toThrow(/invalid-ledger/);
  });

  it('sorts distinct unreachable and stale-baseline findings by repository path', () => {
    const root = fixture({ 'entry.js': "require('./utils/live');", 'utils/live.ts': 'export const value = 1;', 'components/orphan.ts': 'export const value = 1;' });
    expect(findings(cleanGraph(root), ledger(['utils/deleted.ts', 'utils/live.ts']))).toEqual([
      { path: 'components/orphan.ts', kind: 'unreachable' },
      { path: 'utils/deleted.ts', kind: 'stale-baseline' },
      { path: 'utils/live.ts', kind: 'stale-baseline' },
    ]);
  });
});

describe('real Git initial authority and shrink-only history', () => {
  it('accepts the independently fixed first committed introduction', () => {
    const { root, authority } = repository();
    expect(checked(root, authority).violations).toEqual([]);
  });

  it('never initializes from an unpinned working or committed ledger', () => {
    const { root } = repository();
    expect(() => checkFixture(root, {})).toThrow(/initial authority not established/);
  });

  it('confines fixture authority injection to a marked temporary repository', () => {
    const { root, authority } = repository();
    fs.unlinkSync(path.join(root, '.unimported-modules-fixture'));
    expect(() => checkFixture(root, authority)).toThrow(/isolated marked fixture/);
    expect(() => checkFixture(process.cwd(), authority)).toThrow(/isolated marked fixture/);
  });

  it('verifies pinned blob identity and complete commit identifiers', () => {
    const { root, authority } = repository();
    expect(() => checkFixture(root, { ...authority, blob: '0'.repeat(40) })).toThrow(/pinned initial ledger blob/);
    expect(() => checkFixture(root, { ...authority, commit: authority.commit.slice(0, 8) })).toThrow(/full commit and blob/);
  });

  it('rejects authority on an unrelated branch even when the ledger blob is identical', () => {
    const { root, before, authority } = repository();
    git(root, 'checkout', '--quiet', '-b', 'unrelated', before);
    putLedger(root, ['components/debt.ts']);
    commit(root, 'Independent identical ledger');
    expect(() => checkFixture(root, authority)).toThrow(/missing-history/);
  });

  it('refuses selecting a later revision as a new first authority', () => {
    const { root } = repository();
    const updated = ledger(['components/debt.ts']);
    updated.entries[0].reason = 'Corrected reason';
    writeJsonFile(path.join(root, BASELINE_PATH), updated);
    commit(root, 'Metadata revision is not initialization');
    expect(() => checkFixture(root, authorityAt(root))).toThrow(/sole first ledger introduction/);
  });

  it('accepts accountable metadata correction and legitimate committed/working shrink', () => {
    const { root, authority } = repository(['components/a.ts', 'components/b.ts']);
    const corrected = ledger(['components/a.ts', 'components/b.ts']);
    corrected.entries[0].owner = 'reviewed/domain';
    writeJsonFile(path.join(root, BASELINE_PATH), corrected);
    commit(root, 'Metadata correction');
    expect(checked(root, authority).violations).toEqual([]);
    fs.unlinkSync(path.join(root, 'components/a.ts'));
    putLedger(root, ['components/b.ts']);
    commit(root, 'Remove first debt');
    fs.unlinkSync(path.join(root, 'components/b.ts'));
    putLedger(root, []);
    expect(checked(root, authority).violations).toEqual([]);
  });

  it.each(['working', 'committed', 'committed then reverted'])('rejects %s growth including a new orphan and its own exception', (stage) => {
    const { root, authority } = repository();
    writeTextFile(path.join(root, 'components/new.ts'), 'export const newDebt = 1;');
    putLedger(root, ['components/debt.ts', 'components/new.ts']);
    if (stage !== 'working') commit(root, 'Hidden new dead module');
    if (stage === 'committed then reverted') {
      fs.unlinkSync(path.join(root, 'components/new.ts'));
      putLedger(root, ['components/debt.ts']);
      commit(root, 'Revert growth');
    }
    expect(() => checkFixture(root, authority)).toThrow(/baseline-growth.*components\/new\.ts/);
  });

  it.each(['working', 'committed'])('rejects %s equal-count replacement rather than comparing ledger length', (stage) => {
    const { root, authority } = repository();
    fs.unlinkSync(path.join(root, 'components/debt.ts'));
    writeTextFile(path.join(root, 'components/replacement.ts'), 'export const debt = 1;');
    putLedger(root, ['components/replacement.ts']);
    if (stage === 'committed') commit(root, 'Replace debt path');
    expect(() => checkFixture(root, authority)).toThrow(/baseline-growth.*components\/replacement\.ts/);
  });

  it.each(['deleted', 'reachable'])('reports a %s exception as stale until the row is removed', (state) => {
    const { root, authority } = repository();
    if (state === 'deleted') fs.unlinkSync(path.join(root, 'components/debt.ts'));
    else writeTextFile(path.join(root, 'entry.js'), "require('./components/debt');");
    expect(checked(root, authority).violations).toEqual([{ path: 'components/debt.ts', kind: 'stale-baseline' }]);
    putLedger(root, []);
    expect(checked(root, authority).violations).toEqual([]);
  });

  it.each(['working', 'initial committed', 'later committed'])('refuses %s invalid metadata', (stage) => {
    const { root, before, authority } = repository();
    if (stage === 'initial committed') git(root, 'reset', '--hard', before);
    const invalid = ledger(['components/debt.ts']);
    invalid.entries[0].owner = '';
    writeJsonFile(path.join(root, BASELINE_PATH), invalid);
    if (stage !== 'working') commit(root, 'Invalid metadata');
    const pinned = stage === 'initial committed' ? authorityAt(root) : authority;
    expect(() => checkFixture(root, pinned)).toThrow(/invalid-ledger.*reason and owner/);
  });

  it('refuses malformed working JSON, absent working ledger and committed deletion', () => {
    const { root, authority } = repository();
    writeTextFile(path.join(root, BASELINE_PATH), '{');
    expect(() => checkFixture(root, authority)).toThrow(/invalid-ledger.*malformed JSON/);
    fs.unlinkSync(path.join(root, BASELINE_PATH));
    expect(() => checkFixture(root, authority)).toThrow(/working ledger missing/);
    commit(root, 'Deleted committed ledger');
    expect(() => checkFixture(root, authority)).toThrow(/missing-history.*deletion/);
  });

  it('detects deletion/recreation on a side branch even when the merge restores the original blob', () => {
    const { root, authority } = repository();
    git(root, 'checkout', '--quiet', '-b', 'side');
    fs.unlinkSync(path.join(root, BASELINE_PATH));
    commit(root, 'Delete ledger on side branch');
    putLedger(root, ['components/debt.ts']);
    commit(root, 'Recreate same ledger on side branch');
    git(root, 'checkout', '--quiet', 'main');
    writeTextFile(path.join(root, 'README.md'), 'main branch');
    commit(root, 'Main branch continuation');
    git(root, 'merge', '--quiet', '--no-ff', 'side', '-m', 'Merge recreated ledger');
    expect(() => checkFixture(root, authority)).toThrow(/missing-history.*deletion\/recreation/);
  });

  it('accepts merging a neutral branch forked before the sole initial authority', () => {
    const { root, before, authority } = repository();
    git(root, 'checkout', '--quiet', '-b', 'neutral', before);
    writeTextFile(path.join(root, 'README.md'), 'neutral pre-authority branch');
    commit(root, 'Neutral branch has no ledger');
    git(root, 'checkout', '--quiet', 'main');
    git(root, 'merge', '--quiet', '--no-ff', 'neutral', '-m', 'Merge neutral branch');
    expect(checked(root, authority).violations).toEqual([]);
  });

  it('rejects an independent identical first introduction merged from a pre-authority branch', () => {
    const { root, before, authority } = repository();
    git(root, 'checkout', '--quiet', '-b', 'independent', before);
    putLedger(root, ['components/debt.ts']);
    writeTextFile(path.join(root, 'README.md'), 'independent authority');
    commit(root, 'Second independent introduction');
    git(root, 'checkout', '--quiet', 'main');
    git(root, 'merge', '--quiet', '--no-ff', 'independent', '-m', 'Merge identical independently introduced ledger');
    expect(() => checkFixture(root, authority)).toThrow(/sole first ledger introduction/);
  });

  it('refuses no-history and shallow repositories without silently reinitializing', () => {
    const { root, authority } = repository();
    const shallow = fixture();
    removeDir(shallow);
    git(root, 'clone', '--quiet', '--depth=1', '--no-local', `file://${root}`, shallow);
    expect(() => checkFixture(shallow, authority)).toThrow(/missing-history.*shallow repository/);
    removeDir(path.join(root, '.git'));
    expect(() => checkFixture(root, authority)).toThrow(/missing-history/);
  });

  it('performs normal fixture checking without source, index, refs or Git-file mutation', () => {
    const { root, authority } = repository();
    const snapshot = (): Record<string, string> => {
      const contents: Record<string, string> = {};
      const walk = (dir: string) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, item.name);
          if (item.isDirectory()) walk(file);
          else contents[path.relative(root, file)] = fs.readFileSync(file).toString('base64');
        }
      };
      walk(root);
      return contents;
    };
    const before = snapshot();
    expect(checked(root, authority).violations).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  it.each(['--update', '--initialize', '--accept-current', '--authority=HEAD', '--commit=HEAD', '--root=/tmp'])('exposes no normal CLI %s workaround', (flag) => {
    const result = runNodeCli([guardPath, flag]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/invalid-policy.*no ledger acceptance or authority override/);
  });
});
