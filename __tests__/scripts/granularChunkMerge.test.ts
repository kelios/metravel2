const path = require('path')
const { mergeGranularChunkPlan, createRouteCoverage } = require('../../scripts/lib/granularChunkMerge')

const ROOT = '/repo'
const APP = path.join(ROOT, 'app')
const at = (rel: string) => path.join(ROOT, rel)
const mod = (rel: string) => ({ path: at(rel) })

type Atom = { ownerEntries: bigint; modules: Set<{ path: string }> }

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
