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
  // #1543: резолвер стран тянет за собой таблицу контуров (67 КБ). Синхронного
  // импортёра у него быть не должно вообще — единственная точка входа —
  // динамический `import()` в `hooks/useCountryCodeByCoords.ts` (см.
  // DYNAMIC_IMPORT_CHOKEPOINTS ниже).
  {
    module: '@/utils/geoCountry',
    allowedSyncImporters: [] as string[],
    ticket: '#1543',
  },
]

/**
 * #1543: модули, у которых async-граница обязана быть ОДНА.
 *
 * Metro группирует чанк по МНОЖЕСТВУ корней, из которых модуль достижим, — и
 * async-корни считаются так же, как маршрутные. Два компонента, каждый со своим
 * `import('@/utils/geoCountry')`, дают два корня, и добавление третьего
 * потребителя переразбивает граф (механизм #1393/#1543). Один чокпоинт — один
 * корень, сколько бы компонентов его ни звало.
 *
 * Список обязан быть живым в обе стороны: чужих импортёров нет И заявленный
 * чокпоинт действительно держит динамический импорт. Иначе «зелено» означало бы
 * лишь то, что граница тихо исчезла вместе с записью.
 */
const DYNAMIC_IMPORT_CHOKEPOINTS: Array<{ specifier: string; owner: string; ticket: string }> = [
  {
    specifier: '@/utils/geoCountry',
    owner: 'hooks/useCountryCodeByCoords.ts',
    ticket: '#1543',
  },
]

/**
 * #1543: секции, которые маршрут не рендерит на первом кадре.
 *
 * Класс дефекта отличается и от «вендор уехал в общий чанк», и от «payload на
 * чужих маршрутах»: импорт легален, модуль нужен именно этому маршруту — но не
 * при первой отрисовке. Экран планировщика открывается на вкладке `route`, а
 * деревья вкладок «люди»/«экспорт»/«ещё» и панели редактирования владельца
 * (`isOwner && isEditing`) всё равно ехали eager-чанками: замер 2026-08-25 дал
 * 791,3 КБ brotli на `(tabs)/trips/plan/[id].html` при потолке 775 — маршрут
 * был худшим в сборке с отрывом 36 КБ от следующего.
 *
 * Проверка идёт по web-резолву (`RESOLVE_EXTS` начинается с `.web.tsx`), то
 * есть ровно так, как граф видит Metro при сборке web: платформенный сплит
 * `tripPlanDeferredSections.web.tsx` обязан быть единственной дорогой к этим
 * компонентам, а синхронный двойник для native виден только native-резолву.
 *
 * Контроль обхода обязателен: пустой список нарушителей одинаково означает и
 * чистый граф, и сломанный резолвер. Поэтому рядом закреплён компонент, который
 * маршрут ОБЯЗАН держать синхронно.
 */
const ROUTE_DEFERRED_SECTIONS: Array<{
  route: string
  sections: string[]
  control: string
  ticket: string
}> = [
  {
    route: 'app/(tabs)/trips/plan/[id].tsx',
    // `components/calendar/MiniCalendar.tsx` в списке НЕТ намеренно: он остаётся
    // синхронно достижим другой дорогой — RouteBuilder -> TripRouteImportPanel ->
    // TravelMap.web -> createMapPopupComponent -> PlacePopupCard ->
    // RelatedTravelActionStack -> TravelStatusButton. Обёртка `React.lazy` поверх
    // такого ребра не экономит ни байта и только маскирует проблему в ревью —
    // ровно класс #1499, — поэтому календарь подключён синхронно, а его вес
    // снимается вместе с цепочкой попапа карты, отдельной задачей.
    sections: [
      'components/travel/PhotoUploadWithPreview.tsx',
      'components/trips/chat/TripChatPanel.tsx',
      'components/trips/communication/TripTelegramGroupCard.tsx',
      'components/trips/planning/TripInvitePanel.tsx',
      'components/trips/planning/TripParticipantsList.tsx',
      'components/trips/planning/TripRatingPanel.tsx',
      'components/trips/planning/TripReportForm.tsx',
      'components/trips/planning/TripRouteExportMenu.tsx',
      'components/trips/planning/TripRsvpControl.tsx',
      'components/trips/planning/TripSuggestPointForm.tsx',
      'components/trips/planning/TripSuggestionsPanel.tsx',
    ],
    // Вкладка `route` — стартовая, её конструктор маршрута обязан остаться
    // синхронным: он и есть первый кадр экрана.
    control: 'components/trips/planning/RouteBuilder.tsx',
    ticket: '#1543',
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
  payload: string
  module: string
  allowedRoutes: string[]
  control: { module: string; route: string }
  ticket: string
}> = [
  {
    // Ключ в `config/bundle-budget.json` → `eager.payloadRoutes`: тот же payload
    // считает гейт по собранному бандлу, и расхождение пинов ловит отдельный
    // тест ниже.
    payload: 'geoCountryOutlines',
    module: 'utils/geoCountryOutlines.ts',
    // #1543: синхронных потребителей не осталось ни одного. Оба партнёрских
    // блока (travel-детали и планировщик поездки) резолвят страну через
    // `hooks/useCountryCodeByCoords`, то есть за `import()`, поэтому таблица не
    // имеет права попасть в стартовый граф НИ ОДНОГО маршрута. Квестам она не
    // нужна с #1393 — `country_code` приходит из API (замер прода 2026-08-10:
    // 139 из 139 квестов), координатный фолбэк из `questAdapters` убран.
    allowedRoutes: [],
    // Контроль детектора. Раньше им было `mustReachFrom` на самой таблице, но
    // теперь «ноль маршрутов» — это и есть ожидаемый результат, и от сломанного
    // резолвера он неотличим. Поэтому контроль переехал на ВЛАДЕЛЬЦА payload'а:
    // компонент, ради которого таблица грузится, обязан остаться синхронно
    // достижимым со своего маршрута. Не достижим — сломан обход, а не бандл.
    control: {
      module: 'components/trips/planning/TripAffiliateBlock.tsx',
      route: 'app/(tabs)/trips/plan/[id].tsx',
    },
    ticket: '#1543',
  },
]

/**
 * #1499: «lazy, побеждённый статическим импортом».
 *
 * Класс дефекта: в ОДНОМ файле, который попадает в web-бандл, модуль подключён и
 * динамически (`React.lazy(() => import('./X'))`), и синхронно — обычно как
 * native-ветка `Platform.OS === 'web' ? Lazy : Static` или как тест-фолбэк
 * `isTestEnv ? require('./X') : lazy(...)`. Metro не знает ни платформы, ни
 * `JEST_WORKER_ID` на этапе сборки, поэтому синхронное ребро остаётся в графе, и
 * модуль со всем поддеревом грузится eager — обёртка `React.lazy` не экономит ни
 * байта, а только маскирует проблему в код-ревью.
 *
 * Измерено на travel-детали 2026-08-22: четыре таких места
 * (`TravelDetailsHero` ×3, `TravelDetailsScrollRuntime`,
 * `TravelDetailsContentSection`) держали в стартовом графе маршрута 29 модулей /
 * 240 КБ исходников — слайдер героя целиком, `TravelStatusButton` с
 * `MiniCalendar`, `OfflineSaveControl`, `FullscreenGallery`, sticky-панель.
 *
 * Лечение — платформенная пара файлов (`X.tsx` / `X.web.tsx`), как в
 * `sections/DeferredQuestForCitySection.web.tsx` после #1393: динамический импорт
 * видит только web, статический — только native.
 *
 * `.native.*` / `.android.* `/ `.ios.*` не проверяются: web-бандл их не видит,
 * там синхронный импорт и есть штатная native-ветка.
 */
const LAZY_DEFEATED_BY_SYNC_ALLOWLIST: Array<{ file: string; specifier: string; reason: string }> = [
  {
    file: 'app/_layout.tsx',
    specifier: '@/utils/runtimeConfigDiagnostics',
    reason: 'модуль 1.2 КБ, синхронно берётся только предикат-гейт; поддерева за ним нет',
  },
  {
    file: 'components/travel/details/TravelDetailsIcons.tsx',
    specifier: '@expo/vector-icons/Feather',
    reason: 'Feather уже eager из ROOT_ICON_FONTS корневого layout — разрыв ребра здесь ничего не уносит',
  },
  {
    file: 'app/(tabs)/quests/[city]/[questId].tsx',
    specifier: '@expo/vector-icons/Feather',
    reason: 'то же: набор иконок уже в стартовом графе через корневой layout',
  },
  {
    file: 'app/(tabs)/quests/[city]/[questId].tsx',
    specifier: '@/components/quests/QuestWizard',
    reason: 'открытый долг: sync-ветка держит визард в стартовом графе маршрута квеста',
  },
  {
    file: 'components/travel/NearTravelList.tsx',
    specifier: '@/components/MapPage/TravelMap',
    reason: 'открытый долг: карта попадает в чанк сайдбара; на стартовый граф travel-детали не влияет',
  },
  {
    file: 'components/travel/details/sections/TravelDetailsSidebarSection.tsx',
    specifier: '@/components/travel/NearTravelList',
    reason: 'открытый долг: сам сайдбар уже за async-границей, вес остаётся внутри его чанка',
  },
  {
    file: 'components/travel/details/sections/TravelDetailsSidebarSection.tsx',
    specifier: '@/components/travel/PopularTravelList',
    reason: 'открытый долг: то же, вес внутри чанка сайдбара',
  },
  {
    file: 'components/layout/Footer.tsx',
    specifier: '@/components/layout/BottomDock',
    reason: 'открытый долг: тест-фолбэк require; Footer сам за async-границей',
  },
  {
    file: 'components/layout/customHeaderLazy.ts',
    specifier: './CustomHeaderNavSection',
    reason: 'открытый долг: тест-фолбэк require держит секции шапки eager на ВСЕХ маршрутах (−83.7 КБ)',
  },
  {
    file: 'components/layout/customHeaderLazy.ts',
    specifier: './CustomHeaderAccountSection',
    reason: 'открытый долг: тот же тест-фолбэк require в шапке',
  },
  {
    file: 'components/layout/customHeaderAccountLazy.ts',
    specifier: './CustomHeaderDesktopAccountSection',
    reason: 'открытый долг: тот же тест-фолбэк require в шапке',
  },
  {
    file: 'components/layout/customHeaderAccountLazy.ts',
    specifier: './CustomHeaderMobileAccountSection',
    reason: 'открытый долг: тот же тест-фолбэк require в шапке',
  },
  {
    file: 'components/layout/customHeaderMobileLazy.ts',
    specifier: './CustomHeaderMobileMenu',
    reason: 'открытый долг: тот же тест-фолбэк require в шапке',
  },
  {
    file: 'components/travel/details/travelDetailsDeferredLoader.ts',
    specifier: '@/components/travel/details/TravelDetailsDeferred',
    reason: 'открытый долг: тест-фолбэк require; сам загрузчик уже за async-границей маршрута',
  },
  {
    file: 'utils/validation/index.ts',
    specifier: '../validation',
    reason: 'баррель намеренно ре-экспортирует тот же модуль синхронно; await import — сахар в хелпере',
  },
]

/** Файлы, которых web-бандл не видит: там синхронный импорт — штатная native-ветка. */
const NATIVE_ONLY_FILE = /\.(native|android|ios)\.(t|j)sx?$/

/** Динамические `import('x')` вне типовой позиции (`typeof import('x')` — не ребро). */
const dynamicImportSpecifiers = (rawContent: string): string[] => {
  const content = stripComments(rawContent)
  const out = new Set<string>()
  // `,?` — многострочный вызов с висячей запятой (prettier так и форматирует).
  for (const m of content.matchAll(/(?<!typeof\s)\bimport\(\s*['"]([^'"]+)['"]\s*,?\s*\)/g)) out.add(m[1])
  return [...out]
}

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
    ({ module, allowedRoutes, control }) => {
      const target = join(ROOT, module)
      const routeRoots = collectSourceFiles(join(ROOT, 'app'))
      const reached = routeRoots
        .map((root) => ({ root: relative(ROOT, root), chain: syncPathTo(root, target) }))
        .filter((hit) => hit.chain !== null)

      // Контроль обхода до самой проверки: владелец payload'а обязан быть
      // синхронно достижим со своего маршрута, иначе пустой результат ниже
      // означает сломанный резолвер, а не чистый граф.
      expect({
        control: `${control.route} -> ${control.module}`,
        reachable: syncPathTo(join(ROOT, control.route), join(ROOT, control.module)) !== null,
      }).toEqual({ control: `${control.route} -> ${control.module}`, reachable: true })

      const offenders = reached.filter((hit) => !allowedRoutes.includes(hit.root))
      // Цепочка в сообщении — сразу видно, каким ребром payload попал на маршрут.
      expect(offenders.map((hit) => `${hit.root}: ${hit.chain!.join(' -> ')}`)).toEqual([])
    },
  )

  it.each(ROUTE_DEFERRED_SECTIONS)(
    'маршрут $route не тянет отложенные секции синхронно ($ticket)',
    ({ route, sections, control }) => {
      const routeRoot = join(ROOT, route)

      // Контроль детектора до самой проверки.
      expect({
        control: `${route} -> ${control}`,
        reachable: syncPathTo(routeRoot, join(ROOT, control)) !== null,
      }).toEqual({ control: `${route} -> ${control}`, reachable: true })

      const offenders = sections
        .map((section) => ({ section, chain: syncPathTo(routeRoot, join(ROOT, section)) }))
        .filter((hit) => hit.chain !== null)
        // Цепочка в сообщении — сразу видно, каким ребром секция вернулась в
        // стартовый граф.
        .map((hit) => `${hit.section}: ${hit.chain!.join(' -> ')}`)

      expect(offenders).toEqual([])
    },
  )

  it.each(DYNAMIC_IMPORT_CHOKEPOINTS)(
    'модуль $specifier грузится ровно из одной async-точки $owner ($ticket)',
    ({ specifier, owner }) => {
      const importers = sourceFiles
        .filter((file) => dynamicImportSpecifiers(readFileSync(file, 'utf8')).includes(specifier))
        .map((file) => relative(ROOT, file))

      // Ровно один импортёр, и это заявленный чокпоинт: и лишние async-корни, и
      // тихо исчезнувшая граница — одинаково нарушение.
      expect({ specifier, importers }).toEqual({ specifier, importers: [owner] })
    },
  )

  // #1543: гейт по собранному бандлу (`eager.payloadRoutes`) стоит полной
  // production-сборки (~20 мин) и потому живёт только в `release:check` — дрейф
  // копился неделями. Верхняя граница по маршрутам должна иметь исходный
  // двойник, который считается за секунду; этот тест не даёт пинам разъехаться.
  it('пины payload-маршрутов согласованы с config/bundle-budget.json (#1543)', () => {
    const budget = JSON.parse(readFileSync(join(ROOT, 'config', 'bundle-budget.json'), 'utf8'))
    const pinned = budget?.eager?.payloadRoutes ?? {}

    // Каждый payload, закреплённый в бюджете, обязан иметь исходную проверку.
    expect(Object.keys(pinned).sort()).toEqual(ROUTE_SCOPED_PAYLOADS.map((entry) => entry.payload).sort())

    const drifted = ROUTE_SCOPED_PAYLOADS.filter(
      (entry) => entry.allowedRoutes.length > (pinned[entry.payload]?.maxRoutes ?? -1),
    ).map((entry) => `${entry.payload}: ${entry.allowedRoutes.length} > maxRoutes ${pinned[entry.payload]?.maxRoutes}`)

    expect(drifted).toEqual([])
  })

  it('React.lazy не соседствует с синхронным импортом того же модуля (#1499)', () => {
    const allowed = new Set(
      LAZY_DEFEATED_BY_SYNC_ALLOWLIST.map((entry) => `${entry.file} :: ${entry.specifier}`),
    )

    const offenders: string[] = []
    for (const file of sourceFiles) {
      if (NATIVE_ONLY_FILE.test(file)) continue
      const raw = readFileSync(file, 'utf8')
      for (const specifier of dynamicImportSpecifiers(raw)) {
        if (!hasSyncImport(raw, specifier)) continue
        const key = `${relative(ROOT, file)} :: ${specifier}`
        if (!allowed.has(key)) offenders.push(key)
      }
    }

    expect(offenders).toEqual([])
  })

  // Контроль детектора: allowlist обязан состоять из ЖИВЫХ записей. Иначе «зелено»
  // означает лишь то, что список разъехался с кодом, и новая копия паттерна
  // проедет мимо гейта (ровно так уже умирал allowlist ре-экспортов, см. ниже).
  it('allowlist парных импортов не содержит мёртвых записей (#1499)', () => {
    const stale = LAZY_DEFEATED_BY_SYNC_ALLOWLIST.filter(({ file, specifier }) => {
      const full = join(ROOT, file)
      if (!existsSync(full)) return true
      const raw = readFileSync(full, 'utf8')
      return !(dynamicImportSpecifiers(raw).includes(specifier) && hasSyncImport(raw, specifier))
    }).map(({ file, specifier }) => `${file} :: ${specifier}`)

    expect(stale).toEqual([])
  })

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

    // #1499: сбор динамических импортов. `typeof import('x')` — типовая позиция,
    // она стирается и ребром чанка не является.
    expect(dynamicImportSpecifiers(`const m = React.lazy(() => import('./X'))`)).toEqual(['./X'])
    expect(dynamicImportSpecifiers(`await import(\n  './X',\n)`)).toEqual(['./X'])
    expect(dynamicImportSpecifiers(`type M = typeof import('./X')`)).toEqual([])
    expect(dynamicImportSpecifiers(`// import('./X')\nconst a = 1`)).toEqual([])
  })
})
