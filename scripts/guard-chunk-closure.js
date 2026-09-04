#!/usr/bin/env node
'use strict'

// Гейт целостности web-выпуска: каждый модуль, который может быть исполнен на
// маршруте, обязан иметь на странице ВСЕ свои синхронные зависимости.
//
// Разбиение на shared-чанки раздаёт файлы двумя разными путями: HTML-маршрута
// (<script> по владельцам группы) и рантайм-загрузкой async-цели (`import()`,
// путь которой лежит в `paths` модуля). Второй путь никем не проверялся, и
// когда async-цель попадала ВНУТРЬ shared-чанка, этот чанк приезжал на маршрут
// без своих соседей: `useMapDataController` тянул `useMapTravels` из другого
// shared-чанка, которого на /map не было ни в HTML, ни в манифесте, и страница
// падала в корневой ErrorBoundary с «Requiring unknown module "1947"» (#1749).
//
// Проверяются оба пути:
//   1) стартовый набор маршрута — замыкание по синхронным зависимостям;
//   2) любая async-цель — набор маршрута ∪ сам чанк ∪ его `__METRAVEL_CHUNK_DEPS__`
//      (рантайм читает манифест ровно одного запрошенного чанка и не обходит
//      манифесты того, что только что загрузил, поэтому манифест обязан быть
//      транзитивным).

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const dirArg = args.find((a) => !a.startsWith('--'))
const repoRoot = path.resolve(__dirname, '..')
const distDir = path.resolve(repoRoot, dirArg || 'dist')
const limitArg = args.find((a) => a.startsWith('--max-routes='))
const MAX_ROUTES = limitArg ? Number(limitArg.split('=')[1]) : Infinity

if (!fs.existsSync(distDir)) {
  console.error(`guard-chunk-closure: export directory not found: ${distDir}`)
  process.exit(1)
}

const jsDir = path.join(distDir, '_expo/static/js/web')
if (!fs.existsSync(jsDir)) {
  console.error(`guard-chunk-closure: no web chunks under ${jsDir}`)
  process.exit(1)
}

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

/** { defs: Map<id, {deps:number[], paths:Map<id,string>}> } */
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
              if (typeof chunkPath === 'string') paths.set(Number(depId), chunkPath)
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

const MANIFEST = /^globalThis\.__METRAVEL_CHUNK_DEPS__\?\?=\{};globalThis\.__METRAVEL_CHUNK_DEPS__\[("(?:[^"\\]|\\.)*")\]=(\[[^\]]*\]);/

const chunks = new Map() // url path -> { defs, manifest: string[] }
for (const file of fs.readdirSync(jsDir)) {
  if (!file.endsWith('.js')) continue
  const source = fs.readFileSync(path.join(jsDir, file), 'utf8')
  const manifestMatch = MANIFEST.exec(source)
  let manifest = []
  if (manifestMatch) {
    try {
      const listed = JSON.parse(manifestMatch[2])
      manifest = listed.filter((entry) => typeof entry === 'string')
    } catch {
      manifest = []
    }
  }
  chunks.set(`/_expo/static/js/web/${file}`, { defs: parseChunk(source), manifest })
}

const htmlFiles = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '_expo' || entry.name === 'assets') continue
      walk(full)
    } else if (entry.name.endsWith('.html')) {
      htmlFiles.push(full)
    }
  }
}
walk(distDir)

const SCRIPT_SRC = /<script[^>]+src="([^"]+)"/g

/** Маршруты с одинаковым набором скриптов проверяются один раз. */
const routesByScriptKey = new Map()
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8')
  const scripts = []
  SCRIPT_SRC.lastIndex = 0
  let match
  while ((match = SCRIPT_SRC.exec(html))) {
    if (match[1].includes('/_expo/static/js/web/')) scripts.push(match[1])
  }
  if (!scripts.length) continue
  const key = scripts.slice().sort().join('|')
  if (!routesByScriptKey.has(key)) {
    routesByScriptKey.set(key, { scripts, route: path.relative(distDir, file) })
  }
}

const failures = []
let checkedRoutes = 0

const defsOf = (urls) => {
  const defs = new Map()
  for (const url of urls) {
    const chunk = chunks.get(url)
    if (!chunk) continue
    for (const [id, def] of chunk.defs) defs.set(id, def)
  }
  return defs
}

for (const { scripts, route } of routesByScriptKey.values()) {
  if (checkedRoutes >= MAX_ROUTES) break
  checkedRoutes += 1
  const baseDefs = defsOf(scripts)

  const report = (kind, moduleId, missing, via) => {
    failures.push({ route, kind, moduleId, missing, via })
  }

  for (const [id, def] of baseDefs) {
    for (const dep of def.deps) {
      if (!baseDefs.has(dep)) report('eager', id, dep, scripts.join(','))
    }
  }

  // Async-цели: `paths` любого доставленного модуля.
  const asyncTargets = new Set()
  for (const def of baseDefs.values()) {
    for (const chunkPath of def.paths.values()) asyncTargets.add(chunkPath)
  }
  const seenTargets = new Set()
  while (asyncTargets.size) {
    const targetPath = asyncTargets.values().next().value
    asyncTargets.delete(targetPath)
    if (seenTargets.has(targetPath)) continue
    seenTargets.add(targetPath)
    const target = chunks.get(targetPath)
    if (!target) {
      report('missing-chunk', -1, targetPath, route)
      continue
    }
    const loaded = new Map(baseDefs)
    for (const url of [targetPath, ...target.manifest]) {
      const chunk = chunks.get(url)
      if (!chunk) {
        report('missing-chunk', -1, url, targetPath)
        continue
      }
      for (const [id, def] of chunk.defs) loaded.set(id, def)
    }
    for (const [id, def] of target.defs) {
      for (const dep of def.deps) {
        if (!loaded.has(dep)) report('async', id, dep, targetPath)
      }
    }
    // Цепочка навигаций: цели, открывшиеся из только что загруженного чанка.
    for (const def of target.defs.values()) {
      for (const chunkPath of def.paths.values()) {
        if (!seenTargets.has(chunkPath)) asyncTargets.add(chunkPath)
      }
    }
  }
}

if (failures.length) {
  const shown = args.includes('--all') ? failures : failures.slice(0, 25)
  console.error(
    `❌ guard-chunk-closure: ${failures.length} недоставленных зависимостей на ${checkedRoutes} проверенных наборах маршрутов`,
  )
  for (const failure of shown) {
    if (failure.kind === 'missing-chunk') {
      console.error(`  [${failure.route}] чанк не найден в выпуске: ${failure.missing} (ссылка из ${failure.via})`)
    } else {
      console.error(
        `  [${failure.route}] ${failure.kind}: модуль ${failure.moduleId} требует ${failure.missing}, которого нет в наборе (${failure.kind === 'async' ? `async-цель ${failure.via}` : 'стартовый набор'})`,
      )
    }
  }
  if (failures.length > shown.length) console.error(`  … ещё ${failures.length - shown.length}`)
  process.exit(1)
}

console.log(`✅ guard-chunk-closure: ${checkedRoutes} наборов маршрутов, ${chunks.size} чанков — замыкание полное`)
