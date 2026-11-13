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

module.exports = { mergeGranularChunkPlan, createRouteCoverage, ROUTE_FOREIGN_BUDGET_BYTES }
