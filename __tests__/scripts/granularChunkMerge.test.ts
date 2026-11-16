/** @jest-environment node */
const path = require('path')
const vm = require('node:vm')
const fs = require('node:fs')
const zlib = require('node:zlib')
const { mergeGranularChunkPlan, createRouteCoverage, ROUTE_FOREIGN_BUDGET_BYTES } = require('../../scripts/lib/granularChunkMerge')

const ROOT = '/repo'
const APP = path.join(ROOT, 'app')
const at = (rel: string) => path.join(ROOT, rel)
type TestModule = { path: string; output?: { type: string; data?: { code?: string } }[]; isVirtual?: boolean; getSource?: () => Buffer }
const mod = (rel: string): TestModule => ({ path: at(rel) })

type Atom = { ownerEntries: bigint; modules: Set<TestModule> }

function makePlan(entries: [string, 'initial' | 'dynamic'][], atoms: [number[], string[]][]) {
  const entryPoints = entries.map(([rel, kind]) => ({ module: mod(rel), kind }))
  // Upstream `rawAtoms`: modules grouped by the exact entries reaching them.
  const rawAtoms: Atom[] = atoms.map(([owners, modules]) => ({
    ownerEntries: owners.reduce((bits, index) => bits | (1n << BigInt(index)), 0n),
    modules: new Set(modules.map(mod)),
  }))
  const dependentEntriesByModule = new Map()
  for (const atom of rawAtoms) for (const module of atom.modules) dependentEntriesByModule.set(module, atom.ownerEntries)
  return { entryPoints, rawAtoms, dependentEntriesByModule }
}

const context = { options: { projectRoot: ROOT } }
const names = (atom: Atom) => [...atom.modules].map((m) => path.relative(ROOT, m.path))
const chunkOf = (merged: { chunks: Atom[] }, file: string) => merged.chunks.find((atom) => names(atom).includes(file))

const factory = (bytes: number) => `__d(function(){/*${'.'.repeat(bytes - 22)}*/});`
function setFactory(plan: ReturnType<typeof makePlan>, file: string, bytes: number) {
  const module = plan.rawAtoms.flatMap((atom) => [...atom.modules]).find((item) => item.path === at(file))!
  module.output = [{ type: 'js/module', data: { code: factory(bytes) } }]
  return module
}

describe('granularChunkMerge', () => {
  it('delivers a route through its .web entry: the shadowed fallback is an entry point of no route', () => {
    const entries = ['app/_layout.tsx', 'app/_layout.web.tsx', 'app/index.tsx', 'app/index.web.tsx', 'app/map.tsx'].map(at)
    const { coverage, routes } = createRouteCoverage(entries, APP)
    expect(routes).toEqual([at('app/index.tsx'), at('app/map.tsx')])
    // Two routes (index, map): the .web pair is one delivery route, not two.
    expect(coverage.get(at('app/index.web.tsx'))).toEqual(new Uint32Array([1]))
    expect(coverage.get(at('app/map.tsx'))).toEqual(new Uint32Array([2]))
    expect(coverage.get(at('app/_layout.web.tsx'))).toEqual(new Uint32Array([3]))
    // The HTML of a route lists the files of the .web entry only (#3316).
    expect(coverage.get(at('app/index.tsx'))).toEqual(new Uint32Array([0]))
    expect(coverage.get(at('app/_layout.tsx'))).toEqual(new Uint32Array([0]))
  })

  it('keeps an SSR wrapper and its fallback in the web facade with closed requirements for both context keys', () => {
    const plan = makePlan(
      [['entry.js', 'initial'], ['app/index.tsx', 'dynamic'], ['app/index.web.tsx', 'dynamic'], ['app/map.tsx', 'dynamic']],
      [
        [[0], ['entry.js']],
        [[2], ['app/index.web.tsx']],
        [[1, 2], ['app/index.tsx', 'components/Home.tsx']],
        [[1], ['fallback-only.ts']],
        [[1, 2, 3], ['shared.ts']],
      ],
    )
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: -1 })
    const facade = chunkOf(merged, 'app/index.web.tsx')
    expect(facade.ownerEntries).toBe(0b100n)
    expect(names(facade)).toEqual(['app/index.tsx', 'app/index.web.tsx', 'components/Home.tsx'])
    expect(chunkOf(merged, 'fallback-only.ts').ownerEntries).toBe(0b10n)
    expect(chunkOf(merged, 'shared.ts').ownerEntries).toBe(0b1100n)
    expect(merged.requiredChunksByEntryPath.get(at('app/index.tsx'))).toEqual(expect.arrayContaining([
      facade, chunkOf(merged, 'fallback-only.ts'), chunkOf(merged, 'shared.ts'),
    ]))
    expect(merged.requiredChunksByEntryPath.get(at('app/index.web.tsx'))).toEqual(expect.arrayContaining([
      facade, chunkOf(merged, 'shared.ts'),
    ]))
    expect(merged.requiredChunksByEntryPath.get(at('app/map.tsx'))).toEqual([chunkOf(merged, 'shared.ts')])
    expect(merged.entryPoints).toBe(plan.entryPoints)
    expect(merged.dependentEntriesByModule).toBe(plan.dependentEntriesByModule)
  })

  it('route coverage: layout covers routes below it, route itself, non-app entry nothing', () => {
    const entryPaths = ['app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/map.tsx', 'app/about.tsx', 'components/Editor.tsx'].map(at)
    const { coverage } = createRouteCoverage(entryPaths, APP)
    const count = (rel: string) => [...coverage.get(at(rel))].reduce((n: number, w: number) => n + w.toString(2).split('1').length - 1, 0)
    expect(count('app/_layout.tsx')).toBe(3)
    expect(count('app/(tabs)/_layout.tsx')).toBe(2)
    expect(count('app/about.tsx')).toBe(1)
    expect(count('components/Editor.tsx')).toBe(0)
  })

  it('merges shared groups within the route budget and remaps every requirement', () => {
    const plan = makePlan(
      [
        ['entry.js', 'initial'],
        ['app/(tabs)/index.tsx', 'dynamic'],
        ['app/(tabs)/map.tsx', 'dynamic'],
        ['app/(tabs)/search.tsx', 'dynamic'],
        ['app/about.tsx', 'dynamic'],
      ],
      [
        [[0], ['entry.js']],
        [[1], ['app/(tabs)/index.tsx']],
        [[2], ['app/(tabs)/map.tsx']],
        [[1, 2], ['a.ts']],
        [[1, 2, 3], ['b.ts']],
        [[3, 4], ['c.ts']],
      ],
    )
    for (const file of ['a.ts', 'b.ts', 'c.ts']) setFactory(plan, file, 3000)
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: 3500 })
    // a+b saves a request on index and map for 3000 foreign bytes on search: one
    // file. Adding c would hand 6000 bytes to about, over the budget: c stays.
    const shared = merged.chunks.filter((atom: Atom) => names(atom).some((n) => !n.startsWith('app/') && n !== 'entry.js'))
    expect(shared.map(names)).toEqual(expect.arrayContaining([['a.ts', 'b.ts'], ['c.ts']]))
    expect(shared).toHaveLength(2)
    const ab = shared.find((atom: Atom) => names(atom).includes('a.ts'))
    expect(ab.ownerEntries).toBe(0b1110n)
    // An entry requires every file holding a module it reaches: search needs
    // the merged a+b file for b.ts, index needs it for a.ts and b.ts.
    const required = (rel: string) => merged.requiredChunksByEntryPath.get(at(rel))
    expect(required('app/(tabs)/index.tsx')).toEqual(expect.arrayContaining([ab, chunkOf(merged, 'app/(tabs)/index.tsx')]))
    expect(required('app/(tabs)/search.tsx')).toEqual(expect.arrayContaining([ab, chunkOf(merged, 'c.ts')]))
    expect(required('app/about.tsx')).toEqual([chunkOf(merged, 'c.ts')])
    // Single-owner and initial atoms stay in their own entry's file.
    expect(chunkOf(merged, 'entry.js').ownerEntries).toBe(0b1n)
    expect(names(chunkOf(merged, 'app/(tabs)/index.tsx'))).toEqual(['app/(tabs)/index.tsx'])
  })

  it('merges identical route sets, including groups only lazy components share', () => {
    const plan = makePlan(
      [
        ['entry.js', 'initial'],
        ['app/a.tsx', 'dynamic'],
        ['app/b.tsx', 'dynamic'],
        ['components/Editor.tsx', 'dynamic'],
        ['components/Pdf.tsx', 'dynamic'],
        ['components/Chart.tsx', 'dynamic'],
      ],
      [
        [[3, 4], ['lazy1.ts']],
        [[4, 5], ['lazy2.ts']],
        [[1, 3], ['x.ts']],
        [[1, 4], ['y.ts']],
      ],
    )
    const merged = mergeGranularChunkPlan(plan, context)
    const byModule = (file: string) => merged.chunks.find((atom: Atom) => names(atom).includes(file))
    expect(byModule('lazy1.ts')).toBe(byModule('lazy2.ts'))
    expect(byModule('lazy1.ts')).not.toBe(byModule('x.ts'))
    // x and y both reach only route a: identical route sets ship together.
    expect(byModule('x.ts')).toBe(byModule('y.ts'))
  })

  it('never folds the initial entry into a shared group', () => {
    const plan = makePlan(
      [
        ['entry.js', 'initial'],
        ['app/a.tsx', 'dynamic'],
        ['app/b.tsx', 'dynamic'],
      ],
      [
        [[0, 1], ['boot.ts']],
        [[1, 2], ['shared.ts']],
      ],
    )
    const merged = mergeGranularChunkPlan(plan, context)
    // boot.ts is reached by the initial entry, so it stays in the entry bundle.
    expect(chunkOf(merged, 'boot.ts').ownerEntries).toBe(0b1n)
    expect(merged.requiredChunksByEntryPath.get(at('app/a.tsx'))).toContain(chunkOf(merged, 'boot.ts'))
  })

  it('keeps code a lazily loaded entry shares with its only importer shared, not inside the importer', () => {
    // main => a => b (b only imported by a): upstream would move a/b code into a.
    const plan = makePlan(
      [
        ['entry.js', 'initial'],
        ['app/a.tsx', 'dynamic'],
        ['components/B.tsx', 'dynamic'],
      ],
      [
        [[1], ['app/a.tsx']],
        [[2], ['components/B.tsx']],
        [[1, 2], ['ab.ts']],
      ],
    )
    const merged = mergeGranularChunkPlan(plan, context)
    expect(names(chunkOf(merged, 'app/a.tsx'))).toEqual(['app/a.tsx'])
    expect(chunkOf(merged, 'ab.ts').ownerEntries).toBe(0b110n)
  })
})


const KB = 1024
const moduleBytes = (module: TestModule) => (module.output ?? []).reduce((bytes, output) => bytes + Buffer.byteLength(output.data?.code ?? '', 'utf8'), 0)
const isShared = (chunk: Atom) => (chunk.ownerEntries & 1n) === 0n && chunk.ownerEntries.toString(2).replace(/0/g, '').length > 1

/**
 * Foreign shared bytes per HTML route of a merged plan: what the files of the
 * route's entries (layouts above it and the route file) carry beyond the
 * modules those entries reach. Test plans have no .web pairs.
 */
function foreignByRoute(plan: ReturnType<typeof makePlan>, merged: { chunks: Atom[]; requiredChunksByEntryPath: Map<string, Atom[]> }) {
  const entryPaths = plan.entryPoints.map((entry) => entry.module.path)
  const isLayout = (entryPath: string) => path.basename(entryPath).startsWith('_layout.')
  const result = new Map<string, number>()
  entryPaths.forEach((routePath, routeIndex) => {
    if (!routePath.startsWith(APP + path.sep) || isLayout(routePath)) return
    let chain = 1n << BigInt(routeIndex)
    entryPaths.forEach((entryPath, index) => {
      if (isLayout(entryPath) && routePath.startsWith(path.dirname(entryPath) + path.sep)) chain |= 1n << BigInt(index)
    })
    const files = new Set<Atom>()
    entryPaths.forEach((entryPath, index) => {
      if ((chain & (1n << BigInt(index))) !== 0n) for (const chunk of merged.requiredChunksByEntryPath.get(entryPath) ?? []) files.add(chunk)
    })
    let foreign = 0
    for (const chunk of files) {
      if (!isShared(chunk)) continue
      for (const module of chunk.modules) {
        if ((plan.dependentEntriesByModule.get(module) & chain) === 0n) foreign += moduleBytes(module)
      }
    }
    result.set(path.relative(ROOT, routePath), foreign)
  })
  return result
}

// Deterministic generator (LCG): a root layout, eight routes, four lazy
// components and shared groups of 2.1-60 KB with random owners. Factories stay
// above the tiny-packing threshold, so the budget is the only source of foreign code.
function randomPlan(seed: number) {
  let state = seed >>> 0
  const next = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state % limit
  }
  const entries: [string, 'initial' | 'dynamic'][] = [
    ['entry.js', 'initial'],
    ['app/_layout.tsx', 'dynamic'],
    ...Array.from({ length: 8 }, (_, index): [string, 'dynamic'] => [`app/r${index}.tsx`, 'dynamic']),
    ...Array.from({ length: 4 }, (_, index): [string, 'dynamic'] => [`components/L${index}.tsx`, 'dynamic']),
  ]
  const ownerSets = new Map<string, number[]>()
  while (ownerSets.size < 40) {
    const owners = new Set<number>()
    const size = 2 + next(4)
    while (owners.size < size) owners.add(1 + next(entries.length - 1))
    const sorted = [...owners].sort((a, b) => a - b)
    ownerSets.set(sorted.join(','), sorted)
  }
  const atoms = [...ownerSets.values()].map((owners, index): [number[], string[]] => [owners, [`m${index}.ts`]])
  const plan = makePlan(entries, atoms)
  atoms.forEach(([, [file]]) => setFactory(plan, file, 2100 + next(58 * KB)))
  return plan
}

describe('route foreign budget (#3316)', () => {
  const homeMapPlan = (engineBytes: number) => {
    const plan = makePlan(
      [['entry.js', 'initial'], ['app/index.tsx', 'dynamic'], ['app/map.tsx', 'dynamic'], ['app/places.tsx', 'dynamic']],
      [[[1, 2, 3], ['gradient.ts']], [[2, 3], ['mapEngine.ts']]],
    )
    setFactory(plan, 'gradient.ts', 400)
    setFactory(plan, 'mapEngine.ts', engineBytes)
    return plan
  }

  it('pins the budget the committed bundle ceilings were measured with', () => {
    expect(ROUTE_FOREIGN_BUDGET_BYTES).toBe(128 * KB)
  })

  it('does not hand a route a large group for the sake of a small one it shares', () => {
    // The audited case: the home page reaches a 0.4 KB gradient the map routes
    // use too. The route sets are 2/3 alike, so the similarity merge shipped the
    // whole map file to the home page.
    const plan = homeMapPlan(150 * KB)
    const merged = mergeGranularChunkPlan(plan, context)
    expect(chunkOf(merged, 'gradient.ts')).not.toBe(chunkOf(merged, 'mapEngine.ts'))
    expect(merged.requiredChunksByEntryPath.get(at('app/index.tsx')).map(names)).toEqual([['gradient.ts']])
    expect(foreignByRoute(plan, merged).get('app/index.tsx')).toBe(0)
  })

  it('saves the request when the foreign code fits the budget', () => {
    const plan = homeMapPlan(100 * KB)
    const merged = mergeGranularChunkPlan(plan, context)
    expect(chunkOf(merged, 'gradient.ts')).toBe(chunkOf(merged, 'mapEngine.ts'))
    expect(foreignByRoute(plan, merged).get('app/index.tsx')).toBe(100 * KB)
  })

  it('counts the budget per route across all its shared files', () => {
    const plan = makePlan(
      [['entry.js', 'initial'], ...['home', 'a', 'b', 'c'].map((name): [string, 'dynamic'] => [`app/${name}.tsx`, 'dynamic'])],
      [[[1, 2, 3, 4], ['base.ts']], [[2, 3], ['first.ts']], [[3, 4], ['second.ts']]],
    )
    setFactory(plan, 'base.ts', 3000)
    setFactory(plan, 'first.ts', 80 * KB)
    setFactory(plan, 'second.ts', 80 * KB)
    const merged = mergeGranularChunkPlan(plan, context)
    // Either group alone fits beside base.ts; both would give home 160 KB.
    expect(chunkOf(merged, 'first.ts')).toBe(chunkOf(merged, 'base.ts'))
    expect(chunkOf(merged, 'second.ts')).not.toBe(chunkOf(merged, 'base.ts'))
    expect(foreignByRoute(plan, merged).get('app/home.tsx')).toBe(80 * KB)
  })

  it('spends the budget on the cheapest foreign bytes per saved request first', () => {
    const plan = makePlan(
      [['entry.js', 'initial'], ...['a', 'b', 'c', 'd'].map((name): [string, 'dynamic'] => [`app/${name}.tsx`, 'dynamic'])],
      [[[1, 2, 3, 4], ['base.ts']], [[1, 2, 3], ['small.ts']], [[1, 2], ['large.ts']]],
    )
    setFactory(plan, 'base.ts', 3000)
    setFactory(plan, 'small.ts', 10 * KB)
    setFactory(plan, 'large.ts', 100 * KB)
    // base+small: 10 KB to d for three requests; base+large: 200 KB for two.
    // Taking large first would leave no room for small on d (110 KB > 105 KB).
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: 105 * KB })
    expect(chunkOf(merged, 'small.ts')).toBe(chunkOf(merged, 'base.ts'))
    expect(chunkOf(merged, 'large.ts')).not.toBe(chunkOf(merged, 'base.ts'))
    const roomy = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: 110 * KB })
    expect(chunkOf(roomy, 'large.ts')).toBe(chunkOf(roomy, 'base.ts'))
  })

  it('never merges groups that share no route: there is no request to save', () => {
    const plan = makePlan(
      [['entry.js', 'initial'], ...['a', 'b', 'c', 'd'].map((name): [string, 'dynamic'] => [`app/${name}.tsx`, 'dynamic'])],
      [[[1, 2], ['ab.ts']], [[3, 4], ['cd.ts']]],
    )
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: Infinity })
    expect(chunkOf(merged, 'ab.ts')).not.toBe(chunkOf(merged, 'cd.ts'))
  })

  it('looks at a refused pair once instead of rescanning every pair after each refusal', () => {
    // Forty groups meet on one hub route and each has a route of its own: every
    // pair saves a request there, and the budget refuses all 780 of them.
    const groups = 40
    const plan = makePlan(
      [['entry.js', 'initial'], ['app/hub.tsx', 'dynamic'], ...Array.from({ length: groups }, (_, index): [string, 'dynamic'] => [`app/r${index}.tsx`, 'dynamic'])],
      Array.from({ length: groups }, (_, index): [number[], string[]] => [[1, 2 + index], [`g${index}.ts`]]),
    )
    for (let index = 0; index < groups; index += 1) setFactory(plan, `g${index}.ts`, 3000)
    const stats = { quotes: 0, candidates: 0 }
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: 1000, stats })
    expect(merged.chunks.filter(isShared)).toHaveLength(groups)
    const pairs = (groups * (groups - 1)) / 2
    expect(stats).toEqual({ quotes: pairs, candidates: pairs })
  })

  it.each([1, 21, 144])('re-quotes only the pairs of a merged group on a random plan (seed %i)', (seed) => {
    const stats = { quotes: 0, candidates: 0 }
    const merged = mergeGranularChunkPlan(randomPlan(seed), context, { routeForeignBudgetBytes: 50 * KB, stats })
    // At most 40 groups: their pairs once, then one row per merge.
    const merges = 40 - merged.chunks.filter(isShared).length
    expect(merges).toBeGreaterThan(0)
    expect(stats.quotes).toBeLessThanOrEqual((40 * 39) / 2 + merges * 39)
    expect(stats.candidates).toBeLessThanOrEqual(stats.quotes)
  })

  it.each([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233])('holds the budget, one file per owner set and closed requirements on a random plan (seed %i)', (seed) => {
    const budget = 50 * KB
    const plan = randomPlan(seed)
    const merged = mergeGranularChunkPlan(plan, context, { routeForeignBudgetBytes: budget })
    const shared = merged.chunks.filter(isShared)
    expect(shared.length).toBeLessThan(40)
    expect(new Set(shared.map((chunk: Atom) => chunk.ownerEntries)).size).toBe(shared.length)
    for (const [route, foreign] of foreignByRoute(plan, merged)) {
      expect({ route, withinBudget: foreign <= budget }).toEqual({ route, withinBudget: true })
    }
    plan.entryPoints.forEach((entry, index) => {
      const required = merged.requiredChunksByEntryPath.get(entry.module.path)
      for (const [module, consumers] of plan.dependentEntriesByModule) {
        if ((consumers & (1n << BigInt(index))) !== 0n) {
          expect(required.filter((chunk: Atom) => chunk.modules.has(module))).toHaveLength(1)
        }
      }
    })
    const reordered = { ...plan, rawAtoms: [...plan.rawAtoms].reverse() }
    expect(snapshotPlan(mergeGranularChunkPlan(reordered, context, { routeForeignBudgetBytes: budget }))).toEqual(snapshotPlan(merged))
  })
})

// A negative budget refuses every priced merge: only identical route sets ship together.
const noRouteMerging = { routeForeignBudgetBytes: -1 }
function snapshotPlan(plan: { chunks: Atom[]; requiredChunksByEntryPath: Map<string, Atom[]> }) {
  return {
    chunks: plan.chunks.map((chunk) => [chunk.ownerEntries.toString(), names(chunk)]),
    required: [...plan.requiredChunksByEntryPath].map(([entry, chunks]) => [entry, chunks.map(names)]),
  }
}

// These are all codec consumers captured from the failing 889ab release, not
// merely the HTML route subset. The two quest context keys remain distinct.
function capturedSearchPlan() {
  const ai = [2077, 2773, 2895, 2970]
  const skeleton = [2077, 2670, 2970, 3464, 3466, 3488, 3497, 3508]
  const styles = [2077, 2322, 2430, 2472, 2473, 2670, 2773, 2895, 2965, 2970, 3369, 3464, 3466, 3488, 3497, 3508, 3582, 3772]
  const ids = [...styles, ...Array.from({ length: 7 }, (_, index) => 4000 + index), 9999]
  const indexOf = (id: number) => ids.indexOf(id) + 1
  const search = indexOf(2970)
  const entries: [string, 'initial' | 'dynamic'][] = [['entry.js', 'initial'], ...ids.map((id): [string, 'dynamic'] => [`app/${id}.tsx`, 'dynamic'])]
  const atoms: [number[], string[]][] = [
    [[0], ['entry.js']], [[search], ['app/2970.tsx']],
    [ai.map(indexOf), ['ai.ts']], [skeleton.map(indexOf), ['skeleton.ts']], [styles.map(indexOf), ['styles.ts']],
    ...Array.from({ length: 7 }, (_, index): [number[], string[]] => [[search, indexOf(4000 + index)], [`other-${index}.ts`]]),
  ]
  const plan = makePlan(entries, atoms)
  for (const atom of plan.rawAtoms) for (const module of atom.modules) module.output = [{ type: 'js/module', data: { code: factory(9000) } }]
  setFactory(plan, 'ai.ts', 466)
  setFactory(plan, 'skeleton.ts', 1484)
  setFactory(plan, 'styles.ts', 14144)
  // Every route requires the real initial bundle as well.
  plan.dependentEntriesByModule.set([...plan.rawAtoms[0].modules][0], (1n << BigInt(entries.length)) - 1n)
  return plan
}

function subsetPlan(sourceBytes = 466) {
  const plan = makePlan(
    [['entry.js', 'initial'], ['app/a.tsx', 'dynamic'], ['app/b.tsx', 'dynamic'], ['app/c.tsx', 'dynamic']],
    [[[1, 2], ['tiny.ts']], [[1, 2, 3], ['styles.ts']]],
  )
  setFactory(plan, 'tiny.ts', sourceBytes)
  setFactory(plan, 'styles.ts', 9000)
  return plan
}

describe('bounded tiny shared factories', () => {
  it('packs the captured 12-request search closure without adding a request to any codec consumer', () => {
    const plan = capturedSearchPlan()
    const unmeasured = makePlan(
      plan.entryPoints.map((entry) => [path.relative(ROOT, entry.module.path), entry.kind]),
      plan.rawAtoms.map((atom) => [[...plan.entryPoints.keys()].filter((index) => (atom.ownerEntries & (1n << BigInt(index))) !== 0n), names(atom)]),
    )
    unmeasured.dependentEntriesByModule.set([...unmeasured.rawAtoms[0].modules][0], (1n << BigInt(plan.entryPoints.length)) - 1n)
    const before = mergeGranularChunkPlan(unmeasured, context, noRouteMerging)
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    expect(before.requiredChunksByEntryPath.get(at('app/2970.tsx'))).toHaveLength(12)
    expect(merged.requiredChunksByEntryPath.get(at('app/2970.tsx'))).toHaveLength(10)
    expect(chunkOf(merged, 'ai.ts')).toBe(chunkOf(merged, 'styles.ts'))
    expect(chunkOf(merged, 'skeleton.ts')).toBe(chunkOf(merged, 'styles.ts'))
    expect(names(chunkOf(merged, 'entry.js'))).toEqual(['entry.js'])
    expect(names(chunkOf(merged, 'app/2970.tsx'))).toEqual(['app/2970.tsx'])
    expect(merged.requiredChunksByEntryPath.get(at('app/9999.tsx')).map(names)).toEqual([['entry.js']])
    for (const [entry, oldChunks] of before.requiredChunksByEntryPath) {
      const required = merged.requiredChunksByEntryPath.get(entry)
      expect(required.length).toBeLessThanOrEqual(oldChunks.length)
      for (const atom of plan.rawAtoms) for (const module of atom.modules) {
        const consumer = plan.entryPoints.findIndex((item) => item.module.path === entry)
        if ((plan.dependentEntriesByModule.get(module) & (1n << BigInt(consumer))) !== 0n) {
          expect(required.filter((chunk: Atom) => chunk.modules.has(module))).toHaveLength(1)
        }
      }
    }
  })

  it('uses real SDK graph modules and transformed output, without reading or executing raw source', () => {
    const { computeBitSetChunkPlan } = require(path.join(path.dirname(require.resolve('@expo/metro-config/package.json')), 'build/serializer/chunking/computeBitSetChunks.js'))
    const graphModule = (file: string, bytes = 200) => ({ ...mod(file), dependencies: new Map(), output: [{ type: 'js/module', data: { code: factory(bytes) } }], getSource: jest.fn(() => { throw new Error('Raw source must not be read') }) })
    const entry = graphModule('entry.js')
    const routes = ['a', 'b', 'c'].map((name) => graphModule(`app/${name}.tsx`))
    const tiny = graphModule('tiny.ts', 466)
    const styles = graphModule('styles.ts', 9000)
    for (const route of routes) entry.dependencies.set(route.path, { absolutePath: route.path, data: { data: { asyncType: 'async' } } })
    for (const route of routes) route.dependencies.set(styles.path, { absolutePath: styles.path, data: { data: { asyncType: null } } })
    for (const route of routes.slice(0, 2)) route.dependencies.set(tiny.path, { absolutePath: tiny.path, data: { data: { asyncType: null } } })
    const graph = { dependencies: new Map([entry, ...routes, tiny, styles].map((module) => [module.path, module])) }
    const plan = computeBitSetChunkPlan([entry], graph, { isLazyBundle: false })
    expect([...plan.rawAtoms.flatMap((atom: Atom) => [...atom.modules])]).toContain(tiny)
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    expect(chunkOf(merged, 'tiny.ts')).toBe(chunkOf(merged, 'styles.ts'))
    expect(tiny.getSource).not.toHaveBeenCalled()
    expect(styles.getSource).not.toHaveBeenCalled()
  })

  it('uses actual synchronous consumers rather than normalized owner labels', () => {
    const plan = subsetPlan()
    plan.rawAtoms[1].ownerEntries = 0b1100n
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    expect(chunkOf(merged, 'tiny.ts')).toBe(chunkOf(merged, 'styles.ts'))
    expect(chunkOf(merged, 'styles.ts').ownerEntries).toBe(0b1100n)
    expect(merged.requiredChunksByEntryPath.get(at('app/a.tsx'))).toContain(chunkOf(merged, 'styles.ts'))
  })

  it.each([0b1010n, 0b1000n])('requires consumer coverage even when owner labels are a superset (%s)', (consumers) => {
    const plan = subsetPlan()
    const target = [...plan.rawAtoms[1].modules][0]
    plan.dependentEntriesByModule.set(target, consumers)
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    expect(chunkOf(merged, 'tiny.ts')).not.toBe(chunkOf(merged, 'styles.ts'))
  })

  it.each(['oversize', 'utf8', 'unknown', 'script', 'virtual', 'named', 'initial'])('keeps %s factories outside packing', (kind) => {
    const plan = subsetPlan()
    const tiny = [...plan.rawAtoms[0].modules][0]
    if (kind === 'oversize') setFactory(plan, 'tiny.ts', 2049)
    if (kind === 'utf8') tiny.output = [{ type: 'js/module', data: { code: '雪'.repeat(700) } }]
    if (kind === 'unknown') delete tiny.output
    if (kind === 'script') tiny.output![0].type = 'js/script'
    if (kind === 'virtual') tiny.isVirtual = true
    if (kind === 'named') tiny.path = at('app/a.tsx')
    if (kind === 'initial') plan.rawAtoms[0].ownerEntries |= 1n
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    expect(chunkOf(merged, path.relative(ROOT, tiny.path))).not.toBe(chunkOf(merged, 'styles.ts'))
  })

  it('bounds cumulative extra factory bytes for each receiver consumer', () => {
    const plan = makePlan(
      [['entry.js', 'initial'], ...['a', 'b', 'c', 'd', 'receiver'].map((name): [string, 'dynamic'] => [`app/${name}.tsx`, 'dynamic'])],
      [[[1, 2], ['one.ts']], [[2, 3], ['two.ts']], [[3, 4], ['three.ts']], [[1, 2, 3, 4, 5], ['styles.ts']]],
    )
    for (const file of ['one.ts', 'two.ts', 'three.ts']) setFactory(plan, file, 1800)
    setFactory(plan, 'styles.ts', 9000)
    const merged = mergeGranularChunkPlan(plan, context, noRouteMerging)
    const receiver = merged.requiredChunksByEntryPath.get(at('app/receiver.tsx'))
    expect(receiver).toHaveLength(1)
    const extra = [...receiver[0].modules].filter((module: TestModule) => module.path !== at('styles.ts'))
    expect(extra).toHaveLength(2)
    expect(extra.reduce((bytes: number, module: TestModule) => bytes + Buffer.byteLength(module.output![0].data!.code!, 'utf8'), 0)).toBeLessThanOrEqual(4096)
    expect(merged.chunks).toHaveLength(2)
  })

  it('does not execute module factories and is deterministic for reordered inputs', () => {
    const plan = capturedSearchPlan()
    const modules = plan.rawAtoms.flatMap((atom) => [...atom.modules])
    const readers = modules.map((module) => module.getSource = jest.fn(() => { throw new Error('Do not execute source') }))
    const reordered = {
      ...plan,
      rawAtoms: [...plan.rawAtoms].reverse().map((atom) => ({ ...atom, modules: new Set([...atom.modules].reverse()) })),
      dependentEntriesByModule: new Map([...plan.dependentEntriesByModule].reverse()),
    }
    expect(snapshotPlan(mergeGranularChunkPlan(plan, context, noRouteMerging)))
      .toEqual(snapshotPlan(mergeGranularChunkPlan(reordered, context, noRouteMerging)))
    readers.forEach((reader) => expect(reader).not.toHaveBeenCalled())
  })
})


type ScriptAsset = {
  filename: string; type: string; source: string
  metadata: { entryChunks?: Record<string, string[]>; entryPaths: string[]; requires: string[]; modulePaths: string[]; isAsync: boolean; paths: Record<string, unknown> }
}
type PriorityState = { priorities: readonly string[] | undefined }
const fixtureHome = 'app/(tabs)/index.tsx'
const fixtureProfile = 'app/(tabs)/profile.tsx'
const fixtureDetail = 'app/(tabs)/detail.tsx'
const sdkRoot = path.dirname(require.resolve('@expo/metro-config/package.json'))
const { createGranularChunkingStrategy } = require(path.join(sdkRoot, 'build/serializer/chunking/createGranularChunkingStrategy'))
const { refineGranularChunkPlan, recordedSerialization, cloneSerializationInputs } = require('../../scripts/lib/granularChunkMerge')
const { prepareWebChunkMetadata } = require('../../scripts/lib/webChunkMetadataCodec')
const { registryFromSources } = require('../../scripts/lib/webChunkMetadataArtifact')
const { parseChunk } = require('../../scripts/lib/webChunkGraph')
const { getGranularModuleIdPriorities } = require('../../scripts/lib/granularModuleIdPriority')
const { getGranularAssetsForRoute } = require(path.join(path.dirname(require.resolve('@expo/cli/package.json')), 'build/src/start/server/metro/serializeHtml'))
const CountingSet = require('@expo/metro/metro/lib/CountingSet').default
const getPreludeCode = require('metro/private/lib/getPreludeCode').default

function entropy(bytes: number, seed: number) {
  let value = seed
  return Array.from({ length: bytes }, () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return String.fromCharCode(65 + ((value >>> 16) % 26))
  }).join('')
}

function serializedModule(file: string, body = '', edges: [string, string | null][] = []) {
  const code = `__d(function(g,r,i,a,m,e,d){${body}});`
  return {
    path: at(file), getSource: () => Buffer.from(code), inverseDependencies: new CountingSet(),
    dependencies: new Map(edges.map(([file, asyncType], index) => [String(index), {
      absolutePath: at(file), data: { key: String(index), name: file, data: { asyncType } },
    }])),
    output: [{ type: 'js/module', data: { code, lineCount: 1, map: [] } }],
  }
}

function serializationFixture(unrelated = false, worker = false) {
  const entries: [string, 'initial' | 'dynamic'][] = [
    ['entry.js', 'initial'], [fixtureHome, 'dynamic'], [fixtureDetail, 'dynamic'], [fixtureProfile, 'dynamic'],
    ['components/Inspector.tsx', 'dynamic'], ['components/Editor.tsx', 'dynamic'], ['app/_layout.tsx', 'dynamic'],
    ...(unrelated ? ['u', 'v', 'w'].map((name): [string, 'dynamic'] => [`app/${name}.tsx`, 'dynamic']) : []),
  ]
  const atoms: [number[], string[]][] = [
    ...entries.map(([file], index): [number[], string[]] => [[index], [file]]),
    [[1, 2, 3], ['core.ts', 'core-extra.ts']], [[3, 4, 5], ['private.ts']],
    ...(unrelated ? [[[7, 8], ['unrelated-x.ts']], [[8, 9], ['unrelated-y.ts']]] as [number[], string[]][] : []),
  ]
  const raw = makePlan(entries, atoms)
  const modules = new Map(raw.rawAtoms.flatMap((atom) => [...atom.modules]).map((module) => {
    const file = path.relative(ROOT, module.path)
    let body = 'e.value="route";'
    let edges: [string, string | null][] = []
    if (file === 'entry.js') { body = 'g.events.push("entry");'; edges = entries.slice(1).map(([file]) => [file, 'async']) }
    if (file === 'core.ts') body = `g.events.push("core");e.value="core";/*${entropy(6000, 1)}*/`
    if (file === 'core-extra.ts') body = `g.events.push("extra");e.value="extra";/*${entropy(2200, 2)}*/`
    if (file === 'private.ts') body = `g.events.push("private");e.value="private";/*${entropy(9000, 3)}*/`
    if ([fixtureHome, fixtureDetail].includes(file)) { body = 'e.value=r(d[0]).value+r(d[1]).value;'; edges = [['core.ts', null], ['core-extra.ts', null]] }
    if (file === fixtureProfile) { body = 'r(d[2]);e.value=r(d[0]).value+r(d[1]).value;'; edges = [['core.ts', null], ['private.ts', null], ['core-extra.ts', null]] }
    if (file.startsWith('components/')) edges = [['private.ts', null]]
    if (file === 'app/u.tsx') edges = [['unrelated-x.ts', null]]
    if (file === 'app/v.tsx') edges = [['unrelated-x.ts', null], ['unrelated-y.ts', null]]
    if (file === 'app/w.tsx') edges = [['unrelated-y.ts', null]]
    if (file === 'unrelated-x.ts') body = `e.value="x";/*${entropy(40000, 4)}*/`
    if (file === 'unrelated-y.ts') body = `e.value="y";/*${entropy(50000, 5)}*/`
    return [file, serializedModule(file, body, edges)] as const
  }))
  const plan = {
    ...raw,
    entryPoints: raw.entryPoints.map((entry) => ({ ...entry, module: modules.get(path.relative(ROOT, entry.module.path))! })),
    rawAtoms: raw.rawAtoms.map((atom) => ({ ...atom, modules: new Set([...atom.modules].map((module) => modules.get(path.relative(ROOT, module.path))!)) })),
    dependentEntriesByModule: new Map([...raw.dependentEntriesByModule].map(([module, owners]) => [modules.get(path.relative(ROOT, module.path))!, owners])),
    workerEntries: [] as ReturnType<typeof serializedModule>[],
  }
  if (worker) {
    const target = serializedModule('worker.js', 'e.value="worker";', [['core.ts', null]])
    modules.set('worker.js', target)
    plan.workerEntries.push(target)
    modules.get('entry.js')!.dependencies.set('worker', { absolutePath: target.path, data: { key: 'worker', name: 'worker.js', data: { asyncType: 'worker' } } })
  }
  const runtime = fs.readFileSync(require.resolve('metro-runtime/src/polyfills/require'), 'utf8')
  const script = (file: string, code: string) => ({ ...serializedModule(file), output: [{ type: 'js/script', data: { code, lineCount: code.split('\n').length, map: [] } }] })
  const preModules = [script('prelude.js', getPreludeCode({ isDev: false, globalPrefix: '' })), script('runtime.js', runtime)]
  const ids = new Map<string, number>()
  const calls: string[] = []
  const priorities = jest.fn(getGranularModuleIdPriorities)
  const ctx = {
    entryFile: at('entry.js'), preModules,
    graph: { dependencies: new Map([...modules.values()].map((module) => [module.path, module])), entryPoints: new Set([at('entry.js')]), transformOptions: { platform: 'web', customTransformOptions: { environment: 'client' } } },
    options: {
      projectRoot: ROOT, serverRoot: ROOT, dev: false, runModule: true, modulesOnly: false, globalPrefix: '', includeAsyncPaths: false,
      createModuleId(file: string) { calls.push(file); if (!ids.has(file)) ids.set(file, ids.size); return ids.get(file)! },
      getRunModuleStatement: (id: number) => `__r(${id});`,
      serializerOptions: { exporting: true, splitChunks: true, includeSourceMaps: false },
    },
    serializerConfig: { unstable_prepareWebChunkMetadata: prepareWebChunkMetadata, unstable_getGranularModuleIdPriorities: priorities, getModulesRunBeforeMainModule: () => [] as string[] },
    serializeChunkOptions: { chunkingStrategy: 'granular', includeSourceMaps: false },
  }
  return { plan: mergeGranularChunkPlan(plan, { options: { projectRoot: ROOT } }), context: ctx, modules, ids, calls, priorities }
}

type Fixture = ReturnType<typeof serializationFixture>
async function emit(plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState): Promise<{ assets: ScriptAsset[]; priorities: readonly string[] | undefined }> {
  const strategy = createGranularChunkingStrategy(context)
  expect(typeof strategy.serializePlan).toBe('function') // Must use the reviewed installed extension, not a mock emitter.
  return strategy.serializePlan(plan, frozen)
}

function routeAssets(assets: ScriptAsset[], route: string) {
  return getGranularAssetsForRoute(assets, [at('app/_layout.tsx'), at(route)]) as ScriptAsset[]
}
function deliveredBrotli(assets: ScriptAsset[], route: string) {
  return routeAssets(assets, route).reduce((sum, asset) => sum + zlib.brotliCompressSync(Buffer.from(asset.source), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length, 0)
}

async function policyFor(unrelated = false): Promise<Policy> {
  const control = serializationFixture(unrelated)
  const baseline = await emit(control.plan, control.context)
  const homeBytes = deliveredBrotli(baseline.assets, fixtureHome)
  return {
    htmlRoutes: true, maxRequests: 27, maxBrotliKB: 1000, tolerancePct: 0,
    maxRequestsByRoute: {
      'index.html': routeAssets(baseline.assets, fixtureHome).length,
      'detail.html': routeAssets(baseline.assets, fixtureDetail).length,
      '(tabs)/profile/index.html': routeAssets(baseline.assets, fixtureProfile).length + 1,
    },
    maxBrotliBytesByRoute: { 'index.html': homeBytes - 1 },
  }
}

type Policy = {
  htmlRoutes: boolean; maxRequests: number; maxBrotliKB: number; tolerancePct: number
  maxRequestsByRoute: Record<string, number>; maxBrotliBytesByRoute: Record<string, number>; maxBrotliKBByRoute?: Record<string, number>
}
async function withPolicy<T>(policy: Policy, action: () => Promise<T>) {
  const exists = fs.existsSync
  const read = fs.readFileSync
  const file = at('config/bundle-budget.json')
  const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((candidate: unknown) => candidate === file || exists(candidate))
  const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((candidate: unknown, ...args: unknown[]) => candidate === file ? JSON.stringify({ eager: policy }) : Reflect.apply(read, fs, [candidate, ...args]))
  try { return await action() } finally { existsSpy.mockRestore(); readSpy.mockRestore() }
}

async function refined(policy: Policy, unrelated = false) {
  const fixture = serializationFixture(unrelated)
  const emissions: { plan: Fixture['plan']; assets: ScriptAsset[]; calls: number; frozen: PriorityState | undefined }[] = []
  const assets = await withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
    const result = await emit(plan, context, frozen)
    emissions.push({ plan, assets: result.assets, calls: fixture.calls.length, frozen })
    return result
  })) as ScriptAsset[]
  return { ...fixture, assets, emissions }
}

describe('measured single-split serialization', () => {
  let policy: Policy
  beforeAll(async () => { policy = await policyFor() })

  it('keeps ordinary greedy/tiny as the no-cut baseline and returns its identical asset array when no current byte constraint is violated', async () => {
    const wide = { ...policy, maxBrotliBytesByRoute: { 'index.html': 1000000 } }
    const normal = serializationFixture()
    const expected = await emit(normal.plan, normal.context)
    const result = await refined(wide)
    expect(result.emissions).toHaveLength(1)
    expect(result.assets).toBe(result.emissions[0].assets)
    expect(result.assets).toEqual(expected.assets)
    // The ordinary public dispatcher uses an unadorned merge function, so it
    // cannot invoke the optional late refiner or share a trial session.
    const ordinary = serializationFixture()
    const dispatcherContext = { ...ordinary.context, serializerConfig: {
      ...ordinary.context.serializerConfig,
      unstable_mergeGranularChunkPlan: (plan: Fixture['plan'], context: Fixture['context']) => mergeGranularChunkPlan(plan, context),
    } }
    const ordinaryAssets = await createGranularChunkingStrategy(dispatcherContext).serializeAsync()
    expect(result.assets).toEqual(ordinaryAssets)
    expect(chunkOf(result.plan, 'core.ts')).toBe(chunkOf(result.plan, 'private.ts'))
  })

  it('closes the actual eager-byte violation with one cut, preserving modules, original atoms, closure and named/initial files', async () => {
    const result = await refined(policy)
    const selected = result.emissions.find((emission) => emission.assets === result.assets)!
    expect(selected.frozen).toBeDefined()
    expect(selected.plan.chunks).toHaveLength(result.plan.chunks.length + 1)
    expect(chunkOf(selected.plan, 'core.ts')).not.toBe(chunkOf(selected.plan, 'private.ts'))
    expect(chunkOf(selected.plan, 'core.ts')).toBe(chunkOf(selected.plan, 'core-extra.ts'))
    const before = result.plan.chunks.flatMap((atom: Atom) => names(atom)).sort()
    expect(selected.plan.chunks.flatMap((atom: Atom) => names(atom)).sort()).toEqual(before)
    expect(new Set(selected.plan.chunks.map((atom: Atom) => atom.ownerEntries)).size).toBe(selected.plan.chunks.length)
    for (const [entry, chunks] of result.plan.requiredChunksByEntryPath) {
      const after = selected.plan.requiredChunksByEntryPath.get(entry)
      expect(after.length - chunks.length).toBeGreaterThanOrEqual(0)
      expect(after.length - chunks.length).toBeLessThanOrEqual(1)
    }
    for (const [route, foreign] of foreignByRoute(selected.plan, selected.plan)) {
      expect(foreign).toBeLessThanOrEqual(foreignByRoute(result.plan, result.plan).get(route)!)
      expect(foreign).toBeLessThanOrEqual(ROUTE_FOREIGN_BUDGET_BYTES)
    }
    for (const file of ['entry.js', fixtureHome, fixtureDetail, fixtureProfile]) expect(names(chunkOf(selected.plan, file))).toEqual(names(chunkOf(result.plan, file)))
    expect(deliveredBrotli(result.assets, fixtureHome)).toBeLessThanOrEqual(policy.maxBrotliBytesByRoute['index.html'])
    selected.plan.entryPoints.forEach((entry: { module: TestModule }, index: number) => {
      const required = selected.plan.requiredChunksByEntryPath.get(entry.module.path)
      for (const [module, owners] of selected.plan.dependentEntriesByModule) {
        if ((owners & (1n << BigInt(index))) !== 0n) expect(required.filter((chunk: Atom) => chunk.modules.has(module))).toHaveLength(1)
      }
    })
  })

  it('chooses reduction of a currently violated byte cap over a larger unrelated raw relief', async () => {
    const constrained = await policyFor(true)
    const result = await refined(constrained, true)
    const selected = result.emissions.find((emission) => emission.assets === result.assets)!.plan
    expect(chunkOf(selected, 'core.ts')).not.toBe(chunkOf(selected, 'private.ts'))
    expect(chunkOf(selected, 'unrelated-x.ts')).toBe(chunkOf(selected, 'unrelated-y.ts'))
    expect(deliveredBrotli(result.assets, fixtureHome)).toBeLessThanOrEqual(constrained.maxBrotliBytesByRoute['index.html'])
    expect(result.emissions.length).toBeGreaterThan(2) // Evaluates eligible alternatives, not only a guessed top cut.
  })

  it('never calls the real allocator or recomputes home priorities after the complete baseline', async () => {
    const result = await refined(policy)
    const count = result.emissions[0].calls
    expect(result.emissions.length).toBeGreaterThan(1)
    expect(result.emissions.every((emission) => emission.calls === count)).toBe(true)
    expect(result.priorities).toHaveBeenCalledTimes(1)
    const selected = result.emissions.find((emission) => emission.assets === result.assets)!
    const wouldChange = getGranularModuleIdPriorities(selected.plan, result.context)
    expect(wouldChange).not.toEqual(result.priorities.mock.results[0].value)
    expect(selected.frozen!.priorities).toEqual(result.priorities.mock.results[0].value)
    expect(Object.isFrozen(selected.frozen!.priorities)).toBe(true)
    expect(result.assets).toBe(selected.assets) // No second emission after measuring the winner.
  })

  it('respects a tight normalized request cap even when another route has spare requests', async () => {
    const limited = { ...policy, maxRequestsByRoute: { ...policy.maxRequestsByRoute, '(tabs)/profile/index.html': policy.maxRequestsByRoute['(tabs)/profile/index.html'] - 1 } }
    const result = await refined(limited)
    expect(result.emissions).toHaveLength(1)
    expect(result.assets).toBe(result.emissions[0].assets)
  })

  it('supports the legacy rounded KiB constraint with the same actual-byte basis', async () => {
    const coarse = { ...policy, maxBrotliBytesByRoute: {}, maxBrotliKBByRoute: { 'index.html': Math.floor(policy.maxBrotliBytesByRoute['index.html'] / 102.4) / 10 } }
    const result = await refined(coarse)
    expect(result.emissions.find((emission) => emission.assets === result.assets)!.frozen).toBeDefined()
    const { roundedByteLimit } = require('../../scripts/lib/bundleBudgetReport')
    expect(deliveredBrotli(result.assets, fixtureHome)).toBeLessThanOrEqual(roundedByteLimit(coarse.maxBrotliKBByRoute['index.html']))
  })

  it.each([
    { entry: 'source', mode: 'missing' }, { entry: 'layout', mode: 'missing' },
    { entry: 'source', mode: 'empty' }, { entry: 'layout', mode: 'empty' },
    { entry: 'source', mode: 'wrong-owner' }, { entry: 'layout', mode: 'wrong-owner' },
    { entry: 'source', mode: 'unknown-file' }, { entry: 'layout', mode: 'unknown-file' },
    { entry: 'source', mode: 'duplicate-filename' },
  ])('rejects a $mode $entry mapping before pricing an accidental initial-only script set', async ({ entry, mode }) => {
    const fixture = serializationFixture()
    await expect(withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context']) => {
      const result = await emit(plan, context)
      const carrier = result.assets.find((asset) => asset.metadata.entryChunks)!
      const mapping = carrier.metadata.entryChunks!
      const mappingPath = at(entry === 'layout' ? 'app/_layout.tsx' : fixtureHome)
      if (mode === 'duplicate-filename') result.assets.push(result.assets[0])
      else if (mode === 'missing') delete mapping[mappingPath]
      else if (mode === 'empty') mapping[mappingPath] = []
      else if (mode === 'wrong-owner') mapping[mappingPath] = [carrier.filename]
      else mapping[mappingPath] = ['not-in-emitted-assets.js']
      return result
    }))).rejects.toThrow(mode === 'duplicate-filename' ? 'duplicate' : mode === 'missing' ? 'Missing source/layout' : 'Invalid source/layout root')
  })

  it('rejects an unknown-ID trial without leaking its mutations to the next trial or real allocator', async () => {
    const constrained = await policyFor(true)
    const fixture = serializationFixture(true)
    const original = fixture.modules.get('core.ts')!.output[0].data.code
    let rejected = false
    let validTrials = 0
    const result = await withPolicy(constrained, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
      if (frozen && !rejected) {
        rejected = true
        context.graph.dependencies.get(at('core.ts'))!.output[0].data.code = 'poisoned first trial'
        context.options.createModuleId(at('never-in-baseline.ts'))
        throw new Error('Strict lookup must have rejected this path')
      }
      if (frozen) {
        validTrials += 1
        expect(context.graph.dependencies.get(at('core.ts'))!.output[0].data.code).toBe(original)
      }
      return emit(plan, context, frozen)
    })) as ScriptAsset[]
    expect(rejected).toBe(true)
    expect(validTrials).toBeGreaterThan(0)
    expect(fixture.modules.get('core.ts')!.output[0].data.code).toBe(original)
    expect(fixture.ids.has(at('never-in-baseline.ts'))).toBe(false)
    expect(deliveredBrotli(result, fixtureHome)).toBeLessThanOrEqual(constrained.maxBrotliBytesByRoute['index.html'])
  })

  it('rejects a newly violated route byte cap rather than trading it for the original breach', async () => {
    const fixture = serializationFixture()
    const control = serializationFixture()
    const baseline = await emit(control.plan, control.context)
    const profileCap = deliveredBrotli(baseline.assets, fixtureProfile)
    const constrained = { ...policy, maxBrotliBytesByRoute: { ...policy.maxBrotliBytesByRoute, 'profile.html': profileCap } }
    let baselineAssets: ScriptAsset[] = []
    let trials = 0
    const result = await withPolicy(constrained, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
      const emitted = await emit(plan, context, frozen)
      if (!frozen) baselineAssets = emitted.assets
      else {
        trials += 1
        const profile = emitted.assets.find((asset) => asset.metadata.modulePaths.includes(at(fixtureProfile)))!
        profile.source += `
/*${entropy(12000, 11)}*/`
      }
      return emitted
    }))
    expect(trials).toBeGreaterThan(0)
    expect(result).toBe(baselineAssets)
  })

  it.each(['baseline', 'winning-trial'])('observes cancellation when the %s emitter promise resolves successfully', async (phase) => {
    const fixture = serializationFixture()
    const controller = new AbortController()
    const reason = new Error(`resolved ${phase} abort`)
    Object.assign(fixture.context, { signal: controller.signal })
    let successfulEmitterAbort = false
    await expect(withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
      const result = await emit(plan, context, frozen)
      if ((phase === 'baseline' && !frozen) || (phase === 'winning-trial' && frozen)) {
        if (frozen) expect(deliveredBrotli(result.assets, fixtureHome)).toBeLessThanOrEqual(policy.maxBrotliBytesByRoute['index.html'])
        controller.abort(reason)
        successfulEmitterAbort = true
      }
      return result // Resolves normally; the refiner must check the signal after await.
    }))).rejects.toBe(reason)
    expect(successfulEmitterAbort).toBe(true)
  })

  it('does not hide cancellation or an actual codec/serializer failure as an ineligible trial', async () => {
    for (const error of [Object.assign(new Error('cancelled'), { name: 'AbortError' }), new Error('codec mismatch')]) {
      const fixture = serializationFixture()
      await expect(withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
        if (frozen) throw error
        return emit(plan, context)
      }))).rejects.toBe(error)
    }
  })

  it('returns the normal baseline once when a mutating plugin or custom module filter is unsupported', async () => {
    for (const kind of ['plugin', 'filter']) {
      const fixture = serializationFixture()
      const plugin = jest.fn(({ premodules }: { premodules: unknown[] }) => premodules)
      if (kind === 'plugin') Object.assign(fixture.context.serializeChunkOptions, { unstable_beforeAssetSerializationPlugins: [plugin] })
      else Object.assign(fixture.context.options, { processModuleFilter: (module: TestModule) => module.path !== at('not-in-graph') })
      const outputs: ScriptAsset[][] = []
      const result = await withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
        expect(frozen).toBeUndefined()
        const result = await emit(plan, context)
        outputs.push(result.assets)
        return result
      }))
      expect(outputs).toHaveLength(1)
      expect(result).toBe(outputs[0])
    }
  })

  it('does not probe after a baseline hook mutates serializable graph or options state', async () => {
    const fixture = serializationFixture()
    const normalPriority = fixture.context.serializerConfig.unstable_getGranularModuleIdPriorities
    Object.assign(fixture.context.serializerConfig, { unstable_getGranularModuleIdPriorities: (plan: Fixture['plan'], context: Fixture['context']) => {
      context.graph.dependencies.get(at('core.ts'))!.output[0].data.code += '/*baseline hook mutation*/'
      return normalPriority(plan, context)
    } })
    const outputs: ScriptAsset[][] = []
    const result = await withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, async (plan: Fixture['plan'], context: Fixture['context'], frozen?: PriorityState) => {
      expect(frozen).toBeUndefined()
      const emitted = await emit(plan, context)
      outputs.push(emitted.assets)
      return emitted
    }))
    expect(outputs).toHaveLength(1)
    expect(result).toBe(outputs[0])
  })

  it('keeps registered dependency maps/codec closures correct and never executes foreign factories during serialization or eager loading', async () => {
    const result = await refined(policy)
    const registry = registryFromSources(result.assets.map((asset) => asset.source))
    expect(registry).not.toBeNull()
    for (const asset of result.assets) {
      const definitions = parseChunk(asset.source, registry)
      for (const [id, paths] of Object.entries(asset.metadata.paths)) {
        for (const [target, filenames] of Object.entries(paths as Record<string, string[]>)) expect(definitions.get(Number(id)).paths.get(Number(target))).toEqual(filenames)
      }
    }
    const sandbox = vm.createContext({ events: [], document: { currentScript: null } })
    sandbox.global = sandbox
    for (const asset of routeAssets(result.assets, fixtureHome)) vm.runInContext(asset.source, sandbox)
    expect(sandbox.events).not.toContain('private')
    expect(sandbox.__r(result.ids.get(at(fixtureHome))).value).toBe('coreextra')
    expect(sandbox.events).toEqual(expect.arrayContaining(['entry', 'core', 'extra']))
    expect(sandbox.events.filter((event: string) => event === 'core')).toHaveLength(1)
  })

  it('is deterministic for reordered atom/map/module input and returns the exact chosen trial assets', async () => {
    const normal = await refined(policy)
    const fixture = serializationFixture()
    fixture.plan.rawAtoms.reverse()
    fixture.plan.chunks.reverse()
    fixture.plan.dependentEntriesByModule = new Map([...fixture.plan.dependentEntriesByModule].reverse())
    const chosen = await withPolicy(policy, () => refineGranularChunkPlan(fixture.plan, fixture.context, emit))
    expect(chosen).toEqual(normal.assets)
  })

  it('preserves one identity remap across graph, plan entries/atoms/Maps, preModules and workers', () => {
    const fixture = serializationFixture(false, true)
    const cloned = cloneSerializationInputs(fixture.plan, fixture.context)
    for (const entry of cloned.plan.entryPoints) expect(entry.module).toBe(cloned.context.graph.dependencies.get(entry.module.path))
    for (const atom of cloned.plan.rawAtoms) for (const module of atom.modules) {
      expect(module).toBe(cloned.context.graph.dependencies.get(module.path))
      expect(cloned.plan.dependentEntriesByModule.has(module)).toBe(true)
    }
    expect(cloned.plan.workerEntries[0]).toBe(cloned.context.graph.dependencies.get(at('worker.js')))
    expect(cloned.plan.workerEntries[0]).not.toBe(fixture.plan.workerEntries[0])
    cloned.plan.workerEntries[0].output[0].data.code = 'changed trial'
    expect(fixture.plan.workerEntries[0].output[0].data.code).not.toBe('changed trial')
    expect(cloned.context.preModules[0]).not.toBe(fixture.context.preModules[0])
    fixture.plan.workerEntries[0].inverseDependencies.add('consumer')
    fixture.plan.workerEntries[0].inverseDependencies.add('consumer')
    const counts = cloneSerializationInputs(fixture.plan, fixture.context)
    expect(counts.plan.workerEntries[0].inverseDependencies.count('consumer')).toBe(2)
  })

  it('seals complete IDs after serialization, preserves allocator receiver/arguments, and rejects unknown paths without allocating', () => {
    const receiver = { calls: 0, createModuleId(this: { calls: number }, file: string, salt = 'web') { this.calls += 1; return `${file}:${salt}` } }
    const ctx = { options: receiver, serializerConfig: {} }
    const recorded = recordedSerialization(ctx)
    expect(recorded.context.options).not.toBe(receiver)
    expect(recorded.context.options.createModuleId('prelude', 'web')).toBe('prelude:web')
    expect(recorded.context.options.createModuleId('worker', 'web')).toBe('worker:web')
    expect(recorded.context.options.createModuleId('canonical')).toBe('canonical:web')
    recorded.seal()
    const trial = recorded.replayContext(ctx)
    expect(trial.options.createModuleId('worker', 'web')).toBe('worker:web')
    expect(() => trial.options.createModuleId('worker')).toThrow('Changed allocator context')
    expect(() => trial.options.createModuleId('worker', 'native')).toThrow('Changed allocator context')
    expect(trial.options.createModuleId('canonical')).toBe('canonical:web')
    expect(() => trial.options.createModuleId('unknown')).toThrow('Unrecorded module ID')
    expect(() => recorded.context.options.createModuleId('late', 'web')).toThrow('sealed')
    expect(receiver.calls).toBe(3)
    expect(receiver.createModuleId).toBe(ctx.options.createModuleId)
  })
})
