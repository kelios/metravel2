import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

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
  const staticImport = new RegExp(
    `^\\s*import\\s+(?!type\\b)[^;]*?from\\s+['"]${escaped}['"]|^\\s*import\\s+['"]${escaped}['"]`,
    'm',
  )
  const cjsRequire = new RegExp(`(?<!typeof\\s)require\\(\\s*['"]${escaped}['"]\\s*\\)`)
  return staticImport.test(content) || cjsRequire.test(content)
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

  // Проверка самого детектора: без неё «зелено» может означать, что регексп ничего
  // не находит в принципе.
  it('детектор отличает синхронный импорт от типового и от динамического', () => {
    expect(hasSyncImport(`import * as L from 'leaflet'`, 'leaflet')).toBe(true)
    expect(hasSyncImport(`import 'leaflet.markercluster'`, 'leaflet.markercluster')).toBe(true)
    expect(hasSyncImport(`const L = require('leaflet')`, 'leaflet')).toBe(true)

    expect(hasSyncImport(`type RL = typeof import('react-leaflet')`, 'react-leaflet')).toBe(false)
    expect(hasSyncImport(`const m = await import('react-leaflet')`, 'react-leaflet')).toBe(false)
    expect(hasSyncImport(`import type { X } from 'react-leaflet'`, 'react-leaflet')).toBe(false)
  })
})
