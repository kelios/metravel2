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
 * there but never executed.
 */
const path = require('path')

// Raising it to 0.3 cut requests 28 -> 20 but added ~600 KB raw on the worst
// route; 0.35 gave 31 requests, worse than 0.4 (#1721, measured 2026-08).
const MIN_ROUTE_SIMILARITY = 0.4
const LAYOUT_FILE = /^_layout(\.[^/]+)?\.[jt]sx?$/

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

function similarity(left, right) {
  let intersection = 0
  let union = 0
  for (let i = 0; i < left.length; i += 1) {
    intersection += popcount32(left[i] & right[i])
    union += popcount32(left[i] | right[i])
  }
  return union ? intersection / union : 0
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
  const routes = inApp.filter((entryPath) => !LAYOUT_FILE.test(path.basename(entryPath)))
  const routeIndex = new Map(routes.map((route, index) => [route, index]))
  const words = Math.max(1, Math.ceil(routes.length / 32))
  const coverage = new Map()
  for (const entryPath of entryPaths) {
    const bits = new Uint32Array(words)
    if (entryPath.startsWith(prefix)) {
      const covered = LAYOUT_FILE.test(path.basename(entryPath))
        ? routes.filter((route) => route.startsWith(path.dirname(entryPath) + path.sep))
        : [entryPath]
      for (const route of covered) {
        const index = routeIndex.get(route)
        bits[index >>> 5] |= 1 << (index & 31)
      }
    }
    coverage.set(entryPath, bits)
  }
  return { coverage, words }
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
function placeAtoms(rawAtoms, initialOwners) {
  const modulesByOwners = new Map()
  for (const atom of rawAtoms) {
    const owners = (atom.ownerEntries & initialOwners) !== 0n ? atom.ownerEntries & initialOwners : atom.ownerEntries
    const modules = modulesByOwners.get(owners) ?? []
    modules.push(...atom.modules)
    modulesByOwners.set(owners, modules)
  }
  return [...modulesByOwners]
    .map(([ownerEntries, modules]) => ({ ownerEntries, modules: new Set(modules.sort(byPath)) }))
    .sort(byOwners)
}

/**
 * @param plan result of upstream `computeBitSetChunkPlan`
 * @param context granular strategy context ({ options: { projectRoot, serverRoot } })
 * @returns the plan with `chunks` and `requiredChunksByEntryPath` replaced
 */
function mergeGranularChunkPlan(plan, context, { minRouteSimilarity = MIN_ROUTE_SIMILARITY, appDir } = {}) {
  const { entryPoints, rawAtoms, dependentEntriesByModule } = plan
  const root = context?.options?.serverRoot ?? context?.options?.projectRoot ?? process.cwd()
  const entryPaths = entryPoints.map((entry) => entry.module.path)
  const entryPathSet = new Set(entryPaths)
  const { coverage, words } = createRouteCoverage(entryPaths, appDir ?? path.join(root, 'app'))

  let initialOwners = 0n
  entryPoints.forEach((entry, index) => {
    if (entry.kind === 'initial') initialOwners |= 1n << BigInt(index)
  })

  const atoms = placeAtoms(rawAtoms, initialOwners)
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
    for (const module of atom.modules) {
      if (entryPathSet.has(module.path)) routes = orBits(routes, coverage.get(module.path))
    }
    groups.push({ ownerEntries: atom.ownerEntries, atoms: [atom], routes })
  }

  // METRAVEL_ROUTE_SET_SIMILARITY (#1721): merge the most similar pair while it
  // stays above the floor. Similarity is measured on delivery routes, not on
  // owner entries: two groups riding almost the same routes ship together
  // almost always, and splitting them only buys requests and worse compression.
  // No size ceiling: 1 MiB vs 512 KiB gave a byte-identical release in #1721.
  const live = groups.slice()
  const alive = live.map(() => true)
  const n = live.length
  const matrix = new Float64Array(n * n)
  for (let left = 0; left < n; left += 1) {
    for (let right = left + 1; right < n; right += 1) {
      matrix[left * n + right] = similarity(live[left].routes, live[right].routes)
    }
  }
  for (;;) {
    let bestLeft = -1
    let bestRight = -1
    let best = minRouteSimilarity
    for (let left = 0; left < n; left += 1) {
      if (!alive[left]) continue
      for (let right = left + 1; right < n; right += 1) {
        if (alive[right] && matrix[left * n + right] > best) {
          best = matrix[left * n + right]
          bestLeft = left
          bestRight = right
        }
      }
    }
    if (bestLeft < 0) break
    live[bestLeft] = mergeGroups(live[bestLeft], live[bestRight])
    alive[bestRight] = false
    for (let other = 0; other < n; other += 1) {
      if (!alive[other] || other === bestLeft) continue
      const value = similarity(live[bestLeft].routes, live[other].routes)
      if (other < bestLeft) matrix[other * n + bestLeft] = value
      else matrix[bestLeft * n + other] = value
    }
  }
  const survivors = live.filter((_, index) => alive[index])

  // METRAVEL_MERGE_IDENTICAL_ROUTE_SETS (#1543): groups on the same route set
  // always ship together. Groups no route delivers (shared by lazy components
  // only) share the empty key and become one on-demand file, as with the
  // pre-SDK 58 patch: measured on #2741, keeping them apart (28 files) cost
  // +16.5 KB gzip on the release total for no change in any HTML route.
  // Equal owner sets are merged too, as upstream names a chunk by its owners.
  const parent = survivors.map((_, index) => index)
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  const firstByKey = new Map()
  survivors.forEach((group, index) => {
    for (const key of [`o:${group.ownerEntries.toString(16)}`, `r:${routeKey(group.routes)}`]) {
      if (firstByKey.has(key)) parent[find(index)] = find(firstByKey.get(key))
      else firstByKey.set(key, index)
    }
  })
  const mergedByRoot = new Map()
  survivors.forEach((group, index) => {
    const rootIndex = find(index)
    const existing = mergedByRoot.get(rootIndex)
    mergedByRoot.set(rootIndex, existing ? mergeGroups(existing, group) : group)
  })
  // A union above can land two results on one owner set; fold those too:
  // upstream materializes one file per owner set.
  const groupByOwners = new Map()
  for (const group of mergedByRoot.values()) {
    const existing = groupByOwners.get(group.ownerEntries)
    groupByOwners.set(group.ownerEntries, existing ? mergeGroups(existing, group) : group)
  }
  for (const group of groupByOwners.values()) {
    const modules = group.atoms.flatMap((atom) => [...atom.modules]).sort(byPath)
    chunks.push({ ownerEntries: group.ownerEntries, modules: new Set(modules) })
  }
  chunks.sort(byOwners)

  // Same rule as upstream's getRequiredChunksByEntryPath: an entry requires every
  // chunk holding a module it reaches synchronously, so each import() set and
  // each HTML route stays closed whatever was merged.
  const requiredByEntry = entryPoints.map(() => [])
  for (const chunk of chunks) {
    let requiredBy = 0n
    for (const module of chunk.modules) requiredBy |= dependentEntriesByModule.get(module) ?? 0n
    for (const index of ownerIndices(requiredBy)) requiredByEntry[index].push(chunk)
  }
  const requiredChunksByEntryPath = new Map(entryPaths.map((entryPath, index) => [entryPath, requiredByEntry[index]]))

  return { ...plan, chunks, requiredChunksByEntryPath }
}

function mergeGroups(left, right) {
  return {
    ownerEntries: left.ownerEntries | right.ownerEntries,
    atoms: [...left.atoms, ...right.atoms],
    routes: orBits(left.routes, right.routes),
  }
}

module.exports = { mergeGranularChunkPlan, createRouteCoverage, MIN_ROUTE_SIMILARITY }
