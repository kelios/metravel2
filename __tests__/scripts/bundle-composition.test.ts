import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * #1148: регрессия на состав eager-бандла.
 *
 * `__common` весит 1.13 МБ, из них 82 % не исполняется на travel-details, и пока это
 * так, LCP на мобильном не уложится в бюджет никакими правками картинок. Вес
 * набирается не постепенно, а скачком: достаточно ОДНОГО синхронного импорта
 * тяжёлого вендора из модуля, который лежит в eager-графе, — и Metro хойстит весь
 * вендор в общий чанк, который грузится на каждой странице.
 *
 * Ровно так это уже происходило: #765 (leaflet.markercluster из
 * `MarkerClusterGroup`) и PERF-014/#817 (gesture-handler из entry).
 *
 * Проверка статическая и не требует прод-сборки — она защищает сам рычаг, а не
 * его последствие. Итоговый вес проверяют `guard:bundle-budget:fail` и
 * `guard:eager-web:analyze` уже по собранному бандлу.
 */

const ROOT = resolve(__dirname, '..', '..')

/** Вендоры, попадание которых в eager-граф стоило проекту отдельных тикетов. */
const LAZY_ONLY_VENDORS: Array<{ pkg: string; allowedSyncImporters: string[]; ticket: string }> = [
  {
    pkg: 'leaflet',
    allowedSyncImporters: ['utils/leafletVendor.ts'],
    ticket: '#765',
  },
  {
    pkg: 'leaflet.markercluster',
    allowedSyncImporters: ['utils/leafletVendor.ts'],
    ticket: '#765',
  },
  {
    pkg: 'react-leaflet',
    allowedSyncImporters: ['utils/leafletVendor.ts'],
    ticket: '#765',
  },
  // #1181: RNRH исполняется только на native, но синхронный импорт из общего
  // `StableContent.tsx` и из мёртвого `app/(tabs)/article/[id].tsx` держал в web-`__common`
  // весь его куст: `entities` 246.2 КБ + `ramda` 136.4 КБ + RNRH 66.5 КБ + `htmlparser2`
  // 47.7 КБ ≈ 496 КБ на каждой странице. Импортировать разрешено только из `.native`-файлов,
  // которых web-бандл не видит.
  {
    pkg: 'react-native-render-html',
    allowedSyncImporters: [
      'components/travel/StableContent.native.tsx',
      'components/travel/stableContent/useRenderConfig.native.tsx',
    ],
    ticket: '#1181',
  },
  {
    pkg: '@native-html/iframe-plugin',
    allowedSyncImporters: [],
    ticket: '#1181',
  },
  // #1148: Gorhom исполняется только на native (web-ветка TravelListPanel выходит
  // раньше sheet-списка, MapBottomSheet имеет .web-пару, BottomDock гейтит require
  // через Platform.OS !== 'web'). Прямой импорт из общего TravelListPanel держал в
  // web-__common весь куст bottom-sheet (94 модуля, ~165 КБ transformed); теперь
  // общий код обязан идти через платформ-адаптер TravelListPanel/nativeSheetList.
  {
    pkg: '@gorhom/bottom-sheet',
    allowedSyncImporters: [
      'components/MapPage/MapBottomSheet.tsx',
      'components/MapPage/TravelListPanel/nativeSheetList.ts',
      'components/layout/BottomDock.tsx',
    ],
    ticket: '#1148',
  },
  // #1148: react-dropzone (+file-selector, ~100 КБ transformed) нужен только
  // зонам загрузки на upsert/редакторах, но синхронные импорты из ImageGallery
  // и PhotoUploadWithPreview, расшаренных между несколькими async-чанками
  // (мастер, карта, план поездки), хойстили его в web-__common. Даже два
  // sync-импортёра в РАЗНЫХ async-чанках возвращают вендора в __common,
  // поэтому единственная легальная точка — dropzoneVendor, который lazy-фабрики
  // обоих вью грузят через await import (канон #765/leafletVendor).
  {
    pkg: 'react-dropzone',
    allowedSyncImporters: ['utils/dropzoneVendor.ts'],
    ticket: '#1148',
  },
  // #1286: the trip-create route imported Yup synchronously while auth schemas
  // already used a dynamic vendor root. Metro therefore hoisted Yup into
  // `__common` for every public route. All schemas must resolve it on demand.
  {
    pkg: 'yup',
    allowedSyncImporters: ['utils/yupVendor.ts'],
    ticket: '#1286',
  },
]

/**
 * Модули PDF/книжного экспорта: тянут генераторы, темы и рендереры, а нужны только
 * по явному действию пользователя. Единственная легальная точка входа — динамический
 * `import()` в `hooks/usePdfExportRuntime.ts`.
 */
const LAZY_ONLY_MODULES = [
  {
    module: '@/services/book/BookHtmlExportService',
    allowedSyncImporters: [] as string[],
    ticket: '#1148',
  },
]

/**
 * #1393: маршрутная привязка тяжёлого payload'а.
 *
 * Проверки выше ловят «вендор уехал в общий чанк» по ОДНОМУ синхронному импорту.
 * Здесь другой класс дефекта: импорт формально легален (крошки имеют право знать
 * про квесты), но модуль, до которого он дотягивается, оказывается в стартовом
 * графе маршрутов, которым он не нужен. Так таблица контуров стран (47 КБ raw)
 * ехала тегом <script> на 960 из 967 маршрутов — через шапку, которая
 * рендерится на каждом маршруте, и через статический блок квеста на
 * travel-деталях.
 *
 * Гейт по собранному бандлу (`eager.payloadRoutes` в guard-bundle-budget) видит
 * это же нарушение, но стоит полной production-сборки (~20 мин). Эта проверка
 * считает достижимость по исходникам за секунду и падает ДО сборки.
 */
const ROUTE_SCOPED_PAYLOADS: Array<{
  module: string
  allowedRoutes: string[]
  mustReachFrom: string
  ticket: string
}> = [
  {
    module: 'utils/geoCountryOutlines.ts',
    // Единственный оставшийся законный потребитель: партнёрский блок
    // планировщика резолвит страну точки по координатам. Квестам таблица больше
    // не нужна — `country_code` приходит из API (замер прода 2026-08-10: 139 из
    // 139 квестов), и координатный фолбэк из `questAdapters` убран.
    allowedRoutes: ['app/(tabs)/trips/plan/[id].tsx'],
    // Маршрут-контроль детектора: если резолвер сломается, «ноль маршрутов»
    // выглядит как идеальный результат, поэтому одно срабатывание обязано быть.
    mustReachFrom: 'app/(tabs)/trips/plan/[id].tsx',
    ticket: '#1393',
  },
]

const RESOLVE_EXTS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js']

/** Разрешение импорта под web-бандл: `.web.*` выигрывает у платформенно-общего файла. */
const resolveImport = (specifier: string, fromFile: string): string | null => {
  let base: string
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null // node_modules — вес вендоров держат проверки выше
  for (const ext of RESOLVE_EXTS) if (existsSync(base + ext)) return base + ext
  for (const ext of RESOLVE_EXTS) if (existsSync(join(base, `index${ext}`))) return join(base, `index${ext}`)
  return existsSync(base) && statSync(base).isFile() ? base : null
}

const syncDepsCache = new Map<string, string[]>()

/** Синхронные рёбра графа. `import()` — граница чанка, по ней обход не идёт. */
const syncDeps = (file: string): string[] => {
  const cached = syncDepsCache.get(file)
  if (cached) return cached
  let content = ''
  try {
    content = stripComments(readFileSync(file, 'utf8'))
  } catch {
    /* платформенная пара может отсутствовать — это не ребро */
  }
  const out = new Set<string>()
  const add = (specifier: string) => {
    const resolved = resolveImport(specifier, file)
    if (resolved) out.add(resolved)
  }
  // `import ... from 'x'` и `export ... from 'x'`, кроме `import type` / `export type`.
  for (const m of content.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\s)[\s\S]*?from\s*['"]([^'"]+)['"]/g)) add(m[1])
  for (const m of content.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) add(m[1])
  for (const m of content.matchAll(/(?<!\.)\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1])
  const list = [...out]
  syncDepsCache.set(file, list)
  return list
}

/** Кратчайшая синхронная цепочка `root → target`, или null. */
const syncPathTo = (root: string, target: string): string[] | null => {
  const prev = new Map<string, string | null>([[root, null]])
  const queue = [root]
  while (queue.length) {
    const current = queue.shift() as string
    if (current === target) {
      const chain: string[] = []
      for (let node: string | null = current; node; node = prev.get(node) ?? null) chain.unshift(relative(ROOT, node))
      return chain
    }
    for (const dep of syncDeps(current)) {
      if (!prev.has(dep)) {
        prev.set(dep, current)
        queue.push(dep)
      }
    }
  }
  return null
}

const SOURCE_DIRS = ['app', 'components', 'hooks', 'screens', 'stores', 'utils', 'constants']
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx']

const collectSourceFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full))
    else if (SOURCE_EXTS.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

const sourceFiles = SOURCE_DIRS.flatMap((dir) => collectSourceFiles(join(ROOT, dir)))

/**
 * Комментарии убираем: в них разбор прошлых регрессий цитирует ровно те строки,
 * которые ищет детектор (`MarkerClusterGroup.tsx` объясняет, почему больше НЕ делает
 * `require('leaflet.markercluster')`).
 */
const stripComments = (content: string): string =>
  content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')

/** Синхронный импорт значения: `import x from 'pkg'` / `require('pkg')`. Тип — не в счёт. */
const hasSyncImport = (rawContent: string, specifier: string): boolean => {
  const content = stripComments(rawContent)
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // (?:(?!^\s*import\s)[^;])*? вместо [^;]*?: в файлах без точек с запятой
  // ленивый [^;] пересекал границы стейтментов и склеивал `import React ...`
  // с `from 'pkg'` из СОСЕДНЕГО type-импорта ниже. Многострочный одиночный
  // импорт по-прежнему матчится — внутри него нет строк на `import`.
  const staticImport = new RegExp(
    `^\\s*import\\s+(?!type\\b)(?:(?!^\\s*import\\s)[^;])*?from\\s+['"]${escaped}['"]|^\\s*import\\s+['"]${escaped}['"]`,
    'm',
  )
  // Ре-экспорт — такое же синхронное ребро графа, как import: `utils/dropzoneVendor.ts`
  // и `TravelListPanel/nativeSheetList.ts` написаны именно так, и без этой ветки их
  // allowlist-записи были мертвы — копия паттерна вернула бы вендора в `__common`
  // при зелёном guard. `export type { … } from` не в счёт: типы стираются.
  const staticReExport = new RegExp(
    `^\\s*export\\s+(?!type\\b)(?:(?!^\\s*export\\s)[^;])*?from\\s+['"]${escaped}['"]`,
    'm',
  )
  const cjsRequire = new RegExp(`(?<!typeof\\s)require\\(\\s*['"]${escaped}['"]\\s*\\)`)
  return staticImport.test(content) || staticReExport.test(content) || cjsRequire.test(content)
}

describe('состав eager-бандла (#1148)', () => {
  it.each(LAZY_ONLY_VENDORS)(
    'вендор $pkg синхронно импортируется только из своего async-чанка ($ticket)',
    ({ pkg, allowedSyncImporters }) => {
      const offenders = sourceFiles
        .filter((file) => hasSyncImport(readFileSync(file, 'utf8'), pkg))
        .map((file) => relative(ROOT, file))
        .filter((file) => !allowedSyncImporters.includes(file))

      expect({ pkg, offenders }).toEqual({ pkg, offenders: [] })
    },
  )

  it.each(LAZY_ONLY_MODULES)(
    'модуль $module подключается только динамическим import() ($ticket)',
    ({ module, allowedSyncImporters }) => {
      const offenders = sourceFiles
        .filter((file) => hasSyncImport(readFileSync(file, 'utf8'), module))
        .map((file) => relative(ROOT, file))
        .filter((file) => !allowedSyncImporters.includes(file))

      expect({ module, offenders }).toEqual({ module, offenders: [] })
    },
  )

  it.each(ROUTE_SCOPED_PAYLOADS)(
    'payload $module остаётся в стартовом графе только своих маршрутов ($ticket)',
    ({ module, allowedRoutes, mustReachFrom }) => {
      const target = join(ROOT, module)
      const routeRoots = collectSourceFiles(join(ROOT, 'app'))
      const reached = routeRoots
        .map((root) => ({ root: relative(ROOT, root), chain: syncPathTo(root, target) }))
        .filter((hit) => hit.chain !== null)

      expect(reached.map((hit) => hit.root)).toContain(mustReachFrom)

      const offenders = reached.filter((hit) => !allowedRoutes.includes(hit.root))
      // Цепочка в сообщении — сразу видно, каким ребром payload попал на маршрут.
      expect(offenders.map((hit) => `${hit.root}: ${hit.chain!.join(' -> ')}`)).toEqual([])
    },
  )

  // Проверка самого детектора: без неё «зелено» может означать, что регексп ничего
  // не находит в принципе.
  it('детектор отличает синхронный импорт от типового и от динамического', () => {
    expect(hasSyncImport(`import * as L from 'leaflet'`, 'leaflet')).toBe(true)
    expect(hasSyncImport(`import 'leaflet.markercluster'`, 'leaflet.markercluster')).toBe(true)
    expect(hasSyncImport(`const L = require('leaflet')`, 'leaflet')).toBe(true)

    expect(hasSyncImport(`type RL = typeof import('react-leaflet')`, 'react-leaflet')).toBe(false)
    expect(hasSyncImport(`const m = await import('react-leaflet')`, 'react-leaflet')).toBe(false)
    expect(hasSyncImport(`import type { X } from 'react-leaflet'`, 'react-leaflet')).toBe(false)

    // Файлы без точек с запятой: value-импорт другого модуля строкой выше не
    // должен «доклеиваться» до from соседнего type-импорта искомого пакета.
    expect(
      hasSyncImport(`import React from 'react'\nimport type { X } from 'react-leaflet'`, 'react-leaflet'),
    ).toBe(false)
    expect(hasSyncImport(`import {\n  MapContainer,\n} from 'react-leaflet'`, 'react-leaflet')).toBe(true)

    // Ре-экспорт — тоже синхронное ребро: именно так написаны vendor-точки
    // (utils/dropzoneVendor.ts, TravelListPanel/nativeSheetList.ts).
    expect(hasSyncImport(`export { useDropzone } from 'react-dropzone'`, 'react-dropzone')).toBe(true)
    expect(hasSyncImport(`export * from 'react-dropzone'`, 'react-dropzone')).toBe(true)
    expect(hasSyncImport(`export {\n  BottomSheetFlatList,\n} from '@gorhom/bottom-sheet'`, '@gorhom/bottom-sheet')).toBe(true)
    // Типовой ре-экспорт стирается компилятором — не ребро графа.
    expect(hasSyncImport(`export type { FileRejection } from 'react-dropzone'`, 'react-dropzone')).toBe(false)
  })
})
