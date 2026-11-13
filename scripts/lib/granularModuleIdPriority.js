'use strict'

const path = require('node:path')
const { isResolvedDependency } = require('@expo/metro/metro/lib/isResolvedDependency')
const { createRouteCoverage } = require('./granularChunkMerge')

/** Pure priority selection; the existing scoped allocator remains the only ID owner. */
function getGranularModuleIdPriorities(plan, context) {
  const { graph, options, preModules = [], serializeChunkOptions } = context
  const transform = graph.transformOptions
  if (serializeChunkOptions?.chunkingStrategy !== 'granular' || transform.platform !== 'web'
      || (transform.customTransformOptions?.environment ?? 'client') !== 'client'
      || transform.customTransformOptions?.dom != null || options.dev || options.includeAsyncPaths
      || !options.serializerOptions?.exporting) return undefined

  const { entryPoints, dependentEntriesByModule, requiredChunksByEntryPath } = plan
  const appDir = path.join(options.serverRoot ?? options.projectRoot, 'app')
  const { coverage, routes } = createRouteCoverage(entryPoints.map(({ module }) => module.path), appDir)
  const homeRoute = path.join(appDir, '(tabs)', 'index.tsx')
  const homeIndex = routes.indexOf(homeRoute)
  if (homeIndex < 0) throw new Error(`Granular module ID priorities require the home route: ${homeRoute}`)

  // Follow real synchronous edges, including foreign factories delivered in a
  // merged home atom. Async/weak/worker targets are identities, never eager closure.
  const preModulesByPath = new Map(preModules.map((module) => [module.path, module]))
  function syncClosure(seeds) {
    const modules = new Map()
    const pending = [...seeds]
    for (let index = 0; index < pending.length; index += 1) {
      const module = pending[index]
      if (modules.has(module.path)) continue
      modules.set(module.path, module)
      for (const dependency of module.dependencies.values()) {
        if (!isResolvedDependency(dependency) || dependency.data.data.asyncType != null) continue
        const target = graph.dependencies.get(dependency.absolutePath) ?? preModulesByPath.get(dependency.absolutePath)
        if (!target) throw new Error(`Granular module ID priority dependency missing: ${module.path} -> ${dependency.absolutePath}`)
        pending.push(target)
      }
    }
    return modules
  }

  let initialOwners = 0n
  entryPoints.forEach((entry, index) => {
    if (entry.kind === 'initial') initialOwners |= 1n << BigInt(index)
  })
  const initial = syncClosure([
    ...preModules,
    ...[...dependentEntriesByModule].filter(([, owners]) => (owners & initialOwners) !== 0n).map(([module]) => module),
  ])
  const homeSeeds = new Set()
  for (const { module } of entryPoints) {
    const bits = coverage.get(module.path)
    if ((bits[homeIndex >>> 5] & (1 << (homeIndex & 31))) === 0) continue
    const atoms = requiredChunksByEntryPath.get(module.path)
    if (!atoms) throw new Error(`Granular module ID home requirements missing: ${module.path}`)
    for (const atom of atoms) for (const delivered of atom.modules) homeSeeds.add(delivered)
  }
  const home = syncClosure(homeSeeds)
  const boundaries = new Set([
    ...entryPoints.filter((entry) => entry.kind !== 'initial').map(({ module }) => module.path),
    ...plan.workerEntries.map((module) => module.path),
  ])
  for (const module of [...initial.values(), ...home.values()]) {
    for (const dependency of module.dependencies.values()) {
      if (isResolvedDependency(dependency) && dependency.data.data.asyncType != null) boundaries.add(dependency.absolutePath)
    }
  }

  const priorities = new Set()
  for (const tier of [initial.keys(), boundaries, home.keys()]) {
    for (const modulePath of [...tier].sort()) priorities.add(modulePath)
  }
  return [...priorities]
}

module.exports = { getGranularModuleIdPriorities }
