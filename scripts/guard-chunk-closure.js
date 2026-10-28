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
// Проверяется замыкание того, что реально исполняется (#2741):
//   1) корни страницы — модули `__r(id)` её скриптов — и их синхронные
//      зависимости должны быть определены в скриптах страницы;
//   2) каждая async-цель (`paths` исполняемого модуля) — её синхронное
//      замыкание должно быть в наборе «страница ∪ файл импортёра ∪ массив
//      `paths`». Granular-чанкинг Expo пишет у `import()` все файлы целевого
//      entry, кроме файла импортёра, и рантайм не обходит `paths` только что
//      загруженных файлов — массив обязан быть самодостаточным.
// Модуль, который файл везёт, но маршрут никогда не исполняет, не проверяется:
// granular-группа с одинаковыми владельцами содержит и такие, а `__d` только
// регистрирует фабрику.

const fs = require('fs')
const path = require('path')
const { parseChunk } = require('./lib/webChunkGraph')
const { readChunkMetadataRegistry, registryFromSources, moduleRoots, hasCompactChunkMetadata } = require('./lib/webChunkMetadataArtifact')

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

const chunks = new Map() // url path -> { defs, roots }
const fileByModule = new Map()
const sources = new Map(fs.readdirSync(jsDir).filter((file) => file.endsWith('.js'))
  .map((file) => [file, fs.readFileSync(path.join(jsDir, file), 'utf8')]))
const registry = registryFromSources(sources.values())
let registryUrl = null
for (const [file, source] of sources) {
  const url = `/_expo/static/js/web/${file}`
  if (readChunkMetadataRegistry(source)) registryUrl = url
  const defs = parseChunk(source, registry)
  chunks.set(url, {
    defs,
    compact: hasCompactChunkMetadata(source),
    roots: moduleRoots(source),
  })
  for (const id of defs.keys()) fileByModule.set(id, url)
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

  const report = (kind, moduleId, missing, via) => {
    failures.push({ route, kind, moduleId, missing, via })
  }
  for (const url of scripts) {
    if (!chunks.has(url)) report('missing-chunk', -1, url, route)
  }
  if (scripts.some((url) => chunks.get(url)?.compact)
      && (!registryUrl || !scripts.includes(registryUrl))) {
    report('missing-runtime', -1, registryUrl ?? 'web chunk metadata registry', route)
  } else if (registryUrl && scripts.includes(registryUrl)) {
    const runtimeIndex = scripts.indexOf(registryUrl)
    if (scripts.some((url, index) => index < runtimeIndex && chunks.get(url)?.compact)) {
      report('runtime-order', -1, registryUrl, route)
    }
  }

  const asyncQueue = []
  const seenAsync = new Set()
  /** Синхронное замыкание roots в loaded; async-рёбра уходят в очередь. */
  const walk = (roots, loaded, kind, via) => {
    const seen = new Set()
    const stack = roots.slice()
    while (stack.length) {
      const id = stack.pop()
      if (seen.has(id)) continue
      seen.add(id)
      const def = loaded.get(id)
      if (!def) { report(kind, id, id, via); continue }
      for (const dep of def.deps) {
        if (!loaded.has(dep)) report(kind, id, dep, via)
        else stack.push(dep)
      }
      for (const [target, files] of def.paths) {
        const importer = fileByModule.get(id)
        const key = `${target}|${importer}`
        if (seenAsync.has(key)) continue
        seenAsync.add(key)
        asyncQueue.push({ target, files: importer ? [importer, ...files] : files })
      }
    }
  }

  const roots = scripts.flatMap((url) => chunks.get(url)?.roots ?? [])
  if (!roots.length) report('no-roots', -1, -1, scripts.join(','))
  walk(roots, defsOf(scripts), 'eager', scripts.join(','))

  while (asyncQueue.length) {
    const { target, files } = asyncQueue.shift()
    for (const url of files) {
      if (!chunks.has(url)) report('missing-chunk', -1, url, files.join(','))
    }
    const loaded = defsOf([...scripts, ...files])
    if (!loaded.has(target)) {
      report('async', target, target, files.join(','))
      continue
    }
    walk([target], loaded, 'async', files.join(','))
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
    } else if (failure.kind === 'no-roots') {
      console.error(`  [${failure.route}] в скриптах страницы нет ни одного __r(id) — замыкание не проверить (${failure.via})`)
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
