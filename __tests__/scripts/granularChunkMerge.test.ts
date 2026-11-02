const path = require('path')
const { mergeGranularChunkPlan, createRouteCoverage } = require('../../scripts/lib/granularChunkMerge')

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

describe('granularChunkMerge', () => {
  it('counts fallback and web route/layout entries as the same delivery routes', () => {
    const entries = ['app/_layout.tsx', 'app/_layout.web.tsx', 'app/index.tsx', 'app/index.web.tsx', 'app/map.tsx'].map(at)
    const { coverage } = createRouteCoverage(entries, APP)
    expect(coverage.get(at('app/index.web.tsx'))).toEqual(coverage.get(at('app/index.tsx')))
    expect(coverage.get(at('app/_layout.web.tsx'))).toEqual(coverage.get(at('app/_layout.tsx')))
    expect(coverage.get(at('app/_layout.tsx'))).toEqual(new Uint32Array([3]))
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
    const merged = mergeGranularChunkPlan(plan, context, { minRouteSimilarity: 1 })
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

  it('merges shared groups riding similar routes and remaps every requirement', () => {
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
    const merged = mergeGranularChunkPlan(plan, context)
    // {index,map} vs {index,map,search}: 2/3 > 0.4 -> one file; {search,about}: 1/4 stays.
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


const factory = (bytes: number) => `__d(function(){/*${'.'.repeat(bytes - 22)}*/});`
function setFactory(plan: ReturnType<typeof makePlan>, file: string, bytes: number) {
  const module = plan.rawAtoms.flatMap((atom) => [...atom.modules]).find((item) => item.path === at(file))!
  module.output = [{ type: 'js/module', data: { code: factory(bytes) } }]
  return module
}
const noRouteMerging = { minRouteSimilarity: 1 }
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
