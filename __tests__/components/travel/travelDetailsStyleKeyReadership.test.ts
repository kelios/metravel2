/**
 * Второй гейт наборов стилей детали путешествия: КТО ЧИТАЕТ ключ.
 *
 * Соседний `travelDetailsStyleKeyOwnership` держит инвариант «одно имя — одно
 * определение»: он сравнивает наборы между собой и падает на имени, объявленном
 * дважды. Мёртвый ключ в единственном экземпляре для него неотличим от живого —
 * обзора потребителей у него нет по построению, а секции принимают `styles: any`,
 * поэтому и TypeScript молчит. Так в наборах пережили #1708 и #1711 четыре
 * описания, не применявшиеся ни к одному элементу: `heroOverlay`, `heroTitle`,
 * `heroMeta` и `lazySectionReserved` (#1713).
 *
 * Здесь инвариант другой: у объявленного ключа обязан быть хотя бы один
 * читатель — обращение `.<ключ>` в исходниках.
 *
 * КЛЮЧЕВОЕ: читатель ищется не «где угодно в дереве», а только там, куда набор
 * детали физически доезжает. Первая редакция гейта собирала все имена после
 * точки по 1282 файлам `components/`, `hooks/`, `app/` — и любой ключ, чьё имя
 * совпало с обращением в ЧУЖОМ компоненте с его собственным локальным набором,
 * молча считался живым. Так гейт не поймал бы `heroTitle` — один из четырёх
 * мёртвых ключей, ради которых он и заводился: `.heroTitle` есть в
 * `components/home/HomeInspirationSection.tsx`, `components/listTravel/`
 * `BelarusTravelHub.web.tsx` и `components/screens/roulette/RouletteScreen.tsx`,
 * и каждый читает там свой `styles`. Тем же способом от гейта прятался мёртвый
 * `sectionBadgeText` при мёртвой же родне `sectionBadge*`.
 *
 * Поэтому область чтения = граф детали: весь `components/travel/details/**`
 * (внутри него набор ходит пропом `styles` вниз по секциям, поэтому читатель не
 * обязан импортировать модуль набора) ПЛЮС любой файл `components/`/`hooks/`/`app/`,
 * который импортирует модуль набора напрямую (так в область попадает
 * `hooks/useTravelDetailsLayout.ts`, и так же попадёт будущий внешний
 * потребитель — список не пришпилен).
 *
 * Остаточный риск назван честно: если набор детали передадут пропом в компонент
 * ВНЕ `components/travel/details/**`, не импортирующий модуль набора, его ключи
 * станут «мёртвыми» — гейт упадёт, а не промолчит. Это безопасное направление
 * ошибки, и лечится оно одной строкой в области чтения.
 *
 * Комментарии из исходников вырезаются: упоминание ключа в документации —
 * не читатель. Сами модули наборов из поиска исключены по той же причине.
 */

import fs from 'fs'
import path from 'path'

import { getThemedColors } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const REPO_ROOT = path.resolve(__dirname, '../../..')

/**
 * Каталог детали: внутри него набор ходит пропом `styles` вниз по секциям, и
 * читатель не обязан импортировать модуль набора.
 *
 * Именно `details`, а не весь `components/travel`: набор детали не доезжает до
 * `upsert/`, `sliderParts/`, `gallery/` и прочих соседей — у каждого свой
 * локальный `StyleSheet`, и одиннадцать объявленных имён (`errorText`,
 * `wrapper`, `scrollContent`, `errorContainer`, `errorTitle`, …) там уже
 * встречаются. Сегодня ни один ключ они ложно не оживляют, но семья `error*`
 * наполовину мертва, и осиротевший завтра `errorText` был бы зачтён живым —
 * тот же механизм молчания, только радиусом поменьше.
 */
const DETAIL_FEATURE_DIR = 'components/travel/details'

/** Корни, где ищется внешний файл, импортирующий модуль набора напрямую. */
const IMPORTER_ROOTS = ['components', 'hooks', 'app']

/**
 * Модули, объявляющие наборы. Их собственный текст читателем не считается:
 * иначе объявление и доккоммент назначали бы ключ живым сами себе.
 *
 * Оба каталога читаются С ДИСКА, а не пришпилены: пришпиленный перечень наборов
 * уже отставал от кода в #1711. Корневые модули лежат вперемешку с компонентами,
 * поэтому отбираются по имени — тем же правилом, что и в соседнем гейте владения.
 */
const STYLE_MODULE_DIR = 'components/travel/details/styles'
const DETAIL_ROOT_DIR = 'components/travel/details'
const ROOT_STYLE_MODULE_NAME = /(Styles|StyleFragments)\.ts$/

let styleModuleFilesCache: string[] | null = null

/** Список неизменен в пределах прогона, а спрашивают его на каждый из 1293 файлов. */
const listStyleModuleFiles = (): string[] =>
  (styleModuleFilesCache ??= [
    ...fs
      .readdirSync(path.join(REPO_ROOT, DETAIL_ROOT_DIR))
      .filter((name) => ROOT_STYLE_MODULE_NAME.test(name))
      .map((name) => `${DETAIL_ROOT_DIR}/${name}`),
    ...fs
      .readdirSync(path.join(REPO_ROOT, STYLE_MODULE_DIR))
      .filter((name) => /\.ts$/.test(name))
      .map((name) => `${STYLE_MODULE_DIR}/${name}`),
  ].sort())

/**
 * Все наборы экрана. Фабрики берутся глобом из ОБОИХ каталогов — и `styles/`, и
 * корня `details/`: новый набор попадает под гейт сам, где бы его ни завели.
 * Пришпиливать здесь особенно нечего: два последних набора этого экрана (hero и
 * shell) заведены именно в корне, а не в `styles/`, так что «а вдруг заведут в
 * корне» — это история, а не гипотеза.
 *
 * Отбор по сигнатуре имени: `createTravelDetails<Имя>Styles` или
 * `getTravelDetails<Имя>Styles`. Модуль без фабрики (`travelDetailsSectionRhythm.ts`
 * — это константы ритма) набором не притворяется, а хуки `use*` не вызываются
 * вовсе: вне React они бы упали. Имя набора берётся из имени фабрики, а не из
 * имени файла, — иначе корневые и фрагментные модули пришлось бы разбирать
 * разными правилами.
 */
const STYLE_FACTORY_NAME = /^(?:create|get)TravelDetails([A-Za-z]*)Styles$/

const loadStyleSets = (colors: ThemedColors): Record<string, object> => {
  const sets: Record<string, object> = {}

  for (const relative of listStyleModuleFiles()) {
    const moduleExports = require(path.join(REPO_ROOT, relative)) as Record<string, unknown>

    for (const [exportName, value] of Object.entries(moduleExports)) {
      const match = STYLE_FACTORY_NAME.exec(exportName)
      if (!match || typeof value !== 'function') continue

      // `getTravelDetailsStyles` — агрегат: имени набора у него нет, новых ключей
      // он не приносит (спредит те же фрагменты), а регистрировать его нельзя.
      // Сортировка ставит его первым, и владельцем шести фрагментов стал бы он —
      // текст падения называл бы `aggregate` вместо `misc`/`layout`, то есть
      // отправлял бы читателя не в тот файл.
      const name = match[1]
      if (!name) continue

      sets[name.charAt(0).toLowerCase() + name.slice(1)] = (
        value as (c: ThemedColors) => object
      )(colors)
    }
  }

  return sets
}

/** Владелец каждого объявленного ключа — для внятного текста падения. */
const loadOwnersByKey = (): Map<string, string> => {
  const owners = new Map<string, string>()

  for (const [source, styleSet] of Object.entries(loadStyleSets(getThemedColors(false)))) {
    for (const key of Object.keys(styleSet)) {
      if (!owners.has(key)) owners.set(key, source)
    }
  }

  return owners
}

const isStyleModule = (relative: string): boolean =>
  listStyleModuleFiles().includes(relative)

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/**
 * Импорт модуля набора — пропуск в область чтения для файла вне фичи. Спецификаторы
 * берутся из тех же имён модулей, что и наборы, поэтому новый модуль расширяет
 * область сам.
 */
const importsStyleModule = (source: string): boolean =>
  listStyleModuleFiles().some((relative) => {
    const moduleName = path.basename(relative, '.ts')
    return new RegExp(
      `(?:from|require\\()\\s*['"\`][^'"\`]*\\b${moduleName}['"\`]`,
    ).test(source)
  })

const listCandidateFiles = (): string[] => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })

  return IMPORTER_ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root))).filter(
    (file) => !isStyleModule(path.relative(REPO_ROOT, file)),
  )
}

/**
 * Область чтения: граф детали. Диск обходится и читается РОВНО ОДИН РАЗ на прогон
 * файла — обе проверки ниже берут один и тот же результат, а не ходят по дереву
 * каждая за себя.
 */
let readerSourcesCache: { files: string[]; sources: string[] } | null = null

const loadReaderSources = (): { files: string[]; sources: string[] } => {
  if (readerSourcesCache) return readerSourcesCache

  const files: string[] = []
  const sources: string[] = []

  for (const file of listCandidateFiles()) {
    const relative = path.relative(REPO_ROOT, file)
    const source = stripComments(fs.readFileSync(file, 'utf8'))

    if (!relative.startsWith(`${DETAIL_FEATURE_DIR}/`) && !importsStyleModule(source)) continue

    files.push(relative)
    sources.push(source)
  }

  readerSourcesCache = { files, sources }
  return readerSourcesCache
}

/** Все имена, к которым обращаются через точку внутри области чтения. */
const collectReadNames = (sources: readonly string[]): Set<string> => {
  const names = new Set<string>()

  for (const source of sources) {
    for (const [, name] of stripComments(source).matchAll(/\.([A-Za-z_$][\w$]*)/g)) {
      names.add(name)
    }
  }

  return names
}

const findUnreadKeys = (
  ownersByKey: Map<string, string>,
  readNames: Set<string>,
): Record<string, string> =>
  Object.fromEntries(
    [...ownersByKey].filter(([key]) => !readNames.has(key)),
  )

/**
 * Наследство слито (#1714): тридцать девять ключей, которые не читал никто уже
 * на момент заведения гейта (#1713), удалены из наборов вместе с фрагментом
 * `decisionSummary` целиком. Список нужен только затем, чтобы удаление было
 * удалением, а не потерей читателя: ключ из этого перечня, снова объявленный в
 * любом наборе, роняет гейт по имени. Оговорки «известное наследство» у гейта
 * больше нет — у каждого объявленного ключа обязан быть читатель, без исключений.
 */
const REMOVED_LEGACY_KEYS = [
  'backToTopText',
  'backToTopWrapper',
  'decisionSummaryBadge',
  'decisionSummaryBadgeInfo',
  'decisionSummaryBadgeNegative',
  'decisionSummaryBadgePositive',
  'decisionSummaryBadgeText',
  'decisionSummaryBadgeTextInfo',
  'decisionSummaryBadgeTextNegative',
  'decisionSummaryBadgeTextPositive',
  'decisionSummaryBox',
  'decisionSummaryBulletIcon',
  'decisionSummaryBulletRow',
  'decisionSummaryBulletText',
  'decisionSummaryList',
  'decisionSummarySubBulletIcon',
  'decisionSummarySubBulletRow',
  'decisionSummarySubBulletText',
  'decisionSummaryText',
  'decisionSummaryTitle',
  'errorButton',
  'errorButtonText',
  'loadingSkeletonContent',
  'loadingSkeletonHero',
  'loadingSkeletonSpacer',
  'loadingSkeletonWrap',
  'nearSubtitle',
  'neutralActionButton',
  'neutralActionButtonPressed',
  'neutralActionButtonText',
  'popularSubtitle',
  'sectionBadgeNear',
  'sectionBadgePill',
  'sectionBadgePopular',
  'sectionBadgeRow',
  'sectionBadgeText',
  'sectionBadgeTextNear',
  'sectionBadgeTextPopular',
  'travelListFallback',
]

describe('читаемость ключей стилей travel details', () => {
  it('у каждого ключа набора есть читатель — без исключений', () => {
    const unread = findUnreadKeys(
      loadOwnersByKey(),
      collectReadNames(loadReaderSources().sources),
    )

    expect(unread).toEqual({})
  })

  it('тридцать девять ключей наследства #1714 удалены из наборов, а не просто потеряли читателя', () => {
    const declared = loadOwnersByKey()

    expect(REMOVED_LEGACY_KEYS.filter((key) => declared.has(key))).toEqual([])
  })

  it('падает на заведомо никем не читаемом ключе и называет его владельца', () => {
    const ownersByKey = new Map([
      ['webDeferredSection', 'layout'],
      ['totallyUnreadKey', 'layout'],
    ])

    expect(findUnreadKeys(ownersByKey, new Set(['webDeferredSection']))).toEqual({
      totallyUnreadKey: 'layout',
    })
  })

  it('не считает читателем упоминание ключа в комментарии', () => {
    const readNames = collectReadNames([
      '// styles.totallyUnreadKey — исторический ключ\n/* styles.alsoUnread */\n',
    ])

    expect([readNames.has('totallyUnreadKey'), readNames.has('alsoUnread')]).toEqual([
      false,
      false,
    ])
  })

  it('чужой компонент со своим набором читателем не считается', () => {
    // Тот самый промах первой редакции: `.heroTitle` есть в трёх чужих компонентах,
    // и по «любой точке во всём дереве» ключ #1713 выглядел бы живым. Область
    // чтения обязана этих файлов не содержать.
    const foreign = [
      'components/home/HomeInspirationSection.tsx',
      'components/profile/ProfileTravelEngagementSection.tsx',
      'components/listTravel/BelarusTravelHub.web.tsx',
      'components/screens/roulette/RouletteScreen.tsx',
    ]

    expect(loadReaderSources().files.filter((file) => foreign.includes(file))).toEqual([])
  })

  it('в область чтения входят и фича, и внешний импортёр набора', () => {
    const { files } = loadReaderSources()

    expect([
      // прополз пропом, модуль набора не импортирует
      files.includes('components/travel/details/sections/AffiliateSection.tsx'),
      // вне фичи, но импортирует shell-набор напрямую
      files.includes('hooks/useTravelDetailsLayout.ts'),
    ]).toEqual([true, true])
  })

  it('новый модуль наборов попадает под гейт сам — в ОБОИХ каталогах', () => {
    // Два последних набора экрана (hero и shell) заведены в корне `details/`, а
    // не в `styles/`, поэтому проверка обязана покрывать оба каталога: пока
    // корень был исключён, набор нового корневого модуля не гейтился вовсе.
    const discovered = Object.keys(loadStyleSets(getThemedColors(false)))

    const expected: string[] = []
    // Широкая форма имени фабрики — страховка от самой строгой регулярки:
    // считать `expected` только ею значило бы, что набор, которого она не
    // распознала, отсутствует в обеих частях сравнения и проверка молчит.
    // Фабрика без префикса `TravelDetails` (`createFooterStyles` в модуле, чьё
    // имя префикс уже несёт) — ровно такой случай.
    const dropped: string[] = []

    for (const relative of listStyleModuleFiles()) {
      const moduleExports = require(path.join(REPO_ROOT, relative)) as Record<string, unknown>

      for (const [exportName, value] of Object.entries(moduleExports)) {
        if (typeof value !== 'function' || !/^(?:create|get)[A-Za-z]*Styles$/.test(exportName)) {
          continue
        }

        const match = STYLE_FACTORY_NAME.exec(exportName)
        if (!match) {
          dropped.push(`${relative}: ${exportName}`)
          continue
        }

        if (match[1]) expected.push(match[1].charAt(0).toLowerCase() + match[1].slice(1))
      }
    }

    // Оба каталога должны быть представлены — иначе проверка зелена вхолостую.
    expect([
      expected.filter((name) => !discovered.includes(name)),
      dropped,
      expected.includes('shell') && expected.includes('layout'),
    ]).toEqual([[], [], true])
  })

  it('четыре ключа #1713 удалены из наборов, а не просто потеряли читателя', () => {
    const declared = loadOwnersByKey()

    expect(
      ['heroOverlay', 'heroTitle', 'heroMeta', 'lazySectionReserved'].filter((key) =>
        declared.has(key),
      ),
    ).toEqual([])
  })
})
