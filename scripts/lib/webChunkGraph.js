'use strict'

const { expandPaths } = require('./webChunkMetadataRuntime')
const { registryFromSources, moduleDependencyMaps } = require('./webChunkMetadataArtifact')

// Граф web-выпуска по самим файлам (#2741). Granular-чанкинг Expo не пишет
// манифестов: набор файлов для `import()` лежит массивом в `paths` карты
// зависимостей модуля-импортёра, а сам импортируемый файл про свои
// зависимости ничего не знает. Здесь — разбор `__d(...)` и индекс
// «файл → файлы, без которых его модули не исполнить», общий для
// guard-chunk-closure и SEO-шелла (expoStaticShell).

/** Definitions come from real top-level Metro factory calls, never app string contents. */
function parseChunk(source, registry) {
  const defs = new Map()
  for (const { id, map } of moduleDependencyMaps(source)) {
    const deps = []
    const paths = new Map()
    if (Array.isArray(map)) {
      for (const value of map) if (typeof value === 'number') deps.push(value)
    } else if (map && typeof map === 'object') {
      for (const [key, value] of Object.entries(map)) {
        if (key === 'paths') {
          const expanded = expandPaths(value, registry)
          if (expanded && typeof expanded === 'object') {
            for (const [depId, chunkPath] of Object.entries(expanded)) {
              if (typeof chunkPath === 'string') paths.set(Number(depId), [chunkPath])
              else if (Array.isArray(chunkPath) && chunkPath.every((item) => typeof item === 'string')) {
                paths.set(Number(depId), chunkPath)
              }
            }
          }
        } else if (typeof value === 'number') deps.push(value)
      }
    }
    defs.set(id, { deps: deps.filter((dep) => !paths.has(dep)), paths })
  }
  return defs
}

/**
 * Файлы, которые нужны модулям `src` сверх него самого, по `paths` файлов
 * `srcs` (обычно — скрипты страницы: импортёр маршрута в них есть всегда).
 * Набор import() у Expo — все файлы целевого entry, кроме файла импортёра,
 * поэтому наборы одной цели от разных импортёров объединяются. Берутся наборы
 * целей, определённых в самом `src`; если `src` не определяет ни одной цели
 * (чистый shared-файл), — все наборы, в которые он входит.
 */
function createChunkDependencyIndex(srcs, readChunk) {
  const defsBySrc = new Map()
  const filesByTarget = new Map()
  const sources = new Map([...new Set(srcs)].map((src) => [src, readChunk(src)]))
  const registry = registryFromSources(sources.values())
  for (const [src, source] of sources) {
    const defs = parseChunk(source, registry)
    defsBySrc.set(src, defs)
    for (const def of defs.values()) {
      for (const [target, files] of def.paths) {
        const known = filesByTarget.get(target) ?? new Set()
        for (const file of files) known.add(file)
        filesByTarget.set(target, known)
      }
    }
  }
  return function dependenciesOf(src) {
    const defs = defsBySrc.get(src) ?? parseChunk(readChunk(src), registry)
    const own = [...defs.keys()].filter((id) => filesByTarget.has(id))
    const sets = own.length
      ? own.map((id) => filesByTarget.get(id))
      : [...filesByTarget.values()].filter((files) => files.has(src))
    const out = new Set()
    for (const files of sets) for (const file of files) if (file !== src) out.add(file)
    return [...out]
  }
}

module.exports = { parseChunk, createChunkDependencyIndex }
