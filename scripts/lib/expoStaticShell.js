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
  disableExpoRouterHydration,
  emptyAppRoot,
}
