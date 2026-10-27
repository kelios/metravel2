'use strict'

const fs = require('node:fs')
const path = require('node:path')

// Signature = sorted "name:size" list of every .js chunk currently on disk.
// Returns null if entry-*.js is missing or any chunk is 0 bytes.
// Used to detect when Metro has stopped writing new files (stable signature
// across consecutive polls), so we don't SIGTERM expo while a late chunk is
// still flushing — that ships a 0-byte chunk and produces "ReferenceError:
// __d is not defined → white screen" on prod.
function getJsBundleSignature(buildDir) {
  const webDir = path.join(buildDir, '_expo', 'static', 'js', 'web');
  try {
    const files = fs.readdirSync(webDir).filter((file) => file.endsWith('.js'));
    if (!files.some((file) => file.startsWith('entry-'))) return null;
    const sorted = [...files].sort();
    const parts = [];
    for (const file of sorted) {
      const stat = fs.statSync(path.join(webDir, file));
      if (stat.size === 0) return null;
      parts.push(`${file}:${stat.size}`);
    }
    return parts.join('|');
  } catch {
    return null;
  }
}


function containedFile(baseDir, relativeFile) {
  if (typeof relativeFile !== 'string' || !relativeFile || path.isAbsolute(relativeFile)) {
    throw new Error(`Invalid artifact path: ${relativeFile}`);
  }
  const target = path.resolve(baseDir, relativeFile);
  const relative = path.relative(baseDir, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..') {
    throw new Error(`Artifact path escapes its directory: ${relativeFile}`);
  }
  const realBase = fs.realpathSync(baseDir);
  const realTarget = fs.realpathSync(target);
  const realRelative = path.relative(realBase, realTarget);
  if (realRelative.startsWith(`..${path.sep}`) || realRelative === '..') {
    throw new Error(`Artifact symlink escapes its directory: ${relativeFile}`);
  }
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Missing or empty artifact: ${relativeFile}`);
  }
  return target;
}

// Expo puts routes with more dynamic segments first, so on the server
// `/quests/[city]/[questId]` shadowed `/quests/country/[country]` and
// `/quests/theme/[theme]`, while the client router (static before dynamic)
// opened the real page. The server takes the first match, so order by
// specificity: at the first differing segment a static name precedes a
// dynamic one, which precedes a catch-all; a prefix precedes its extensions.
function routeSegmentRanks(page) {
  return page.split('/')
    .filter((segment) => segment && segment !== 'index' && !/^\(.+\)$/.test(segment))
    .map((segment) => (segment.startsWith('[...') || segment.startsWith('[[') ? 2 : segment.startsWith('[') ? 1 : 0));
}

function compareRouteSpecificity(a, b) {
  const left = routeSegmentRanks(a.page);
  const right = routeSegmentRanks(b.page);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

/** Rewrites the export's route manifest in server matching order (stable). */
function orderServerRoutes(buildDir) {
  const manifestPath = containedFile(path.join(buildDir, 'server'), '_expo/routes.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.htmlRoutes)) throw new Error('Missing SSR manifest htmlRoutes');
  manifest.htmlRoutes = [...manifest.htmlRoutes].sort(compareRouteSpecificity);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return manifest.htmlRoutes.length;
}

function assertServerExport(buildDir) {
  const serverDir = path.join(buildDir, 'server');
  const clientDir = path.join(buildDir, 'client');
  const manifestPath = containedFile(serverDir, '_expo/routes.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.rendering?.mode !== 'ssr' || !Array.isArray(manifest.htmlRoutes) || !manifest.htmlRoutes.length) {
    throw new Error('Expected a nonempty Expo SSR routes manifest');
  }
  if (manifest.htmlRoutes.some((route, index) => index && compareRouteSpecificity(manifest.htmlRoutes[index - 1], route) > 0)) {
    throw new Error('SSR routes manifest is not in specificity order (run orderServerRoutes)');
  }
  const modules = new Set([manifest.rendering.file]);
  const clientAssets = new Set();
  const addAssets = (assets) => {
    if (!assets) return;
    if (!Array.isArray(assets.js) || !Array.isArray(assets.css)) throw new Error('Invalid SSR asset manifest');
    for (const href of assets.js) clientAssets.add(href);
    for (const css of assets.css) {
      if (typeof css === 'string') clientAssets.add(css);
      else if (css?.type === 'css') clientAssets.add(css.href);
      else if (!['inline', 'external'].includes(css?.type)) throw new Error('Invalid SSR stylesheet');
    }
    if (assets.favicon) clientAssets.add(assets.favicon);
  };
  addAssets(manifest.assets);
  for (const key of ['htmlRoutes', 'notFoundRoutes', 'apiRoutes']) {
    if (!Array.isArray(manifest[key])) throw new Error(`Missing SSR manifest ${key}`);
    for (const route of manifest[key]) {
      if (typeof route.namedRegex !== 'string' || typeof route.page !== 'string') throw new Error('Invalid SSR route');
      new RegExp(route.namedRegex);
      if (route.loader) modules.add(route.loader);
      if (key === 'apiRoutes') modules.add(route.file);
      addAssets(route.assets);
    }
  }
  if (manifest.middleware) modules.add(manifest.middleware.file);
  for (const file of modules) {
    if (typeof file !== 'string' || !/\.(?:cjs|mjs|js)$/.test(file)) throw new Error('Invalid SSR module filename');
    containedFile(serverDir, file);
  }
  if (!clientAssets.size || !getJsBundleSignature(clientDir)) throw new Error('SSR export has no complete client bundle');
  for (const href of clientAssets) {
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || /[?#]/.test(href)) {
      throw new Error(`Expected a local SSR asset: ${href}`);
    }
    containedFile(clientDir, decodeURIComponent(href.slice(1)));
  }
  return { manifest, serverDir, clientDir, modules: modules.size, assets: clientAssets.size };
}


module.exports = { getJsBundleSignature, containedFile, assertServerExport, orderServerRoutes, compareRouteSpecificity }
