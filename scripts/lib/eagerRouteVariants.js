'use strict'

/**
 * Eager route rows that depend on what the build contains (#3370).
 *
 * A route that delivers a lazy screen in its own <script> set
 * (ROUTE_EAGER_LAZY_SCREENS in ./granularChunkMerge.js) has two legitimate script
 * sets: without the screen (its feature is compiled out, #2738) and with it. One
 * pin cannot hold both: the pin of the build without the screen makes the chunk
 * planner refuse the build that has it (it reads a request pin as a hard limit),
 * and the pin of the build with the screen leaves the other build the whole
 * screen as spare.
 *
 * `eager.routeVariants` in config/bundle-budget.json names the second set:
 *
 *   "(tabs)/assistant.html": { "whenEntry": "<source of the lazy screen>", "whenHtml": "<marker the screen renders>", "maxRequests": N, "maxBrotliKB": N }
 *
 * `maxRequestsByRoute` / `maxBrotliKBByRoute` keep the rows of the build WITHOUT
 * the entry; a build that HAS it is held by the variant rows instead. The choice
 * is made from the build itself, never from the environment: the planner sees the
 * entry point in its plan, the guard sees the chunk Expo names after that source
 * file. An environment variable is not the same fact - Metro compiles the screen
 * in for any non-empty flag value (`=0` included) while the app treats only `1` /
 * `true` as on, and the guard runs in a shell that never loaded the build's .env.
 *
 * The guard also requires `whenHtml` in the route's exported HTML: the chunk alone does not mean the
 * route renders the screen. A broken compile gate (#2738) - or `EXPO_PUBLIC_AI_ASSISTANT=0`, which
 * Metro compiles in while the app reads it as off - ships the screen chunk next to the not-found
 * route; the variant must not lend that build its spare. The planner has no HTML and only prices
 * its refinement; the verdict is the guard's.
 *
 * Both consumers call `resolveEagerRoutePolicy` and read the returned policy with
 * their unchanged per-route code, so the numbers have one source and one rule.
 */

const path = require('path')

const VARIANT_KEYS = ['maxBrotliKB', 'maxRequests', 'whenEntry', 'whenHtml']
const SOURCE_FILE = /\.[cm]?[jt]sx?$/

/** Expo names an async entry chunk after its source file: basename without the extension. */
function variantChunkName(whenEntry) {
  return path.posix.basename(whenEntry).replace(SOURCE_FILE, '')
}

function fail(message) {
  throw new Error(`bundle budget eager.routeVariants: ${message}`)
}

/** Validated variants of an eager policy; throws on a row that could silently guard nothing. */
function readRouteVariants(policy) {
  const declared = policy?.routeVariants
  if (declared == null) return []
  if (typeof declared !== 'object' || Array.isArray(declared)) fail('must be an object keyed by route')
  return Object.entries(declared).map(([route, variant]) => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) fail(`${route} must be an object`)
    if (Object.keys(variant).sort().join() !== VARIANT_KEYS.join()) fail(`${route} must define exactly ${VARIANT_KEYS.join(', ')}`)
    const { whenEntry, whenHtml, maxRequests, maxBrotliKB } = variant
    if (typeof whenEntry !== 'string' || !SOURCE_FILE.test(whenEntry) || path.posix.normalize(whenEntry) !== whenEntry ||
        whenEntry.startsWith('/') || whenEntry.startsWith('..') || whenEntry.includes('\\')) {
      fail(`${route}.whenEntry must be a source file path relative to the project root`)
    }
    if (typeof whenHtml !== 'string' || !whenHtml.trim()) fail(`${route}.whenHtml must be a non-empty marker of the screen in the route's HTML`)
    // The variant replaces rows; a route without both base rows would be unpinned in the build without the entry.
    if (!Number.isInteger(policy.maxRequestsByRoute?.[route])) fail(`${route} needs its maxRequestsByRoute row for the build without ${whenEntry}`)
    if (!Number.isFinite(policy.maxBrotliKBByRoute?.[route])) fail(`${route} needs its maxBrotliKBByRoute row for the build without ${whenEntry}`)
    if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > policy.maxRequests) {
      fail(`${route}.maxRequests must be a positive integer at most maxRequests`)
    }
    if (!Number.isFinite(maxBrotliKB) || maxBrotliKB <= 0 || (policy.maxBrotliKB != null && maxBrotliKB > policy.maxBrotliKB)) {
      fail(`${route}.maxBrotliKB must be above zero and at most maxBrotliKB`)
    }
    return { route, whenEntry, whenHtml, chunk: variantChunkName(whenEntry), maxRequests, maxBrotliKB }
  })
}

/**
 * @param policy the `eager` section of config/bundle-budget.json
 * @param hasEntry `(variant) => boolean`: whether THIS build contains `variant.whenEntry`
 *   (planner: an entry point of the plan; guard: an emitted chunk named `variant.chunk` AND
 *   `variant.whenHtml` in the route's HTML)
 * @returns `{ policy, active }`: the policy with the rows of every present variant in place of
 *   the base rows, and those variants; the input object is not modified
 */
function resolveEagerRoutePolicy(policy, hasEntry) {
  const active = readRouteVariants(policy).filter((variant) => hasEntry(variant))
  if (!active.length) return { policy, active }
  const maxRequestsByRoute = { ...policy.maxRequestsByRoute }
  const maxBrotliKBByRoute = { ...policy.maxBrotliKBByRoute }
  for (const variant of active) {
    maxRequestsByRoute[variant.route] = variant.maxRequests
    maxBrotliKBByRoute[variant.route] = variant.maxBrotliKB
  }
  return { policy: { ...policy, maxRequestsByRoute, maxBrotliKBByRoute }, active }
}

module.exports = { readRouteVariants, resolveEagerRoutePolicy, variantChunkName }
