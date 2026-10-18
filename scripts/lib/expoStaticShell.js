/**
 * scripts/lib/expoStaticShell.js
 * The Expo static export shell of a generated page: the inline hydration flag
 * read by `expo/src/launch/registerRootComponent.web.tsx` (hydrateRoot vs
 * createRoot) and the server render inside `#root`.
 *
 * A generated page whose `#root` is not the render the browser will produce
 * must not ask for hydration: React rejects the markup (#418) and renders the
 * screen again. Travel pages keep their `#root` and only switch the flag;
 * translated quest members (#2449) also drop the foreign render (see
 * `memberDocumentIssues` in `questSeoContract.js`).
 */

const fs = require('fs')

const HYDRATE_FLAG_SOURCE = 'globalThis\\.__EXPO_ROUTER_HYDRATE__\\s*=\\s*true\\s*;?'
const APP_ROOT_OPEN_SOURCE = '<div\\s+id="root"[^>]*>'

function disableExpoRouterHydration(baseHtml) {
  const hydrateFlag = new RegExp(HYDRATE_FLAG_SOURCE)
  if (!hydrateFlag.test(baseHtml)) return baseHtml
  return baseHtml.replace(hydrateFlag, 'globalThis.__EXPO_ROUTER_HYDRATE__=false;')
}

function appRootOpenings(source) {
  return [...source.matchAll(new RegExp(APP_ROOT_OPEN_SOURCE, 'gi'))]
}

/** Offset of the `</div>` closing the `#root` whose content starts at `contentStart`. */
function appRootClose(source, contentStart) {
  const tags = /<(\/?)div\b[^>]*>/gi
  tags.lastIndex = contentStart
  let depth = 1
  let match
  while ((match = tags.exec(source)) !== null) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return match.index
  }
  return -1
}

/** Keep the `#root` element, drop its server render. Fails on an ambiguous shell. */
function emptyAppRoot(html) {
  const source = String(html)
  const roots = appRootOpenings(source)
  if (roots.length > 1) throw new Error('page carries more than one #root')
  if (!roots.length) return source
  const contentStart = roots[0].index + roots[0][0].length
  const close = appRootClose(source, contentStart)
  if (close === -1) throw new Error('#root is not closed')
  return `${source.slice(0, contentStart)}${source.slice(close)}`
}

const WEB_CHUNK_PREFIX = '/_expo/static/js/web/'
const CHUNK_MANIFEST = /^globalThis\.__METRAVEL_CHUNK_DEPS__\?\?=\{\};globalThis\.__METRAVEL_CHUNK_DEPS__\["(?:[^"\\]|\\.)*"\]=(\[[^\]]*\]);/
const CATCH_ALL_CHUNK = /^\[\.\.\.missing\]-[0-9a-f]+\.js$/

function onlyChunk(files, pattern, label) {
  const found = files.filter((file) => pattern.test(file))
  if (found.length !== 1) throw new Error(`expected one ${label} web chunk, found ${found.length}`)
  return WEB_CHUNK_PREFIX + found[0]
}

/**
 * #2465: what a translated quest member needs on the page before `entry` runs.
 * The member mounts client-side through the `[...missing]` catch-all (#2449)
 * in its URL locale. Loaded on demand, the catch-all route, its shared chunks
 * and the locale catalog formed a serial chain after `entry`; the route
 * suspended, and React's reveal throttle (300 ms after the last fallback) then
 * held the quest screen back another few hundred ms. Registered up front, the
 * modules let expo-router render the route synchronously, as the RU export does
 * with the route chunks it already lists.
 */
function readQuestLocaleBootChunks(jsDir, locales, fileSystem = fs) {
  const files = fileSystem.readdirSync(jsDir).filter((file) => file.endsWith('.js'))
  const route = onlyChunk(files, CATCH_ALL_CHUNK, '[...missing]')
  const manifest = CHUNK_MANIFEST.exec(fileSystem.readFileSync(`${jsDir}/${route.slice(WEB_CHUNK_PREFIX.length)}`, 'utf8'))
  const deps = manifest ? JSON.parse(manifest[1]).filter((dep) => typeof dep === 'string') : []
  return new Map(locales.map((locale) => [locale, [...deps, route, onlyChunk(files, new RegExp(`^locale-${locale}-[0-9a-f]+\\.js$`), `locale-${locale}`)]]))
}

function scriptSrcs(html) {
  return [...String(html).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1])
}

/** Boot chunks the page does not list as scripts (empty = all shipped). */
function missingBootChunks(html, srcs) {
  const present = new Set(scriptSrcs(html))
  return srcs.filter((src) => !present.has(src))
}

/**
 * The same contract checked on a stored member. It reads the page, not the
 * chunk directory: a release `dist` also keeps earlier generations' chunks
 * (asset retention), so «the one `[...missing]` chunk» exists only at export.
 * `readChunk(src)` returns the chunk source for its declared dependencies.
 */
function bootChunkIssues(html, locale, readChunk) {
  const scripts = scriptSrcs(html).filter((src) => src.startsWith(WEB_CHUNK_PREFIX))
  const route = scripts.find((src) => CATCH_ALL_CHUNK.test(src.slice(WEB_CHUNK_PREFIX.length)))
  if (!route) return ['does not ship the [...missing] route chunk']
  const issues = []
  const catalog = new RegExp(`^locale-${locale}-[0-9a-f]+\\.js$`)
  if (!scripts.some((src) => catalog.test(src.slice(WEB_CHUNK_PREFIX.length)))) issues.push(`does not ship the locale-${locale} chunk`)
  const manifest = CHUNK_MANIFEST.exec(String(readChunk(route)))
  const deps = manifest ? JSON.parse(manifest[1]).filter((dep) => typeof dep === 'string') : []
  issues.push(...missingBootChunks(html, deps).map((dep) => `does not ship boot chunk ${dep}`))
  const entry = scripts.findIndex((src) => /\/entry-[^/]+\.js$/.test(src))
  if (entry !== -1 && scripts.indexOf(route) > entry) issues.push('loads the [...missing] route chunk after entry')
  return issues
}

/** Add the missing chunk scripts right before the `entry` script, in order. */
function shipBootChunks(html, srcs) {
  const source = String(html)
  const entry = /<script\b[^>]*\bsrc="\/_expo\/static\/js\/web\/entry-[^"]+"[^>]*><\/script>/i.exec(source)
  if (!entry) throw new Error('page has no Expo entry script')
  const tags = missingBootChunks(source, srcs).map((src) => `<script src="${src}" defer></script>`).join('')
  return `${source.slice(0, entry.index)}${tags}${source.slice(entry.index)}`
}

function appShellState(html) {
  const source = String(html)
  const roots = appRootOpenings(source)
  return {
    hydrates: new RegExp(HYDRATE_FLAG_SOURCE).test(source),
    roots: roots.length,
    emptyRoots: roots.filter((root) => /^\s*<\/div\s*>/i.test(source.slice(root.index + root[0].length))).length,
  }
}

module.exports = {
  appShellState,
  bootChunkIssues,
  disableExpoRouterHydration,
  emptyAppRoot,
  missingBootChunks,
  readQuestLocaleBootChunks,
  shipBootChunks,
}
