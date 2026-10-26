'use strict'

// Граф web-выпуска по самим файлам (#2741). Granular-чанкинг Expo не пишет
// манифестов: набор файлов для `import()` лежит массивом в `paths` карты
// зависимостей модуля-импортёра, а сам импортируемый файл про свои
// зависимости ничего не знает. Здесь — разбор `__d(...)` и индекс
// «файл → файлы, без которых его модули не исполнить», общий для
// guard-chunk-closure и SEO-шелла (expoStaticShell).

/** Найти конец JSON-значения, начинающегося на позиции start (`[` или `{`). */
function endOfValue(source, start) {
  const open = source[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let quote = ''
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') {
        i += 1
        continue
      }
      if (ch === quote) inString = false
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }
    if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  return -1
}

const DEFINE = /\},(\d+),(?=[[{])/g

/** { defs: Map<id, {deps:number[], paths:Map<id,string[]>}> } */
function parseChunk(source) {
  const defs = new Map()
  DEFINE.lastIndex = 0
  let match
  while ((match = DEFINE.exec(source))) {
    const id = Number(match[1])
    const valueStart = match.index + match[0].length
    const valueEnd = endOfValue(source, valueStart)
    if (valueEnd < 0) continue
    const raw = source.slice(valueStart, valueEnd)
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const deps = []
    const paths = new Map()
    if (Array.isArray(parsed)) {
      for (const value of parsed) if (typeof value === 'number') deps.push(value)
    } else if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'paths') {
          if (value && typeof value === 'object') {
            for (const [depId, chunkPath] of Object.entries(value)) {
              if (typeof chunkPath === 'string') paths.set(Number(depId), [chunkPath])
              else if (Array.isArray(chunkPath) && chunkPath.every((item) => typeof item === 'string')) {
                paths.set(Number(depId), chunkPath)
              }
            }
          }
          continue
        }
        if (typeof value === 'number') deps.push(value)
      }
    } else {
      continue
    }
    // Асинхронные рёбра несут собственный путь чанка — исполнять их синхронно
    // никто не будет, и на странице их определений быть не обязано.
    defs.set(id, { deps: deps.filter((dep) => !paths.has(dep)), paths })
    DEFINE.lastIndex = valueEnd
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
  for (const src of new Set(srcs)) {
    const defs = parseChunk(readChunk(src))
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
    const defs = defsBySrc.get(src) ?? parseChunk(readChunk(src))
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
