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
 * читатель. Читатели ищутся по исходникам `components/`, `hooks/`, `app/` —
 * обращением `.<ключ>`. Такой поиск законен ровно потому, что других способов
 * достать стиль в этом дереве нет, и это проверено на 02.09.2026: ни
 * деструктуризации набора, ни спреда его в чужой объект, ни вычисляемого
 * `styles[имя]` во всём `components/`, `hooks/`, `app/` не встречается.
 * Появится такой способ — гейт начнёт врать в сторону «мёртв», то есть упадёт,
 * а не промолчит.
 *
 * Комментарии из исходников вырезаются: упоминание ключа в документации —
 * не читатель. Сами модули наборов из поиска исключены по той же причине.
 */

import fs from 'fs'
import path from 'path'

import { getThemedColors } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'
import { createTravelDetailsDecisionSummaryStyles } from '@/components/travel/details/TravelDetailsStyleFragments'
import { getTravelDetailsHeroStyles } from '@/components/travel/details/TravelDetailsHeroStyles'
import { getTravelDetailsShellStyles } from '@/components/travel/details/TravelDetailsShellStyles'
import { createTravelDetailsLayoutStyles } from '@/components/travel/details/styles/travelDetailsLayoutStyles'
import { createTravelDetailsNavStyles } from '@/components/travel/details/styles/travelDetailsNavStyles'
import { createTravelDetailsSectionHeaderStyles } from '@/components/travel/details/styles/travelDetailsSectionHeaderStyles'
import { createTravelDetailsHeroMediaStyles } from '@/components/travel/details/styles/travelDetailsHeroMediaStyles'
import { createTravelDetailsInsightStyles } from '@/components/travel/details/styles/travelDetailsInsightStyles'
import { createTravelDetailsMiscStyles } from '@/components/travel/details/styles/travelDetailsMiscStyles'

const REPO_ROOT = path.resolve(__dirname, '../../..')

/** Дерево, в котором вообще возможен читатель стиля детали путешествия. */
const READER_ROOTS = ['components', 'hooks', 'app']

/**
 * Модули, объявляющие наборы. Их собственный текст читателем не считается:
 * иначе объявление и доккоммент назначали бы ключ живым сами себе.
 */
const STYLE_MODULE_DIRS = [
  'components/travel/details/styles',
]
const STYLE_MODULE_FILES = [
  'components/travel/details/TravelDetailsStyleFragments.ts',
  'components/travel/details/TravelDetailsStyles.ts',
  'components/travel/details/TravelDetailsHeroStyles.ts',
  'components/travel/details/TravelDetailsShellStyles.ts',
]

/** Все наборы экрана: семь фрагментов агрегата плюс hero- и shell-набор. */
const loadStyleSets = (colors: ThemedColors): Record<string, object> => ({
  decisionSummary: createTravelDetailsDecisionSummaryStyles(colors),
  layout: createTravelDetailsLayoutStyles(colors),
  nav: createTravelDetailsNavStyles(colors),
  sectionHeader: createTravelDetailsSectionHeaderStyles(colors),
  heroMedia: createTravelDetailsHeroMediaStyles(colors),
  insight: createTravelDetailsInsightStyles(colors),
  misc: createTravelDetailsMiscStyles(colors),
  hero: getTravelDetailsHeroStyles(colors) as unknown as object,
  shell: getTravelDetailsShellStyles(colors) as unknown as object,
})

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
  STYLE_MODULE_FILES.includes(relative) ||
  STYLE_MODULE_DIRS.some((dir) => relative.startsWith(`${dir}/`))

const listReaderFiles = (): string[] => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })

  return READER_ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root))).filter(
    (file) => !isStyleModule(path.relative(REPO_ROOT, file)),
  )
}

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** Все имена, к которым в дереве хоть где-то обращаются через точку. */
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
 * Мёртвая поверхность, доставшаяся в наследство: тридцать восемь ключей,
 * которые не читал никто уже на момент заведения гейта (#1713). Снести их
 * одним заходом — отдельная работа с отдельной визуальной приёмкой, поэтому
 * здесь они перечислены явно, а не прощены молча.
 *
 * Список самоосушающийся: он проверяется в обе стороны. Ключ, который удалили
 * или у которого появился читатель, обязан из списка исчезнуть — иначе гейт
 * падает. Отстать от кода незаметно, как отстал пришпиленный перечень в #1711,
 * он поэтому не может.
 */
const KNOWN_UNREAD_KEYS = [
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
  'sectionBadgeTextNear',
  'sectionBadgeTextPopular',
  'travelListFallback',
]

describe('читаемость ключей стилей travel details', () => {
  it('у каждого ключа набора есть читатель — кроме известного наследства', () => {
    const unread = findUnreadKeys(loadOwnersByKey(), collectReadNames(
      listReaderFiles().map((file) => fs.readFileSync(file, 'utf8')),
    ))

    const unexpected = Object.fromEntries(
      Object.entries(unread).filter(([key]) => !KNOWN_UNREAD_KEYS.includes(key)),
    )

    expect(unexpected).toEqual({})
  })

  it('список наследства не отстаёт: в нём только реально мёртвые ключи', () => {
    const ownersByKey = loadOwnersByKey()
    const unread = findUnreadKeys(ownersByKey, collectReadNames(
      listReaderFiles().map((file) => fs.readFileSync(file, 'utf8')),
    ))

    // Ключ, который удалили или которому нашли читателя, обязан уйти из списка.
    const stale = KNOWN_UNREAD_KEYS.filter((key) => !(key in unread)).map((key) => [
      key,
      ownersByKey.has(key) ? 'у ключа появился читатель' : 'ключ удалён из наборов',
    ])

    expect(stale).toEqual([])
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

  it('четыре ключа #1713 удалены из наборов, а не просто потеряли читателя', () => {
    const declared = loadOwnersByKey()

    expect(
      ['heroOverlay', 'heroTitle', 'heroMeta', 'lazySectionReserved'].filter((key) =>
        declared.has(key),
      ),
    ).toEqual([])
  })
})
