#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { builtinModules } = require('node:module');
const ts = require('typescript');
const { verifiedFontBundle } = require('./prepare-book-renderer-fonts');

const ARTIFACT_NAME = 'metravel-book-renderer';
const DEFAULT_ENTRY = path.relative(path.resolve(__dirname, '..'), require.resolve('../workers/book-renderer/index.ts'));
const EXTERNALS = new Set(['parse5', 'sanitize-html', 'qrcode', 'playwright', 'htmlparser2', 'image-size']);
const BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const PURE_DECLARATIONS = {
  'i18n/config.ts': new Set(['DEFAULT_LOCALE', 'FALLBACK_LOCALE', 'LOCALE_REGISTRY', 'SUPPORTED_LOCALES',
    'isSupportedLocale', 'resolveSupportedLocale', 'getLocaleDefinition', 'hasMultipleProductionLocales']),
  'utils/imageAnalysis.ts': new Set(['getOptimalTextPosition', 'getOptimalOverlayOpacity',
    'getOptimalOverlayColor', 'getOptimalTextColor']),
  'utils/imageProxy.ts': new Set(['OPTIMIZATION_QUERY_PARAMS', 'DIMENSION_LADDER', 'MAX_LADDER_WIDTH',
    'snapDimensionUp', 'snapProxyWidth', 'PROXY_QUERY_PARAMS', 'PROXY_QUALITY_LADDER',
    'snapQuality', 'snapProxyQuality']),
  'utils/mediaPlaceholderIndex.ts': new Set(['MEDIA_ROUTE_PREFIX', 'KEY_BASE', 'decodeSafe', 'resolveMediaPlaceholderKey']),
};
const ALIASES = {
  '@/i18n': 'workers/book-renderer/locale.ts',
  '@/utils/imageAnalysis': 'workers/book-renderer/imageAnalysis.ts',
  '@/utils/mapImageGenerator': 'workers/book-renderer/mapImageGenerator.ts',
  '@/api/travelRoutes': 'workers/book-renderer/travelRoutes.ts',
  '@/utils/routeFileParser': 'workers/book-renderer/travelRoutes.ts',
};
const posix = (value) => value.split(path.sep).join('/');
const comparePaths = ([a], [b]) => a < b ? -1 : a > b ? 1 : 0;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Canonical locale data and image policy are pure; browser/native discovery is app-owned. */
function pureSource(source, file) {
  const allowed = PURE_DECLARATIONS[file];
  if (!allowed) return source;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found = new Set();
  const selected = tree.statements.filter((node) => {
    const names = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map((declaration) => declaration.name.getText(tree))
      : node.name ? [node.name.getText(tree)] : [];
    const keep = names.length > 0 && names.every((name) => allowed.has(name));
    if (keep) names.forEach((name) => found.add(name));
    return keep || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node);
  });
  for (const name of allowed) {
    if (!found.has(name)) throw new Error(`Canonical worker adapter declaration missing: ${file}#${name}`);
  }
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return selected.map((node) => printer.printNode(ts.EmitHint.Unspecified, node, tree)).join('\n');
}

function moduleCalls(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const argument = node.arguments[0];
      if (node.arguments.length !== 1 || !argument || !ts.isStringLiteralLike(argument)) {
        throw new Error(`Worker artifact requires static module references: ${file}`);
      }
      calls.push({ node: argument, specifier: argument.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return calls;
}

function resolveLocal(root, importer, specifier) {
  const alias = ALIASES[specifier];
  const base = alias ? path.resolve(root, alias) : specifier.startsWith('@/')
    ? path.resolve(root, specifier.slice(2)) : specifier.startsWith('.')
      ? path.resolve(root, path.dirname(importer), specifier) : null;
  if (!base) return null;
  const resolved = [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')]
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) throw new Error(`Unresolved worker module: ${importer} -> ${specifier}`);
  let file = posix(path.relative(root, resolved));
  if (file === 'i18n/index.ts') file = 'workers/book-renderer/locale.ts';
  if (file === 'i18n/instance.ts') file = 'workers/book-renderer/localeInstance.ts';
  if (file.startsWith('../') || /^(?:app|components|screens|hooks|context|stores)\//.test(file) ||
    /\.web\.[jt]sx?$/.test(file) || /\.[jt]sx$/.test(file)) {
    throw new Error(`Forbidden app/browser dependency in worker artifact: ${importer} -> ${file}`);
  }
  return file;
}

function schemaVersion(root, file, constant) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const match = source.match(new RegExp(`export const ${constant} = (\\d+) as const`));
  if (!match) throw new Error(`Missing pinned schema: ${file}#${constant}`);
  return Number(match[1]);
}

function printAssetRecipe(root) {
  const file = 'services/pdf-export/segments/printAssetsTypes.ts';
  const tree = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(tree) === 'PRINT_ASSET_RECIPE');
  const object = declaration?.initializer && ts.isAsExpression(declaration.initializer) ? declaration.initializer.expression : declaration?.initializer;
  if (!object || !ts.isObjectLiteralExpression(object)) throw new Error('Missing canonical print asset recipe');
  return Object.fromEntries(object.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Nonliteral print asset recipe');
    const value = property.initializer;
    const parsed = ts.isNumericLiteral(value) ? Number(value.text.replace(/_/g, '')) : ts.isStringLiteral(value) ? value.text
      : value.kind === ts.SyntaxKind.FalseKeyword ? false : value.kind === ts.SyntaxKind.TrueKeyword ? true : undefined;
    if (parsed === undefined) throw new Error('Nonliteral print asset recipe');
    return [property.name.getText(tree), parsed];
  }));
}

function rendererVersion(root) {
  const source = fs.readFileSync(path.join(root, 'types/bookDocument.ts'), 'utf8');
  const value = source.match(/export const BOOK_RENDERER_VERSION = ['"]([^'"]+)['"] as const/)?.[1];
  if (!value || !/^metravel-book-renderer\/\d+\.\d+\.\d+$/.test(value)) throw new Error('Missing pinned renderer identity');
  return value;
}

/** Exact runtime roots reuse the repository's frozen transitive Yarn resolutions. */
function dependencyLock(root, externals) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
  const stanzas = lock.split(/\n(?=\S)/);
  const dependencies = {};
  const aliases = [];
  for (const name of [...externals].sort()) {
    const declared = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    if (!declared) throw new Error(`Worker runtime dependency is undeclared: ${name}`);
    const pattern = `${name}@${declared}`;
    const stanza = stanzas.find((entry) => {
      const header = entry.slice(0, entry.indexOf('\n')).replace(/:$/, '');
      return header.split(/,\s*/).map((value) => value.replace(/^"|"$/g, '')).includes(pattern);
    });
    if (!stanza) throw new Error(`Worker dependency is absent from frozen lock: ${pattern}`);
    const version = stanza.match(/\n {2}version "([^"]+)"/)?.[1];
    if (!version) throw new Error(`Missing locked dependency version: ${pattern}`);
    const installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
    if (installed.version !== version) throw new Error(`Worker dependency differs from frozen lock: ${name}`);
    dependencies[name] = version;
    const exactPattern = `${name}@${version}`;
    if (exactPattern !== pattern) aliases.push(`"${exactPattern}":${stanza.slice(stanza.indexOf('\n'))}`);
  }
  return { dependencies, lock: `${lock.trimEnd()}\n\n${aliases.join('\n\n')}\n` };
}

function buildBookRenderer(options = {}) {
  const root = path.resolve(options.root ?? path.join(__dirname, '..'));
  const renderer = rendererVersion(root);
  const version = renderer.split('/')[1];
  const entry = options.entry ?? DEFAULT_ENTRY;
  const outDir = path.resolve(options.outDir ?? path.join(root, '.codex-temp/book-renderer', version));
  const scratch = path.join(root, '.codex-temp') + path.sep;
  if (!outDir.startsWith(scratch)) throw new Error('Worker build output must be inside ignored .codex-temp/');
  let outputAncestor = outDir;
  while (outputAncestor !== root) {
    if (fs.existsSync(outputAncestor) && fs.lstatSync(outputAncestor).isSymbolicLink()) {
      throw new Error('Worker build output must not traverse symlinks');
    }
    outputAncestor = path.dirname(outputAncestor);
  }
  const compiled = new Map();
  const sources = new Map();
  const externals = new Set();
  const outputName = (file) => file.replace(/\.(?:ts|js)$/, '.js');
  const compile = (file) => {
    if (compiled.has(file)) return;
    compiled.set(file, '');
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    sources.set(file, source);
    if (file.endsWith('.json')) {
      compiled.set(file, json(JSON.parse(source)));
      return;
    }
    let result;
    try { result = ts.transpileModule(pureSource(source, file), {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        esModuleInterop: true, removeComments: true, newLine: ts.NewLineKind.LineFeed },
      reportDiagnostics: true,
    }); } catch (error) { throw new Error(`Worker compilation failed: ${file}: ${error.message}`); }
    const errors = result.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => root, getCanonicalFileName: (value) => value, getNewLine: () => '\n',
    }));
    let code = result.outputText;
    const replacements = [];
    for (const call of moduleCalls(code, file)) {
      const resolved = resolveLocal(root, file, call.specifier);
      if (resolved) {
        try { compile(resolved); }
        catch (error) { throw new Error(`${file} -> ${resolved}: ${error.message}`); }
        let relative = posix(path.relative(path.dirname(outputName(file)), outputName(resolved)));
        if (!relative.startsWith('.')) relative = `./${relative}`;
        replacements.push({ start: call.node.getStart(), end: call.node.end, value: JSON.stringify(relative) });
      } else if (BUILTINS.has(call.specifier.replace(/^node:/, ''))) {
        // Node capabilities live only in the isolated artifact, never in app imports.
      } else if (EXTERNALS.has(call.specifier)) externals.add(call.specifier);
      else throw new Error(`Forbidden runtime dependency in worker artifact: ${file} -> ${call.specifier}`);
    }
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      code = code.slice(0, replacement.start) + replacement.value + code.slice(replacement.end);
    }
    compiled.set(file, code);
  };
  compile(entry);
  const { dependencies, lock } = dependencyLock(root, externals);
  const files = new Map([...compiled].map(([file, content]) => [outputName(file), content]));
  files.set('package.json', json({ name: ARTIFACT_NAME, version, private: true,
    type: 'commonjs', main: outputName(entry), engines: { node: '>=22' }, dependencies }));
  files.set('yarn.lock', lock);
  const fontDir = options.fontDir ?? (entry === DEFAULT_ENTRY
    ? path.join(root, '.codex-temp/book-renderer-fonts') : null);
  if (fontDir) {
    const bundle = verifiedFontBundle(fontDir, root);
    for (const record of bundle.records) files.set(`fonts/${record.path}`, fs.readFileSync(path.join(fontDir, record.path)));
    sources.set('workers/book-renderer/fonts.lock.json', json(bundle.lock));
  }
  const sourceHash = sha256([...sources,
    ['scripts/build-book-renderer.js', fs.readFileSync(__filename, 'utf8')],
    ['scripts/prepare-book-renderer-fonts.js', fs.readFileSync(path.join(__dirname, 'prepare-book-renderer-fonts.js'), 'utf8')]]
    .sort(comparePaths).map(([file, content]) => `${file}\0${content}\0`).join(''));
  const runtime = {
    name: ARTIFACT_NAME,
    renderer_version: renderer,
    document_schema_version: schemaVersion(root, 'types/bookDocument.ts', 'BOOK_DOCUMENT_SCHEMA_VERSION'),
    print_asset_recipe: printAssetRecipe(root),
    print_resource_policy_hash: sha256(JSON.stringify(Object.fromEntries(Object.entries(printAssetRecipe(root)).sort(comparePaths)))),
    print_encoder_pin: (() => {
      const info = JSON.parse(fs.readFileSync(require.resolve('playwright-core/package.json'), 'utf8'));
      const browsers = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'browsers.json'), 'utf8')).browsers;
      const browser = browsers.find(value => value.name === 'chromium');
      if (!browser?.browserVersion || !browser.revision) throw new Error('Missing pinned Chromium identity');
      return { browser_name: 'chromium', playwright_version: info.version, chromium_revision: browser.revision, chromium_version: browser.browserVersion };
    })(),
    prepared_source_schema_version: schemaVersion(root, 'services/pdf-export/segments/types.ts', 'BOOK_SEGMENT_SOURCE_SCHEMA_VERSION'),
    settings_schema_version: schemaVersion(root, 'types/bookSettings.ts', 'BOOK_SETTINGS_SCHEMA_VERSION'),
    entrypoint: outputName(entry),
    source_hash: sourceHash,
    compiler: { name: 'typescript', version: ts.version },
    dependencies,
    fonts: fontDir ? { directory: 'fonts', lock: 'fonts/fonts.lock.json', stylesheet: 'fonts/fonts.css' } : null,
  };
  files.set('renderer-runtime.json', json(runtime));
  const contentHasher = crypto.createHash('sha256');
  for (const [file, content] of [...files].sort(comparePaths)) {
    contentHasher.update(`${file}\0${Buffer.byteLength(content)}\0`).update(content).update('\0');
  }
  const contentHash = contentHasher.digest('hex');
  const manifest = {
    ...runtime,
    content_hash: contentHash,
    files: [...files].sort(comparePaths).map(([file, content]) => ({
      path: file, sha256: sha256(content), size_bytes: Buffer.byteLength(content),
    })),
  };
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length &&
    !fs.existsSync(path.join(outDir, 'renderer-manifest.json'))) {
    throw new Error('Refusing to replace a non-artifact output directory');
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [file, content] of files) {
    const target = path.join(outDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.writeFileSync(path.join(outDir, 'renderer-manifest.json'), json(manifest));
  return { outDir, manifest };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--out', '--fonts'].includes(args[index]) || !args[index + 1]) throw new Error('Usage: node scripts/build-book-renderer.js [--out .codex-temp/path] [--fonts font-directory]');
    options[args[index] === '--out' ? 'outDir' : 'fontDir'] = args[index + 1];
  }
  const result = buildBookRenderer(options);
  process.stdout.write(json({ outDir: result.outDir, ...result.manifest }));
}
module.exports = { buildBookRenderer, moduleCalls, pureSource };
