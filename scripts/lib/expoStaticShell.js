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
const { parseDocument, DomUtils } = require('htmlparser2')

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
const CHUNK_MANIFEST = /^globalThis\.__METRAVEL_CHUNK_DEPS__\?\?=\{\};globalThis\.__METRAVEL_CHUNK_DEPS__\["(?:[^"\\]|\\.)*"\]=(\[(?:[^\]"\\]|"(?:[^"\\]|\\.)*")*\]);/
const CATCH_ALL_CHUNK = /^\[\.\.\.missing\]-[0-9a-f]+\.js$/
const WEB_CHUNK_PATH = /^\/_expo\/static\/js\/web\/[^/\\?#"'<>]+\.js$/

function chunkDependencies(source) {
  const manifest = CHUNK_MANIFEST.exec(String(source))
  return manifest ? JSON.parse(manifest[1]).filter((dep) => typeof dep === 'string') : []
}

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
function readQuestLocaleBootChunks(jsDir, locales, exportedCatchAllHtml, fileSystem = fs) {
  if (typeof exportedCatchAllHtml !== 'string' || !exportedCatchAllHtml.trim()) throw new Error('missing authoritative exported catch-all HTML')
  // #2484: platform roots can share a basename. The export page owns its
  // route scripts; other matching files in the directory are not candidates.
  const routes = [...new Set(scriptSrcs(exportedCatchAllHtml).filter((src) => src.startsWith(WEB_CHUNK_PREFIX) && CATCH_ALL_CHUNK.test(src.slice(WEB_CHUNK_PREFIX.length))))]
  if (!routes.length) throw new Error('exported catch-all HTML has no [...missing] route scripts')
  const readChunk = (src) => {
    if (!WEB_CHUNK_PATH.test(src)) throw new Error(`invalid boot chunk path ${src}`)
    return fileSystem.readFileSync(`${jsDir}/${src.slice(WEB_CHUNK_PREFIX.length)}`, 'utf8')
  }
  const deps = [...new Set(routes.flatMap((route) => chunkDependencies(readChunk(route))))]
  for (const dep of deps) readChunk(dep)
  // A selected route may also be a declared dependency. Keep the page's route
  // order, while registering every non-route dependency before those routes.
  const boot = [...deps.filter((dep) => !routes.includes(dep)), ...routes]
  const files = fileSystem.readdirSync(jsDir).filter((file) => file.endsWith('.js'))
  return new Map(locales.map((locale) => {
    const catalog = onlyChunk(files, new RegExp(`^locale-${locale}-[0-9a-f]+\\.js$`), `locale-${locale}`)
    readChunk(catalog)
    return [locale, [...boot.filter((src) => src !== catalog), catalog]]
  }))
}

// htmlparser2 keeps template/noscript descendants in its ordinary tree. They
// are inert in the JS-enabled document and must never become active boot tags.
function activeElements(doc, name) {
  return DomUtils.getElementsByTagName(name, doc, true).filter((node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent.name === 'template' || parent.name === 'noscript') return false
    }
    return true
  })
}

function scriptSrcs(html) {
  return activeElements(parseDocument(String(html)), 'script')
    .map((node) => node.attribs.src).filter((src) => typeof src === 'string')
}

// Inspect actual elements, not script-looking strings in inline JS/JSON. Keep
// source offsets so normalization can move original tags without reserializing
// their attributes or touching the rest of the document.
function expoScriptDocument(html) {
  const source = String(html)
  const doc = parseDocument(source, { withStartIndices: true, withEndIndices: true })
  const heads = activeElements(doc, 'head')
  if (heads.length !== 1) throw new Error('page must have exactly one head')
  const head = heads[0]
  const closer = /<\/head\s*>$/i.exec(source.slice(head.startIndex, head.endIndex + 1))
  if (!closer) throw new Error('page has no explicit closing head')
  const scripts = activeElements(doc, 'script')
    .filter((node) => typeof node.attribs.src === 'string' && node.attribs.src.startsWith(WEB_CHUNK_PREFIX))
  const issues = []
  const seen = new Set()
  for (const node of scripts) {
    const attrs = node.attribs
    const type = (attrs.type || '').trim().toLowerCase()
    if (!WEB_CHUNK_PATH.test(attrs.src)) issues.push(`invalid boot chunk path ${attrs.src}`)
    if (!Object.hasOwn(attrs, 'defer') || Object.hasOwn(attrs, 'async') || Object.hasOwn(attrs, 'nomodule')
      || (type && !['text/javascript', 'application/javascript'].includes(type))) {
      issues.push(`Expo script must be classic defer: ${attrs.src}`)
    }
    if (seen.has(attrs.src)) issues.push(`duplicates boot chunk ${attrs.src}`)
    seen.add(attrs.src)
  }
  const entries = scripts.filter((node) => /\/entry-[^/]+\.js$/.test(node.attribs.src))
  if (!entries.length) issues.push('page has no Expo entry script')
  if (entries.length > 1) issues.push('page has more than one Expo entry script')
  const entry = entries[0]
  if (entry) {
    for (const node of scripts) {
      if (node.startIndex > entry.startIndex) issues.push(`loads boot chunk ${node.attribs.src} after entry`)
    }
  }
  const runtime = scripts.findIndex((node) => /\/__expo-metro-runtime-[^/]+\.js$/.test(node.attribs.src))
  if (runtime > 0) issues.push('Expo runtime must precede other chunks')
  return { source, head, headClose: head.startIndex + closer.index, scripts, entry, issues }
}

/** Boot chunks the page does not list as scripts (empty = all shipped). */
function missingBootChunks(html, srcs) {
  const present = new Set(scriptSrcs(html))
  return srcs.filter((src) => !present.has(src))
}

/**
 * The same contract checked on a stored member. It reads the page, not the
 * chunk directory: a release `dist` also keeps earlier generations' chunks
 * (asset retention); multiple route chunks are also valid in one export.
 * `readChunk(src)` returns the chunk source for its declared dependencies.
 */
function bootChunkIssues(html, locale, readChunk) {
  let doc
  try { doc = expoScriptDocument(html) } catch (error) { return [error.message] }
  const scripts = doc.scripts.map((node) => node.attribs.src)
  const routes = scripts.filter((src) => CATCH_ALL_CHUNK.test(src.slice(WEB_CHUNK_PREFIX.length)))
  if (!routes.length) return ['does not ship the [...missing] route chunk']
  const issues = [...doc.issues]
  for (const node of doc.scripts) {
    if (node.parent !== doc.head) issues.push(`loads Expo script outside head: ${node.attribs.src}`)
  }
  const catalog = new RegExp(`^locale-${locale}-[0-9a-f]+\\.js$`)
  const catalogs = scripts.filter((src) => catalog.test(src.slice(WEB_CHUNK_PREFIX.length)))
  if (!catalogs.length) issues.push(`does not ship the locale-${locale} chunk`)
  if (new Set(catalogs).size > 1) issues.push(`ships more than one locale-${locale} chunk`)
  const deps = [...new Set([...new Set(routes)].flatMap((route) => chunkDependencies(readChunk(route))))]
  for (const src of new Set([...deps, ...catalogs])) readChunk(src)
  const present = new Set(scripts)
  issues.push(...deps.filter((dep) => !present.has(dep)).map((dep) => `does not ship boot chunk ${dep}`))
  return issues
}

/** Add missing boot chunks, then move the complete Expo defer set into head. */
function shipBootChunks(html, srcs) {
  const doc = expoScriptDocument(html)
  if (doc.issues.length) throw new Error(doc.issues.join('; '))
  if (new Set(srcs).size !== srcs.length) throw new Error('duplicate selected boot chunks')
  for (const src of srcs) if (!WEB_CHUNK_PATH.test(src)) throw new Error(`invalid boot chunk path ${src}`)
  const present = new Set(doc.scripts.map((node) => node.attribs.src))
  const missing = srcs.filter((src) => !present.has(src)).map((src) => `<script src="${src}" defer></script>`).join('')
  const tags = []
  const rest = []
  let cursor = 0
  let removedFromHead = 0
  for (const node of doc.scripts) {
    rest.push(doc.source.slice(cursor, node.startIndex))
    const tag = doc.source.slice(node.startIndex, node.endIndex + 1)
    if (node === doc.entry) tags.push(missing)
    tags.push(tag)
    if (node.startIndex < doc.headClose) removedFromHead += tag.length
    cursor = node.endIndex + 1
  }
  rest.push(doc.source.slice(cursor))
  const stripped = rest.join('')
  const insertAt = doc.headClose - removedFromHead
  return `${stripped.slice(0, insertAt)}${tags.join('')}${stripped.slice(insertAt)}`
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
