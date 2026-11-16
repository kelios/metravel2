/**
 * Web export chunking (#2741, ROUTE-BUNDLE-001): Expo's granular strategy plans
 * one chunk per exact owner set, which gave 570 files and 129 <script> tags on
 * the home page (budget 16). This pass merges the planner's shared groups by the
 * HTML routes they are delivered to, the rule our own strategy patch applied
 * before SDK 58 (#1543, #1721), and leaves everything else to upstream:
 * filenames, the runtime chunk, `entryChunks` metadata, async `paths` arrays.
 *
 * Wired through `config.serializer.unstable_mergeGranularChunkPlan` in
 * metro.config.js; the hook call itself is the only line of the metro-config
 * patch.
 *
 * Merging cannot break the closure: every entry requires ALL chunks holding a
 * module it reaches synchronously (upstream's rule, recomputed after the merge).
 * A module that a merge delivers to a route which never reaches it is defined
 * there but never executed: foreign code the route still downloads and parses.
 * The merge therefore prices every pair in bytes (#3316): it takes the pair
 * that adds the least foreign code per saved request, and no route receives
 * more than ROUTE_FOREIGN_BUDGET_BYTES of foreign shared code in total.
 */
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const path = require('path')

// #3316: the ceiling of foreign factory bytes one HTML route may receive from
// merged shared files. Until then groups merged on route-set similarity alone
// (Jaccard >= 0.4, #1721), blind to sizes: on the SSR export of 71ff27fe8 the
// home page received 492 KiB of shared factories it never reaches (of 1306 KiB
// outside the entry file), the article 454 KiB of 1581.
// The value is the knee of a replay of that export's raw plan (68 routes,
// Brotli of the factories each route loads, summed): merging identical route
// sets only is the floor and costs up to 84 requests a page; the similarity
// merge stood 15% above the floor at 19 requests; 128 KiB stands 3% above at
// 24 (11 instead of 14 on the home page); 64 KiB buys one more percent for 33
// requests, 256 KiB gives back 3% to return to 19.
const ROUTE_FOREIGN_BUDGET_BYTES = 128 * 1024
const TINY_SHARED_MAX_BYTES = 2 * 1024
const MAX_EXTRA_FACTORY_BYTES_PER_ENTRY = 4 * 1024
const LAYOUT_FILE = /^_layout(\.[^/]+)?\.[jt]sx?$/
const webFallbackPath = (entryPath) => entryPath.replace(/\.web(\.[jt]sx?)$/, '$1')

function popcount32(value) {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

function orBits(left, right) {
  const out = new Uint32Array(left.length)
  for (let i = 0; i < left.length; i += 1) out[i] = left[i] | right[i]
  return out
}

function hasBit(bits, index) {
  return (bits[index >>> 5] & (1 << (index & 31))) !== 0
}

function forEachBit(bits, visit) {
  for (let word = 0; word < bits.length; word += 1) {
    for (let rest = bits[word] >>> 0; rest !== 0; rest &= rest - 1) {
      visit(word * 32 + 31 - Math.clz32(rest & -rest))
    }
  }
}

function sharedBitCount(left, right) {
  let count = 0
  for (let i = 0; i < left.length; i += 1) count += popcount32(left[i] & right[i])
  return count
}

function* ownerIndices(bits) {
  for (let index = 0; bits !== 0n; index += 1, bits >>= 1n) {
    if ((bits & 1n) !== 0n) yield index
  }
}

/**
 * Routes an entry can be the entry point of. expo-router chains entries by
 * directory: a layout is an entry point of every route below it, a route file
 * only of itself; entries outside `app/` (lazy components) belong to no route.
 */
function createRouteCoverage(entryPaths, appDir) {
  const prefix = appDir.endsWith(path.sep) ? appDir : appDir + path.sep
  const inApp = entryPaths.filter((entryPath) => entryPath.startsWith(prefix))
  // Expo keeps the fallback context key beside its .web override. They are
  // two async entries, but the browser can visit only one delivery route, and
  // its HTML lists the files of the .web entry alone. The shadowed fallback is
  // therefore an entry point of no route (#3316: /map, whose fallback is a
  // different implementation, counted as a consumer of everything that
  // fallback reaches); what the facade imports from it arrives through the
  // facade.
  const inAppSet = new Set(inApp)
  const shadowed = new Set(inApp.filter((entryPath) => webFallbackPath(entryPath) !== entryPath).map(webFallbackPath).filter((entryPath) => inAppSet.has(entryPath)))
  const routes = [...new Set(inApp.filter((entryPath) => !LAYOUT_FILE.test(path.basename(entryPath))).map(webFallbackPath))]
  const routeIndex = new Map(routes.map((route, index) => [route, index]))
  const words = Math.max(1, Math.ceil(routes.length / 32))
  const coverage = new Map()
  for (const entryPath of entryPaths) {
    const bits = new Uint32Array(words)
    if (entryPath.startsWith(prefix) && !shadowed.has(entryPath)) {
      const covered = LAYOUT_FILE.test(path.basename(entryPath))
        ? routes.filter((route) => route.startsWith(path.dirname(entryPath) + path.sep))
        : [webFallbackPath(entryPath)]
      for (const route of covered) {
        const index = routeIndex.get(route)
        bits[index >>> 5] |= 1 << (index & 31)
      }
    }
    coverage.set(entryPath, bits)
  }
  return { coverage, words, routes }
}

function routeKey(bits) {
  return Array.from(bits, (word) => (word >>> 0).toString(16)).join('.')
}

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
const byOwners = (a, b) => (a.ownerEntries < b.ownerEntries ? -1 : a.ownerEntries > b.ownerEntries ? 1 : 0)

/**
 * Raw atoms (exact sets of entries reaching a module synchronously) with every
 * module the initial entry reaches folded into the initial entry — the
 * placement of the pre-SDK 58 patch. Upstream's own normalization also moves an
 * atom into an importer that is guaranteed to have loaded before (main => a =>
 * b: shared a/b code goes into a). That saves a request but moved ~45 KB raw of
 * shared code into named route files ([param], TravelDetailsPostLcpRuntime,
 * the quests catalog) whose budgets pin feature code (#2741), and the
 * route-set merge below already folds such groups into few files.
 */
function placeAtoms(rawAtoms, initialOwners, webAliases) {
  const modulesByOwners = new Map()
  for (const atom of rawAtoms) {
    let owners = (atom.ownerEntries & initialOwners) !== 0n ? atom.ownerEntries & initialOwners : atom.ownerEntries
    // An SSR .web route synchronously imports its fallback implementation.
    // Keeping both context keys as owners hoists that implementation out of
    // the route facade into shared code. Prefer the web facade only for atoms
    // reached by BOTH aliases; fallback-only and unrelated owners stay intact.
    for (const { fallback, web } of webAliases) {
      if ((owners & fallback) !== 0n && (owners & web) !== 0n) owners &= ~fallback
    }
    const modules = modulesByOwners.get(owners) ?? []
    modules.push(...atom.modules)
    modulesByOwners.set(owners, modules)
  }
  return [...modulesByOwners]
    .map(([ownerEntries, modules]) => ({ ownerEntries, modules: new Set(modules.sort(byPath)) }))
    .sort(byOwners)
}

/** Bytes a module adds to the file that carries it: its transformed factories. */
function factoryBytes(module) {
  let bytes = 0
  for (const output of module.output ?? []) {
    if (typeof output.data?.code === 'string') bytes += Buffer.byteLength(output.data.code, 'utf8')
  }
  return bytes
}

/**
 * A shared group: atoms shipped as one file. `needed[route]` is the part of
 * `bytes` the route reaches; a route of the group receives the rest as foreign.
 */
function foreignBytes(group, route) {
  return hasBit(group.routes, route) ? group.bytes - group.needed[route] : 0
}

/**
 * METRAVEL_MERGE_IDENTICAL_ROUTE_SETS (#1543): groups on the same route set
 * always ship together, at no cost to any route. Groups no route delivers
 * (shared by lazy components only) share the empty key and become one
 * on-demand file, as with the pre-SDK 58 patch: measured on #2741, keeping
 * them apart (28 files) cost +16.5 KB gzip on the release total for no change
 * in any HTML route. Equal owner sets are merged too: upstream names a shared
 * file by its owners and materializes one file per owner set.
 */
function mergeIdenticalGroups(groups) {
  const parent = groups.map((_, index) => index)
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  const firstByKey = new Map()
  groups.forEach((group, index) => {
    for (const key of [`o:${group.ownerEntries.toString(16)}`, `r:${routeKey(group.routes)}`]) {
      if (firstByKey.has(key)) parent[find(index)] = find(firstByKey.get(key))
      else firstByKey.set(key, index)
    }
  })
  const mergedByRoot = new Map()
  groups.forEach((group, index) => {
    const rootIndex = find(index)
    const existing = mergedByRoot.get(rootIndex)
    mergedByRoot.set(rootIndex, existing ? mergeGroups(existing, group) : group)
  })
  // A union above can land two results on one owner set; fold those too.
  const groupByOwners = new Map()
  for (const group of mergedByRoot.values()) {
    const existing = groupByOwners.get(group.ownerEntries)
    groupByOwners.set(group.ownerEntries, existing ? mergeGroups(existing, group) : group)
  }
  return [...groupByOwners.values()]
}

/**
 * Min-heap of merge candidates: cheapest price first, equal prices in pair
 * order (left index, then right), the order a full scan of the pairs gives.
 */
function candidateBefore(a, b) {
  return a.price !== b.price ? a.price < b.price : a.left !== b.left ? a.left < b.left : a.right < b.right
}

function pushCandidate(heap, candidate) {
  let index = heap.length
  heap.push(candidate)
  while (index > 0) {
    const parent = (index - 1) >> 1
    if (!candidateBefore(candidate, heap[parent])) break
    heap[index] = heap[parent]
    index = parent
  }
  heap[index] = candidate
}

function popCandidate(heap) {
  const top = heap[0]
  const last = heap.pop()
  const size = heap.length
  if (size > 0) {
    let index = 0
    for (;;) {
      let child = index * 2 + 1
      if (child >= size) break
      if (child + 1 < size && candidateBefore(heap[child + 1], heap[child])) child += 1
      if (!candidateBefore(heap[child], last)) break
      heap[index] = heap[child]
      index = child
    }
    heap[index] = last
  }
  return top
}

/**
 * METRAVEL_ROUTE_FOREIGN_BUDGET (#3316, replaces the #1721 similarity floor).
 * Merging two groups saves one request on every route that loads both and
 * hands each of them to the routes that load only the other. Take the pair
 * with the fewest foreign bytes added per saved request, until every remaining
 * pair would push some route over `budgetBytes` of foreign shared code. Groups
 * with no common route are never merged: nothing is saved.
 * Two groups on one route set, equal owner sets among them, merge for free and
 * therefore first, so the result keeps one group per owner set.
 *
 * Each quoted pair is looked at once: a refused pair leaves the heap and comes
 * back only with a new quote, after one of its groups has changed. `stats`
 * counts quotes and candidates taken from the heap.
 */
function mergeGroupsWithinRouteBudget(groups, budgetBytes, stats) {
  const live = groups.slice()
  const count = live.length
  const routeSlots = count ? live[0].needed.length : 0
  const foreignByRoute = new Float64Array(routeSlots)
  for (const group of live) forEachBit(group.routes, (route) => { foreignByRoute[route] += foreignBytes(group, route) })
  // A candidate quotes two groups as they were: any later change of either
  // (its revision moves, or it is merged away) makes the candidate stale.
  const revision = new Uint32Array(count)
  const heap = []
  const quote = (a, b) => {
    const left = Math.min(a, b)
    const right = Math.max(a, b)
    const saved = sharedBitCount(live[left].routes, live[right].routes)
    if (saved === 0) return
    const merged = mergeGroups(live[left], live[right])
    let added = 0
    forEachBit(merged.routes, (route) => {
      added += foreignBytes(merged, route) - foreignBytes(live[left], route) - foreignBytes(live[right], route)
    })
    // Foreign bytes per saved request.
    pushCandidate(heap, { price: added / saved, left, right, leftRevision: revision[left], rightRevision: revision[right] })
    if (stats) stats.quotes += 1
  }
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) quote(left, right)
  }
  while (heap.length > 0) {
    const { left, right, leftRevision, rightRevision } = popCandidate(heap)
    if (!live[left] || !live[right] || revision[left] !== leftRevision || revision[right] !== rightRevision) continue
    if (stats) stats.candidates += 1
    const merged = mergeGroups(live[left], live[right])
    const added = new Map()
    let fits = true
    forEachBit(merged.routes, (route) => {
      const extra = foreignBytes(merged, route) - foreignBytes(live[left], route) - foreignBytes(live[right], route)
      added.set(route, extra)
      if (foreignByRoute[route] + extra > budgetBytes) fits = false
    })
    // Budgets only fill up, so a refused pair stays refused until it changes.
    if (!fits) continue
    for (const [route, extra] of added) foreignByRoute[route] += extra
    live[left] = merged
    live[right] = null
    revision[left] += 1
    for (let other = 0; other < count; other += 1) {
      if (live[other] && other !== left) quote(left, other)
    }
  }
  return live.filter(Boolean)
}

/**
 * @param plan result of upstream `computeBitSetChunkPlan`
 * @param context granular strategy context ({ options: { projectRoot, serverRoot } })
 * @param options.routeForeignBudgetBytes foreign shared bytes a route may receive; negative: merge identical sets only
 * @param options.stats optional `{ quotes, candidates }` counters of the budget merge, incremented in place
 * @returns the plan with `chunks` and `requiredChunksByEntryPath` replaced
 */
function mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes = ROUTE_FOREIGN_BUDGET_BYTES, appDir, stats } = {}) {
  const { entryPoints, rawAtoms, dependentEntriesByModule } = plan
  const root = context?.options?.serverRoot ?? context?.options?.projectRoot ?? process.cwd()
  const entryPaths = entryPoints.map((entry) => entry.module.path)
  const entryPathSet = new Set(entryPaths)
  const applicationDir = appDir ?? path.join(root, 'app')
  const { coverage, words } = createRouteCoverage(entryPaths, applicationDir)
  const entryIndex = new Map(entryPaths.map((entryPath, index) => [entryPath, index]))
  const webAliases = entryPaths.flatMap((entryPath, index) => {
    const fallbackIndex = entryIndex.get(webFallbackPath(entryPath))
    return entryPath.startsWith(applicationDir + path.sep) && fallbackIndex != null && fallbackIndex !== index
      ? [{ fallback: 1n << BigInt(fallbackIndex), web: 1n << BigInt(index) }]
      : []
  })

  let initialOwners = 0n
  entryPoints.forEach((entry, index) => {
    if (entry.kind === 'initial') initialOwners |= 1n << BigInt(index)
  })

  const atoms = placeAtoms(rawAtoms, initialOwners, webAliases)
  const chunks = []
  const groups = []
  for (const atom of atoms) {
    const owners = [...ownerIndices(atom.ownerEntries)]
    // A single owner keeps its modules in its own entry file; initial-owned
    // modules belong to the entry bundle. Neither is a shared group.
    if (owners.length < 2 || (atom.ownerEntries & initialOwners) !== 0n) {
      chunks.push(atom)
      continue
    }
    let routes = new Uint32Array(words)
    for (const index of owners) routes = orBits(routes, coverage.get(entryPaths[index]))
    let bytes = 0
    for (const module of atom.modules) {
      if (entryPathSet.has(module.path)) routes = orBits(routes, coverage.get(module.path))
      bytes += factoryBytes(module)
    }
    // Every route of an atom reaches all of it.
    const needed = new Float64Array(words * 32)
    forEachBit(routes, (route) => { needed[route] = bytes })
    groups.push({ ownerEntries: atom.ownerEntries, atoms: [atom], routes, bytes, needed })
  }

  // The closing pass is a no-op unless the budget refused even free merges:
  // upstream needs one group per owner set whatever the budget.
  const merged = mergeIdenticalGroups(mergeGroupsWithinRouteBudget(mergeIdenticalGroups(groups), routeForeignBudgetBytes, stats))
  for (const group of merged) {
    const modules = group.atoms.flatMap((atom) => [...atom.modules]).sort(byPath)
    chunks.push({ ownerEntries: group.ownerEntries, modules: new Set(modules) })
  }
  const packedChunks = packTinySharedChunks(chunks, dependentEntriesByModule, initialOwners, entryPathSet)
  packedChunks.sort(byOwners)

  // Same rule as upstream's getRequiredChunksByEntryPath: an entry requires every
  // chunk holding a module it reaches synchronously, so each import() set and
  // each HTML route stays closed whatever was merged.
  const requiredByEntry = entryPoints.map(() => [])
  for (const chunk of packedChunks) {
    let requiredBy = 0n
    for (const module of chunk.modules) requiredBy |= dependentEntriesByModule.get(module) ?? 0n
    for (const index of ownerIndices(requiredBy)) requiredByEntry[index].push(chunk)
  }
  const requiredChunksByEntryPath = new Map(entryPaths.map((entryPath, index) => [entryPath, requiredByEntry[index]]))

  return { ...plan, chunks: packedChunks, requiredChunksByEntryPath }
}

/** Measure only registered module factories, never scripts or raw source files. */
function sharedFactoryInfo(chunk, dependentEntriesByModule, initialOwners, entryPathSet) {
  if ((chunk.ownerEntries & initialOwners) !== 0n || [...ownerIndices(chunk.ownerEntries)].length < 2) return null
  let bytes = 0
  let consumers = 0n
  for (const module of chunk.modules) {
    if (!path.isAbsolute(module.path) || module.path.includes('\0') || module.isVirtual || entryPathSet.has(module.path)) return null
    const requiredBy = dependentEntriesByModule.get(module)
    if (typeof requiredBy !== 'bigint' || requiredBy === 0n || !module.output?.length) return null
    for (const output of module.output) {
      if (!/^js\/module(?:\/|$)/.test(output.type) || typeof output.data?.code !== 'string') return null
      bytes += Buffer.byteLength(output.data.code, 'utf8')
    }
    consumers |= requiredBy
  }
  return { chunk, bytes, consumers, key: [...chunk.modules].sort(byPath).map((module) => module.path).join('\0'), active: true }
}

/**
 * Tiny shared files can survive route-set merging when lazy entries have different
 * owners. Move their factories only to a file every actual consumer already needs.
 * Other consumers may receive definitions, not execution; bound that extra payload.
 */
function packTinySharedChunks(chunks, dependentEntriesByModule, initialOwners, entryPathSet) {
  const groups = chunks.map((chunk) => sharedFactoryInfo(chunk, dependentEntriesByModule, initialOwners, entryPathSet)).filter(Boolean)
  const bySizeThenPath = (left, right) => left.bytes - right.bytes || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  const extraBytesByEntry = new Map()
  const removed = new Set()
  for (const source of groups.slice().sort(bySizeThenPath)) {
    if (!source.active || source.bytes > TINY_SHARED_MAX_BYTES) continue
    let best = null
    let bestExtraEntries = null
    for (const target of groups) {
      if (!target.active || target === source || (source.consumers & target.consumers) !== source.consumers) continue
      const extraEntries = [...ownerIndices(target.consumers & ~source.consumers)]
      if (extraEntries.some((index) => (extraBytesByEntry.get(index) ?? 0) + source.bytes > MAX_EXTRA_FACTORY_BYTES_PER_ENTRY)) continue
      if (!best || extraEntries.length < bestExtraEntries.length ||
          (extraEntries.length === bestExtraEntries.length && bySizeThenPath(target, best) < 0)) {
        best = target
        bestExtraEntries = extraEntries
      }
    }
    if (!best) continue
    best.chunk.modules = new Set([...best.chunk.modules, ...source.chunk.modules].sort(byPath))
    best.bytes += source.bytes
    best.key = [...best.chunk.modules].map((module) => module.path).join('\0')
    // Keep the destination's unique placement/name key. Required files below use
    // actual consumers, not that key, including owners normalized for web aliases.
    for (const index of bestExtraEntries) extraBytesByEntry.set(index, (extraBytesByEntry.get(index) ?? 0) + source.bytes)
    source.active = false
    removed.add(source.chunk)
  }
  return chunks.filter((chunk) => !removed.has(chunk))
}

function readBundleBudget(root) {
  const file = path.join(root, 'config', 'bundle-budget.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

// Same route-group/index normalization as the exported-HTML request guard.
function requestRouteKey(route) {
  return route.split('/').filter((part) => !/^\([^/]+\)$/.test(part)).join('/').replace(/\/index\.html$/, '.html')
}

function requestLimits(policy, routes, applicationDir) {
  if (!policy?.htmlRoutes || !Number.isInteger(policy.maxRequests) || policy.maxRequests < 1) return null
  const keys = routes.map((route) => requestRouteKey(path.relative(applicationDir, route).replace(/\.[jt]sx?$/, '.html')))
  const known = new Set(keys)
  const limits = new Map()
  for (const [route, limit] of Object.entries(policy.maxRequestsByRoute ?? {})) {
    const key = requestRouteKey(route)
    // An unrepresented pin cannot safely be priced from this plan.
    if (!known.has(key) || !Number.isInteger(limit) || limit < 1) return null
    limits.set(key, Math.min(limits.get(key) ?? limit, limit))
  }
  return keys.map((key) => Math.min(limits.get(key) ?? policy.maxRequests, policy.maxRequests))
}

/** Delivery and foreign bytes use actual consumers, never a chunk's naming key. */
function deliveryInfo(chunk, state) {
  let consumers = 0n
  let routes = new Uint32Array(state.words)
  let bytes = 0
  const needed = new Float64Array(state.words * 32)
  for (const module of chunk.modules) {
    const moduleBytes = factoryBytes(module)
    const owners = state.dependentEntriesByModule.get(module) ?? 0n
    let moduleRoutes = new Uint32Array(state.words)
    for (const index of ownerIndices(owners)) moduleRoutes = orBits(moduleRoutes, state.coverage.get(state.entryPaths[index]))
    forEachBit(moduleRoutes, (route) => { needed[route] += moduleBytes })
    routes = orBits(routes, moduleRoutes)
    consumers |= owners
    bytes += moduleBytes
  }
  return { chunk, consumers, routes, bytes, needed }
}

function splitBaseline(chunks, state, measured) {
  const requests = Float64Array.from(state.routes, (route) => measured.get(sourceRouteKey(route, state.applicationDir)).requests)
  const foreign = new Float64Array(state.routes.length)
  const infos = chunks.map((chunk) => deliveryInfo(chunk, state))
  for (const info of infos) {
    if ((info.chunk.ownerEntries & state.initialOwners) === 0n && [...ownerIndices(info.chunk.ownerEntries)].length > 1) {
      forEachBit(info.routes, (route) => { foreign[route] += foreignBytes(info, route) })
    }
  }
  return { infos, requests, foreign }
}

function originalAtomsInChunk(chunk, state) {
  const originals = new Set()
  for (const module of chunk.modules) {
    const atom = state.originalByModule.get(module)
    if (!atom || state.dependentEntriesByModule.get(module) !== atom.ownerEntries) return null
    originals.add(atom)
  }
  // A closing split must not subdivide an original Metro atom.
  for (const atom of originals) for (const module of atom.modules) if (!chunk.modules.has(module)) return null
  return [...originals]
}

function splitPart(atoms, state) {
  const modules = atoms.flatMap((atom) => [...atom.modules]).sort(byPath)
  let ownerEntries = 0n
  for (const module of modules) ownerEntries |= state.placementByModule.get(module)
  const chunk = { ownerEntries, modules: new Set(modules) }
  const factory = sharedFactoryInfo(chunk, state.dependentEntriesByModule, state.initialOwners, state.entryPathSet)
  return factory && factory.bytes > TINY_SHARED_MAX_BYTES ? { ...deliveryInfo(chunk, state), key: factory.key } : null
}

function scoreSplit(source, left, right, state, baseline) {
  let relief = 0
  for (let route = 0; route < state.routes.length; route += 1) {
    const added = Number(hasBit(left.routes, route)) + Number(hasBit(right.routes, route)) - Number(hasBit(source.routes, route))
    const saved = foreignBytes(source, route) - foreignBytes(left, route) - foreignBytes(right, route)
    if (added < 0 || added > 1 || baseline.requests[route] + added > state.limits[route] || saved < 0 ||
        baseline.foreign[route] - saved > state.routeForeignBudgetBytes) return null
    relief += saved
  }
  if (relief <= 0) return null
  // Price the extra registration request for ALL codec consumers, including
  // lazy entries with no HTML route. Replacing one file can add at most one.
  const addedRequests = [...ownerIndices(left.consumers & right.consumers)].length
  return { relief, addedRequests, parts: [left.chunk, right.chunk], key: [left.key, right.key].sort().join('\0\0') }
}

function betterSplit(candidate, best) {
  if (!best) return true
  if (candidate.addedRequests === 0 || best.addedRequests === 0) {
    if (candidate.addedRequests !== best.addedRequests) return candidate.addedRequests === 0
  } else {
    const comparison = candidate.relief * best.addedRequests - best.relief * candidate.addedRequests
    if (comparison !== 0) return comparison > 0
  }
  return candidate.relief !== best.relief ? candidate.relief > best.relief : candidate.key < best.key
}

function ownerPartitions(originals, entryCount) {
  const seen = new Set()
  const partitions = []
  for (let index = 0; index < entryCount; index += 1) {
    const owner = 1n << BigInt(index)
    const left = originals.filter((atom) => (atom.ownerEntries & owner) !== 0n)
    const right = originals.filter((atom) => (atom.ownerEntries & owner) === 0n)
    if (!left.length || !right.length) continue
    const signature = [left, right].map((atoms) => atoms.map((atom) => atom.ownerEntries.toString(16)).sort().join('.')).sort().join('/')
    if (seen.has(signature)) continue
    seen.add(signature)
    partitions.push([left, right])
  }
  return partitions
}

/** Enumerate all safe ORIGINAL-atom cuts, without choosing a raw-proxy winner. */
function sharedSplitCandidates(plan, state, measured) {
  state.originalByModule = new Map(plan.rawAtoms.flatMap((atom) => [...atom.modules].map((module) => [module, atom])))
  state.placementByModule = new Map(state.atoms.flatMap((atom) => [...atom.modules].map((module) => [module, atom.ownerEntries])))
  const baseline = splitBaseline(plan.chunks, state, measured)
  const chunkKeys = new Set(plan.chunks.map((chunk) => chunk.ownerEntries))
  const seen = new Set()
  const candidates = []
  for (const source of baseline.infos) {
    if (!sharedFactoryInfo(source.chunk, state.dependentEntriesByModule, state.initialOwners, state.entryPathSet)) continue
    const originals = originalAtomsInChunk(source.chunk, state)
    if (!originals || originals.length < 2) continue
    for (const [owned, foreign] of ownerPartitions(originals, state.entryPaths.length)) {
      const left = splitPart(owned, state)
      const right = splitPart(foreign, state)
      if (!left || !right || left.chunk.ownerEntries === right.chunk.ownerEntries) continue
      const keys = [left.chunk.ownerEntries, right.chunk.ownerEntries]
      if (keys.some((key) => key !== source.chunk.ownerEntries && chunkKeys.has(key))) continue
      const candidate = scoreSplit(source, left, right, state, baseline)
      if (!candidate || seen.has(candidate.key)) continue
      seen.add(candidate.key)
      const chunks = [...plan.chunks.filter((chunk) => chunk !== source.chunk), ...candidate.parts].sort(byOwners)
      candidates.push({ ...candidate, plan: withChunkRequirements(plan, chunks) })
    }
  }
  return candidates.sort((left, right) => betterSplit(left, right) ? -1 : betterSplit(right, left) ? 1 : 0)
}

function withChunkRequirements(plan, chunks) {
  const required = plan.entryPoints.map(() => [])
  for (const chunk of chunks) {
    let owners = 0n
    for (const module of chunk.modules) owners |= plan.dependentEntriesByModule.get(module) ?? 0n
    for (const index of ownerIndices(owners)) required[index].push(chunk)
  }
  return { ...plan, chunks, requiredChunksByEntryPath: new Map(plan.entryPoints.map((entry, index) => [entry.module.path, required[index]])) }
}

function sourceRouteKey(route, applicationDir) {
  return requestRouteKey(path.relative(applicationDir, route).replace(/\.[jt]sx?$/, '.html'))
}

function refinementState(plan, context, policy) {
  const applicationDir = path.join(context.options.serverRoot ?? context.options.projectRoot, 'app')
  const entryPaths = plan.entryPoints.map((entry) => entry.module.path)
  const { coverage, words, routes } = createRouteCoverage(entryPaths, applicationDir)
  let initialOwners = 0n
  plan.entryPoints.forEach((entry, index) => { if (entry.kind === 'initial') initialOwners |= 1n << BigInt(index) })
  const indices = new Map(entryPaths.map((entry, index) => [entry, index]))
  const aliases = entryPaths.flatMap((entry, index) => {
    const fallback = indices.get(webFallbackPath(entry))
    return entry.startsWith(applicationDir + path.sep) && fallback != null && fallback !== index
      ? [{ fallback: 1n << BigInt(fallback), web: 1n << BigInt(index) }] : []
  })
  return {
    applicationDir, entryPaths, coverage, words, routes, initialOwners,
    limits: requestLimits(policy, routes, applicationDir), entryPathSet: new Set(entryPaths),
    atoms: placeAtoms(plan.rawAtoms, initialOwners, aliases), dependentEntriesByModule: plan.dependentEntriesByModule,
    routeForeignBudgetBytes: ROUTE_FOREIGN_BUDGET_BYTES,
  }
}

function invalidCandidate(message) {
  const error = new Error(message)
  error.code = 'METRAVEL_REFINEMENT_CANDIDATE'
  return error
}

/** Same metadata matcher as Expo's later HTML writer; this is NOT generated HTML evidence. */
function measureEagerAssets(assets, state, compressionCache) {
  const { getGranularAssetsForRoute } = require(path.join(path.dirname(require.resolve('@expo/cli/package.json')), 'build/src/start/server/metro/serializeHtml'))
  const { compressedSizesSync } = require('./compressedSizes')
  const js = assets.filter((asset) => asset.type === 'js')
  const filenames = new Set()
  for (const asset of js) {
    if (typeof asset.filename !== 'string' || !asset.filename || filenames.has(asset.filename) || typeof asset.source !== 'string') {
      throw invalidCandidate('Invalid or duplicate serialized JS filename/source')
    }
    filenames.add(asset.filename)
  }
  const carriers = js.filter((asset) => asset.metadata?.entryChunks !== undefined)
  if (carriers.length !== 1) throw invalidCandidate('Expected exactly one entryChunks mapping')
  const mapping = carriers[0].metadata.entryChunks
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw invalidCandidate('Invalid entryChunks mapping')
  const missing = state.entryPaths.filter((entry) => !Object.hasOwn(mapping, entry) || !Array.isArray(mapping[entry]))
  if (missing.length) throw invalidCandidate(`Missing source/layout entryChunks mapping: ${missing.join(', ')}`)
  const byFilename = new Map(js.map((asset) => [asset.filename, asset]))
  // Initial/lazy entries may need no extra files. A priced source/layout root
  // must have its own real async owner, rather than silently falling back to
  // only the non-async initial/runtime files in Expo's matcher.
  const invalidRoots = state.entryPaths.filter((entry) => {
    if (!state.coverage.get(entry).some((word) => word !== 0)) return false
    const roots = mapping[entry]
    if (!roots.length || roots.some((file) => typeof file !== 'string' || !byFilename.has(file))) return true
    return !roots.some((file) => {
      const asset = byFilename.get(file)
      return asset.metadata?.isAsync && (asset.metadata.entryPaths?.includes(entry) || asset.metadata.modulePaths?.includes(entry))
    })
  })
  if (invalidRoots.length) throw invalidCandidate(`Invalid source/layout root mapping: ${invalidRoots.join(', ')}`)
  const keys = js.map((asset) => createHash('sha256').update(asset.source).digest('hex'))
  const pending = new Map()
  js.forEach((asset, index) => { if (!compressionCache.has(keys[index])) pending.set(keys[index], Buffer.from(asset.source)) })
  const compressed = compressedSizesSync([...pending.values()])
  ;[...pending.keys()].forEach((key, index) => compressionCache.set(key, compressed[index].brotli))
  const sizes = new Map(js.map((asset, index) => [asset.filename, compressionCache.get(keys[index])]))
  const result = new Map()
  state.routes.forEach((route, index) => {
    const chain = state.entryPaths.filter((entry) => hasBit(state.coverage.get(entry), index))
    if (!chain.length) throw invalidCandidate(`Missing source route/layout chain: ${route}`)
    const delivered = getGranularAssetsForRoute(js, chain)
    if (!delivered.length) throw invalidCandidate(`Empty script closure for source route: ${route}`)
    const key = sourceRouteKey(route, state.applicationDir)
    const bytes = delivered.reduce((sum, asset) => sum + sizes.get(asset.filename), 0)
    const previous = result.get(key)
    result.set(key, { bytes: Math.max(previous?.bytes ?? 0, bytes), requests: Math.max(previous?.requests ?? 0, delivered.length) })
  })
  // Normalized aliases share a pin; use their worst source-derived closure.
  for (const [index, route] of state.routes.entries()) {
    if (result.get(sourceRouteKey(route, state.applicationDir)).requests > state.limits[index]) {
      throw invalidCandidate(`Eager request cap exceeded: ${route}`)
    }
  }
  return result
}

function eagerConstraints(measured, policy, defaultTolerance) {
  const { roundedByteLimit } = require('./bundleBudgetReport')
  const tolerance = 1 + (policy.tolerancePct ?? defaultTolerance ?? 5) / 100
  const pins = (values) => {
    const result = new Map()
    for (const [route, limit] of Object.entries(values ?? {})) {
      const key = requestRouteKey(route)
      result.set(key, Math.min(result.get(key) ?? Infinity, limit))
    }
    return result
  }
  const coarse = pins(policy.maxBrotliKBByRoute)
  const exact = pins(policy.maxBrotliBytesByRoute)
  const constraints = new Map()
  const add = (key, kind, bytes, limit) => {
    if (!Number.isFinite(limit) || limit < 0) throw invalidCandidate(`Invalid eager byte limit: ${key}`)
    constraints.set(`${key}\0${kind}`, { bytes, limit })
  }
  for (const [key, { bytes }] of measured) {
    if (policy.maxBrotliKB != null) add(key, 'global', bytes, roundedByteLimit(Math.round(policy.maxBrotliKB * tolerance * 10) / 10))
    if (coarse.has(key)) add(key, 'routeKiB', bytes, roundedByteLimit(Math.round(coarse.get(key) * tolerance * 10) / 10))
    if (exact.has(key)) add(key, 'routeExact', bytes, exact.get(key))
  }
  for (const key of [...coarse.keys(), ...exact.keys()]) if (!measured.has(key)) throw invalidCandidate(`Missing byte-pinned source route: ${key}`)
  return constraints
}

function improvement(baseline, measured) {
  let eliminated = 0
  let overflow = 0
  for (const [key, before] of baseline) {
    const after = measured.get(key)
    if (!after || after.limit !== before.limit) throw invalidCandidate(`Changed/missing byte constraint: ${key}`)
    if (before.bytes <= before.limit && after.bytes > after.limit) return null
    if (before.bytes > before.limit) {
      if (after.bytes <= after.limit) eliminated += 1
      overflow += Math.max(0, after.bytes - after.limit)
    }
  }
  const previousOverflow = [...baseline.values()].reduce((sum, row) => sum + Math.max(0, row.bytes - row.limit), 0)
  return eliminated > 0 || overflow < previousOverflow ? { eliminated, overflow } : null
}

function betterMeasured(candidate, best) {
  if (!best) return true
  if (candidate.eliminated !== best.eliminated) return candidate.eliminated > best.eliminated
  if (candidate.overflow !== best.overflow) return candidate.overflow < best.overflow
  return betterSplit(candidate, best)
}

function throwIfCancelled(context) {
  const signal = context.signal ?? context.options.signal
  if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('Serialization cancelled'), { name: 'AbortError' })
}

/**
 * Optional late packaging refinement called by the Expo extension. The ordinary
 * greedy+tiny baseline allocates IDs ONCE. Trials use only those IDs and retain
 * its priority vector: ID priorities belong to the baseline, not the winning cut.
 */
async function refineGranularChunkPlan(plan, context, serializePlan) {
  throwIfCancelled(context)
  const recorder = recordedSerialization(context)
  const replaySupported = supportsReplay(context)
  const snapshot = replaySupported ? cloneSerializationInputs(plan, context) : null
  const before = replaySupported ? serializationInputSignature(plan, context) : null
  const baseline = await serializePlan(plan, recorder.context)
  throwIfCancelled(context)
  recorder.seal()
  const frozenPriorities = { priorities: Array.isArray(baseline.priorities) ? Object.freeze([...baseline.priorities]) : baseline.priorities }
  if (!replaySupported || !recorder.supported() || serializationInputSignature(plan, recorder.context) !== before) return baseline.assets
  const root = context.options.serverRoot ?? context.options.projectRoot
  const budget = readBundleBudget(root)
  const policy = budget?.eager
  const state = refinementState(plan, context, policy)
  if (!state.limits) return baseline.assets
  const cache = new Map()
  const measuredBaseline = measureEagerAssets(baseline.assets, state, cache)
  const constraints = eagerConstraints(measuredBaseline, policy, budget.tolerancePct)
  if ([...constraints.values()].every((row) => row.bytes <= row.limit)) return baseline.assets
  let best = null
  const violatedCount = [...constraints.values()].filter((row) => row.bytes > row.limit).length
  // Candidates are in descending secondary (raw-relief/request) order. Once
  // every violated constraint is closed, count/overflow have reached their
  // mathematical optimum and no later candidate can beat the secondary key.
  // Otherwise evaluate every eligible cut; there is no top-N/weight heuristic.
  for (const candidate of sharedSplitCandidates(plan, state, measuredBaseline)) {
    throwIfCancelled(context)
    const trial = cloneSerializationInputs(remapCandidate(candidate.plan, snapshot), snapshot.context)
    const trialContext = recorder.replayContext(trial.context)
    let result
    let score
    try {
      result = await serializePlan(trial.plan, trialContext, frozenPriorities)
      throwIfCancelled(context)
      const measured = measureEagerAssets(result.assets, state, cache)
      score = improvement(constraints, eagerConstraints(measured, policy, budget.tolerancePct))
    } catch (error) {
      throwIfCancelled(context)
      // Reject only explicitly ineligible trials. Cancellation, codec errors,
      // assertion failures, OOM and every other serializer failure propagate.
      if (error?.code === 'METRAVEL_REFINEMENT_CANDIDATE') continue
      throw error
    }
    if (score && betterMeasured({ ...candidate, ...score }, best)) best = { ...candidate, ...score, assets: result.assets }
    if (score?.eliminated === violatedCount && score.overflow === 0) return result.assets
  }
  // Return EXACTLY the measured assets; no second ID allocation or emission.
  return best ? best.assets : baseline.assets
}

function recordedSerialization(context) {
  const originalOptions = context.options
  const originalConfig = context.serializerConfig ?? {}
  const ids = new Map()
  const pathsById = new Map()
  const argumentShapes = new Map()
  const values = new Map()
  const options = { ...originalOptions }
  const config = { ...originalConfig }
  let sealed = false
  let sealedIds
  let sealedValues
  let consistent = true
  options.createModuleId = function (...args) {
    if (sealed) throw new Error('Baseline allocator recorder already sealed')
    const id = Reflect.apply(originalOptions.createModuleId, this === options ? originalOptions : this, args)
    if (ids.has(args[0]) && ids.get(args[0]) !== id) consistent = false
    if (pathsById.has(id) && pathsById.get(id) !== args[0]) consistent = false
    pathsById.set(id, args[0])
    ids.set(args[0], id)
    const shapes = argumentShapes.get(args[0]) ?? new Set()
    shapes.add(JSON.stringify(args.slice(1)))
    argumentShapes.set(args[0], shapes)
    return id
  }
  const record = (target, original, name) => {
    if (typeof original[name] !== 'function') return
    target[name] = function (...args) {
      if (sealed) throw new Error('Baseline callback recorder already sealed')
      const value = Reflect.apply(original[name], this === target ? original : this, args)
      const key = JSON.stringify([name, args])
      if (values.has(key) && JSON.stringify(values.get(key)) !== JSON.stringify(value)) consistent = false
      try { values.set(key, structuredClone(value)) } catch { consistent = false }
      return value
    }
  }
  record(options, originalOptions, 'getRunModuleStatement')
  record(config, originalConfig, 'getModulesRunBeforeMainModule')
  return {
    context: { ...context, options, serializerConfig: config },
    seal() { sealedIds = new Map(ids); sealedValues = new Map(values); sealed = true },
    supported() { return consistent },
    replayContext(trial) {
      const lookup = function (modulePath, ...args) {
        if (!sealedIds.has(modulePath)) throw invalidCandidate(`Unrecorded module ID path: ${modulePath}`)
        if (!argumentShapes.get(modulePath)?.has(JSON.stringify(args))) throw invalidCandidate(`Changed allocator context: ${modulePath}`)
        return sealedIds.get(modulePath)
      }
      const replayOptions = { ...trial.options, createModuleId: lookup }
      const replayConfig = { ...trial.serializerConfig }
      const replay = (target, name) => {
        if (typeof target[name] !== 'function') return
        target[name] = (...args) => {
          const key = JSON.stringify([name, args])
          if (sealedValues.has(key)) return structuredClone(sealedValues.get(key))
          // Newly split shared chunks are async and never run a main module;
          // Metro ignores runBeforeMainModule for them (getAppendScripts).
          if (name === 'getModulesRunBeforeMainModule' && args.length === 1 && /^__shared-[0-9a-f]{16}\.js$/.test(path.basename(args[0]))) return []
          throw invalidCandidate(`Unrecorded serializer callback: ${name}`)
        }
      }
      replay(replayOptions, 'getRunModuleStatement')
      replay(replayConfig, 'getModulesRunBeforeMainModule')
      return { ...trial, options: replayOptions, serializerConfig: replayConfig }
    },
  }
}

function supportsReplay(context) {
  const plugins = context.serializeChunkOptions?.unstable_beforeAssetSerializationPlugins
  if (plugins?.length || context.serializeChunkOptions?.includeSourceMaps || context.options.inlineSourceMap) return false
  const metadata = context.serializerConfig?.unstable_prepareWebChunkMetadata
  if (metadata && metadata !== require('./webChunkMetadataCodec').prepareWebChunkMetadata) return false
  // Only Metro's default pure filter is replayed on the new metadata prelude.
  // Arbitrary custom filters may inspect changing code or close over state.
  const filter = context.options.processModuleFilter
  if (filter) {
    const defaults = require('metro-config/private/defaults/index').default.getDefaultValues(context.options.projectRoot)
    if (Function.prototype.toString.call(filter) !== Function.prototype.toString.call(defaults.serializer.processModuleFilter)) return false
  }
  return true
}

/** Detect baseline hooks mutating any serializable input before the first trial. */
function serializationInputSignature(plan, context) {
  const hash = createHash('sha256')
  const modules = new Map([...context.graph.dependencies.values(), ...context.preModules].map((module) => [module.path, module]))
  for (const module of [...modules.values()].sort(byPath)) {
    hash.update(JSON.stringify([
      module.path, module.output,
      [...module.dependencies].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
    ]))
  }
  const atoms = (values) => values.map((atom) => [atom.ownerEntries.toString(), [...atom.modules].sort(byPath).map((module) => module.path)])
  hash.update(JSON.stringify({
    entries: plan.entryPoints.map((entry) => [entry.module.path, entry.kind]),
    raw: atoms(plan.rawAtoms), chunks: atoms(plan.chunks),
    owners: [...plan.dependentEntriesByModule].sort(([left], [right]) => byPath(left, right)).map(([module, owners]) => [module.path, owners.toString()]),
    workers: plan.workerEntries.map((module) => module.path),
    options: Object.fromEntries(Object.entries(context.options).filter(([key, value]) => key !== 'signal' && typeof value !== 'function')),
    transform: context.graph.transformOptions,
  }))
  return hash.digest('hex')
}

/** Preserve module identity across graph, preModules, plan Maps/Sets and workers. */
function cloneSerializationInputs(plan, context) {
  const seen = new Map()
  const CountingSet = require('@expo/metro/metro/lib/CountingSet').default
  const clone = (value) => {
    if (value === null || typeof value !== 'object') return value
    if (seen.has(value)) return seen.get(value)
    if (value === context.signal || value === context.options.signal) return value
    let leaf
    if (Buffer.isBuffer(value)) leaf = Buffer.from(value)
    else if (value instanceof Date) leaf = new Date(value)
    else if (value instanceof RegExp) leaf = new RegExp(value.source, value.flags)
    else if (value instanceof DataView) leaf = new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
    else if (ArrayBuffer.isView(value)) leaf = new value.constructor(value)
    else if (value instanceof ArrayBuffer) leaf = value.slice(0)
    if (leaf) { seen.set(value, leaf); return leaf }
    if (value instanceof CountingSet) {
      const copy = new CountingSet(value)
      seen.set(value, copy)
      return copy
    }
    const copy = value instanceof Map ? new Map() : value instanceof Set ? new Set() : Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value))
    seen.set(value, copy)
    if (value instanceof Map) for (const [key, item] of value) copy.set(clone(key), clone(item))
    else if (value instanceof Set) for (const item of value) copy.add(clone(item))
    else for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if ('value' in descriptor) descriptor.value = clone(descriptor.value)
      Object.defineProperty(copy, key, descriptor)
    }
    return copy
  }
  return clone({ plan, context })
}

function remapCandidate(candidate, snapshot) {
  const modules = new Map(snapshot.plan.rawAtoms.flatMap((atom) => [...atom.modules].map((module) => [module.path, module])))
  const chunks = candidate.chunks.map((chunk) => ({
    ownerEntries: chunk.ownerEntries,
    modules: new Set([...chunk.modules].map((module) => {
      const copy = modules.get(module.path)
      if (!copy) throw invalidCandidate(`Candidate introduces a module: ${module.path}`)
      return copy
    })),
  }))
  return withChunkRequirements(snapshot.plan, chunks)
}

function mergeGroups(left, right) {
  const needed = new Float64Array(left.needed.length)
  for (let route = 0; route < needed.length; route += 1) needed[route] = left.needed[route] + right.needed[route]
  return {
    ownerEntries: left.ownerEntries | right.ownerEntries,
    atoms: [...left.atoms, ...right.atoms],
    routes: orBits(left.routes, right.routes),
    bytes: left.bytes + right.bytes,
    needed,
  }
}

mergeGranularChunkPlan.refine = refineGranularChunkPlan

module.exports = {
  mergeGranularChunkPlan, createRouteCoverage, ROUTE_FOREIGN_BUDGET_BYTES,
  refineGranularChunkPlan, recordedSerialization, cloneSerializationInputs,
}
