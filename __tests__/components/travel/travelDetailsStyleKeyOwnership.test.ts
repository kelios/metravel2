/**
 * Гейт: одно имя стиля детали путешествия имеет одно определение.
 *
 * У экрана ТРИ способа получить стили: общий агрегат `useTravelDetailsStyles`
 * из семи файлов-фрагментов, hero-набор `useTravelDetailsHeroStyles` и
 * shell-набор `useTravelDetailsShellStyles` (контейнер, скролл, состояния
 * ошибки). Ключ можно скопировать в любую сторону, и до этого гейта об этом
 * ничто не сигналило: #1702 → #1703 → #1704 → #1708, четыре карточки одного
 * вида, и каждый раз аудит предыдущей находил «ещё один» дубль вне своего
 * scope.
 *
 * Ловушка не в самом дубле, а в его молчании. Обе копии шести hero-ключей,
 * снятые в #1708, расходились с живой по значению (кнопка «в избранное» была
 * светлее, у обёртки слайдера другой радиус и не было тени) — но не рисовались
 * никогда, потому что их никто не читал. Правка в такой копии не меняет экран,
 * и причину ищут не там.
 *
 * Внутри агрегата дубль ещё тише: спред применяется по порядку, поздний
 * фрагмент безусловно перекрывает ранний, и ранняя копия недостижима, каким бы
 * ни было её значение. Первый же прогон этого гейта нашёл так два семейства
 * сверх #1708 — семь `mobileInsight*` (fragments против `insightStyles`) и
 * девять `error*`/`loadingSkeleton*` (fragments против `miscStyles`), обе копии
 * побайтово совпадали с победившими и обе были сняты вместе с гейтом.
 *
 * Исключение одно — общий фрагмент, который наборы раскладывают спредом: у него
 * одно определение по построению, поэтому его ключи разрешено видеть в
 * нескольких наборах, но значение обязано совпадать с фрагментом, иначе кто-то
 * переобъявил ключ поверх спреда. Пришпиленного долга больше нет: восемнадцать
 * имён shell-набора, продублированных в агрегате ещё до #1708, сняты в #1711,
 * и гейт держит инвариант без исключений.
 *
 * Второй носитель того же инварианта — константы модулей рядом со стилями
 * (#1712). Их не видно в объектах стилей, поэтому проверка ключей про них не
 * знала вовсе: `HEADER_OFFSET_DESKTOP`/`HEADER_OFFSET_MOBILE` были объявлены и
 * в фрагментах, и в shell-наборе, а `JOURNAL_FONT_FAMILY` — в shell-наборе и в
 * `components/travel/CTASection`. Значения совпадали, так что правка одной
 * копии двигала половину экрана и молчала. Ниже это проверяется по исходникам,
 * а не по рантайму: реэкспорт `export { X } from` — законный способ отдать
 * чужую константу, второе `const X =` — нет.
 */

import fs from 'fs'
import path from 'path'

import { getThemedColors } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'
import * as travelDetailsStyleFragments from '@/components/travel/details/TravelDetailsStyleFragments'
import * as travelDetailsShellStyles from '@/components/travel/details/TravelDetailsShellStyles'
import * as travelDetailsStyles from '@/components/travel/details/TravelDetailsStyles'
import { createTravelDetailsDecisionSummaryStyles } from '@/components/travel/details/TravelDetailsStyleFragments'
import { getTravelDetailsHeroStyles } from '@/components/travel/details/TravelDetailsHeroStyles'
import { getTravelDetailsShellStyles } from '@/components/travel/details/TravelDetailsShellStyles'
import { getTravelDetailsStyles } from '@/components/travel/details/TravelDetailsStyles'
import { createTravelDetailsHeroMediaStyles } from '@/components/travel/details/styles/travelDetailsHeroMediaStyles'
import { createTravelDetailsInsightStyles } from '@/components/travel/details/styles/travelDetailsInsightStyles'
import { createTravelDetailsLayoutStyles } from '@/components/travel/details/styles/travelDetailsLayoutStyles'
import { createTravelDetailsMiscStyles } from '@/components/travel/details/styles/travelDetailsMiscStyles'
import { createTravelDetailsNavStyles } from '@/components/travel/details/styles/travelDetailsNavStyles'
import { createTravelDetailsSectionHeaderStyles } from '@/components/travel/details/styles/travelDetailsSectionHeaderStyles'
import { TRAVEL_DETAILS_SECTION_RHYTHM } from '@/components/travel/details/styles/travelDetailsSectionRhythm'

type StyleSet = Record<string, unknown>

/**
 * Ключи, которые набор получил спредом общего фрагмента, а не объявил сам.
 * Гейт вычитает их из «своих» ключей набора — иначе спред читался бы как дубль.
 */
const SHARED_FRAGMENT_KEYS = new Set(Object.keys(TRAVEL_DETAILS_SECTION_RHYTHM))

/** Имена ключей, объявленные более чем в одном наборе. */
const findDuplicateStyleKeys = (
  setsBySource: Record<string, StyleSet>,
): Record<string, string[]> => {
  const sourcesByKey = new Map<string, string[]>()

  for (const [source, styleSet] of Object.entries(setsBySource)) {
    for (const key of Object.keys(styleSet)) {
      if (SHARED_FRAGMENT_KEYS.has(key)) continue
      sourcesByKey.set(key, [...(sourcesByKey.get(key) ?? []), source])
    }
  }

  return Object.fromEntries(
    [...sourcesByKey].filter(([, sources]) => sources.length > 1),
  )
}

/**
 * Владение поимённо: имя обязано встречаться ровно в одном наборе, и именно в
 * ожидаемом. Роняется в обе стороны — и на возвращённой копии в чужом наборе,
 * и на ключе, пропавшем у владельца.
 */
const expectOwnedOnlyBy = (
  setsBySource: Record<string, StyleSet>,
  keys: readonly string[],
  owner: string,
) => {
  for (const key of keys) {
    const sources = Object.entries(setsBySource)
      .filter(([, styleSet]) => key in styleSet)
      .map(([source]) => source)

    expect([key, sources]).toEqual([key, [owner]])
  }
}

/**
 * Восемнадцать имён оболочки страницы: контейнер, safe area, боковое меню,
 * скролл, контентные обёртки и экраны ошибок. Владелец один —
 * `TravelDetailsShellStyles`: его читают `TravelDetailsContainer`,
 * `TravelDetailsScrollRuntime` и `useTravelDetailsLayout`, а дальше он уходит
 * пропом `styles` в `TravelDetailsCriticalShell` и `TravelDetailsErrorStates`.
 *
 * До #1711 те же имена лежали второй копией в `travelDetailsLayoutStyles` и
 * `travelDetailsMiscStyles`, и копии успели разойтись (`sideMenuBase` в shell —
 * `surfaceMuted` и `dashed`, в layout — `surface` и `solid`; у `scrollContent`
 * на web в shell `calc(max(var(--mt-dock-h)…))`, в layout `spacing.lg`). Не
 * рисовалась ни одна: их не читал никто. Здесь владение проверяется поимённо —
 * возврат копии в агрегат роняет тест, даже если значения совпадут.
 */
/** Шесть имён hero-набора, чьи копии в агрегате сняты в #1708. */
const HERO_OWNED_KEYS = [
  'sliderContainer',
  'heroFavoriteBtn',
  'heroFavoriteBtnActive',
  'heroFavoriteBtnMobile',
  'heroFavoriteBtnLabel',
  'heroFavoriteBtnLabelActive',
]

const SHELL_OWNED_KEYS = [
  'wrapper',
  'safeArea',
  'mainContainer',
  'mainContainerMobile',
  'sideMenuBase',
  'sideMenuNative',
  'sideMenuWebDesktop',
  'sideMenuWebMobile',
  'scrollView',
  'scrollContent',
  'contentOuter',
  'contentWrapper',
  'sectionTabsContainer',
  'errorContainer',
  'errorTitle',
  'errorText',
  'errorButton',
  'errorButtonText',
]

/** Фрагменты, которые агрегат `getTravelDetailsStyles` раскладывает спредом. */
const loadAggregateFragments = (colors: ThemedColors) => ({
  // Порядок — как в `TravelDetailsStyles.ts`.
  decisionSummary: createTravelDetailsDecisionSummaryStyles(colors) as StyleSet,
  layout: createTravelDetailsLayoutStyles(colors) as StyleSet,
  nav: createTravelDetailsNavStyles(colors) as StyleSet,
  sectionHeader: createTravelDetailsSectionHeaderStyles(colors) as StyleSet,
  heroMedia: createTravelDetailsHeroMediaStyles(colors) as StyleSet,
  insight: createTravelDetailsInsightStyles(colors) as StyleSet,
  misc: createTravelDetailsMiscStyles(colors) as StyleSet,
})

const loadStyleSets = () => {
  const colors = getThemedColors(false)

  return {
    ...loadAggregateFragments(colors),
    // Второй и третий наборы экрана, мимо агрегата.
    hero: getTravelDetailsHeroStyles(colors) as unknown as StyleSet,
    shell: getTravelDetailsShellStyles(colors) as unknown as StyleSet,
  }
}

describe('владение ключами стилей travel details', () => {
  it('перечень фрагментов не отстаёт от самого агрегата', () => {
    // Иначе восьмой фрагмент, добавленный в `TravelDetailsStyles.ts`, остался бы
    // вне гейта и принёс бы свои дубли молча — ровно тот класс молчания, из-за
    // которого и понадобилась цепочка #1702 → #1708.
    const colors = getThemedColors(false)
    const listed = new Set(
      Object.values(loadAggregateFragments(colors)).flatMap((set) => Object.keys(set)),
    )
    const actual = Object.keys(getTravelDetailsStyles(colors) as unknown as StyleSet)

    expect(actual.filter((key) => !listed.has(key))).toEqual([])
  })

  it('ни одно имя ключа не объявлено в двух наборах сразу', () => {
    expect(findDuplicateStyleKeys(loadStyleSets())).toEqual({})
  })

  it('восемнадцать ключей оболочки #1711 остались только в shell-наборе', () => {
    expectOwnedOnlyBy(loadStyleSets(), SHELL_OWNED_KEYS, 'shell')
  })

  it('падает на искусственно заведённом дубле и называет оба источника', () => {
    const duplicates = findDuplicateStyleKeys({
      hero: { heroFavoriteBtn: { backgroundColor: 'rgba(0,0,0,0.45)' } },
      heroMedia: { heroFavoriteBtn: { backgroundColor: 'rgba(0,0,0,0.2)' } },
      misc: { videoContainer: {} },
    })

    expect(duplicates).toEqual({ heroFavoriteBtn: ['hero', 'heroMedia'] })
  })

  it('не считает дублем ключ, который наборы получили спредом общего фрагмента', () => {
    const [sharedKey] = Object.keys(TRAVEL_DETAILS_SECTION_RHYTHM)

    expect(
      findDuplicateStyleKeys({
        hero: { [sharedKey]: {} },
        layout: { [sharedKey]: {} },
      }),
    ).toEqual({})
  })

  it('наборы отдают значения общего фрагмента без переобъявления', () => {
    const sets = loadStyleSets()

    for (const [key, expected] of Object.entries(TRAVEL_DETAILS_SECTION_RHYTHM)) {
      for (const [source, styleSet] of Object.entries(sets)) {
        if (!(key in styleSet)) continue
        expect([source, styleSet[key]]).toEqual([source, expected])
      }
    }
  })

  it('шесть hero-ключей #1708 остались только в hero-наборе', () => {
    expectOwnedOnlyBy(loadStyleSets(), HERO_OWNED_KEYS, 'hero')
  })
})

const REPO_ROOT = path.resolve(__dirname, '../../..')

/**
 * Модули наборов: агрегат, его фрагменты, hero- и shell-набор.
 *
 * Список берётся с диска, а не пишется руками: восьмой файл стилей, добавленный
 * рядом, попадёт под гейт сам. Пришпиленный перечень уже один раз отстал от
 * кода — на нём и держалось молчание #1711.
 */
const listStyleModuleFiles = (): string[] => {
  const detailsDir = path.join(REPO_ROOT, 'components/travel/details')
  const fragmentsDir = path.join(detailsDir, 'styles')

  return [
    ...fs
      .readdirSync(detailsDir)
      .filter((name) => /(Styles|StyleFragments)\.ts$/.test(name))
      .map((name) => path.join(detailsDir, name)),
    ...fs
      .readdirSync(fragmentsDir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => path.join(fragmentsDir, name)),
  ].sort()
}

/**
 * Объявление константы модуля — строка без отступа: вложенные `const` внутри
 * фабрик стилей не в счёт. `import` и `export { X } from` под него не подходят,
 * поэтому реэкспорт чужой константы гейт дублем не считает.
 */
const TOP_LEVEL_CONST = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=/

const declaredConstants = (source: string): string[] =>
  source
    .split('\n')
    .map((line) => TOP_LEVEL_CONST.exec(line)?.[1])
    .filter((name): name is string => Boolean(name))

/** Имена констант, объявленные более чем в одном модуле. */
const findDuplicateConstants = (
  sourcesByModule: Record<string, string>,
): Record<string, string[]> => {
  const modulesByName = new Map<string, string[]>()

  for (const [module, source] of Object.entries(sourcesByModule)) {
    for (const name of declaredConstants(source)) {
      modulesByName.set(name, [...(modulesByName.get(name) ?? []), module])
    }
  }

  return Object.fromEntries(
    [...modulesByName].filter(([, modules]) => modules.length > 1),
  )
}

const loadStyleModuleSources = (): Record<string, string> =>
  Object.fromEntries(
    listStyleModuleFiles().map((file) => [
      path.relative(REPO_ROOT, file),
      fs.readFileSync(file, 'utf8'),
    ]),
  )

const listFeatureSourceFiles = (): string[] => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })

  return [
    ...walk(path.join(REPO_ROOT, 'components/travel')),
    ...walk(path.join(REPO_ROOT, 'hooks')),
  ]
}

describe('владение константами стилей travel details', () => {
  it('ни одна константа не объявлена в двух модулях наборов сразу', () => {
    expect(findDuplicateConstants(loadStyleModuleSources())).toEqual({})
  })

  it('падает на второй копии константы и называет оба модуля', () => {
    const duplicates = findDuplicateConstants({
      'TravelDetailsStyleFragments.ts': 'export const HEADER_OFFSET_DESKTOP = 72\n',
      'TravelDetailsShellStyles.ts': 'export const HEADER_OFFSET_DESKTOP = 80\n',
      'travelDetailsNavStyles.ts': 'const NAV_GAP = 8\n',
    })

    expect(duplicates).toEqual({
      HEADER_OFFSET_DESKTOP: [
        'TravelDetailsStyleFragments.ts',
        'TravelDetailsShellStyles.ts',
      ],
    })
  })

  it('не считает дублем реэкспорт чужой константы', () => {
    expect(
      findDuplicateConstants({
        'TravelDetailsStyleFragments.ts': 'export const HEADER_OFFSET_DESKTOP = 72\n',
        'TravelDetailsShellStyles.ts':
          "export { HEADER_OFFSET_DESKTOP } from './TravelDetailsStyleFragments'\n",
      }),
    ).toEqual({})
  })

  it('три константы #1712 объявлены во всём travel ровно один раз', () => {
    // Носитель дубля не обязан быть модулем стилей: `JOURNAL_FONT_FAMILY` вторым
    // объявлением лежал в `components/travel/CTASection`, куда проверка наборов
    // не заглядывает.
    const owners: Record<string, string[]> = {
      HEADER_OFFSET_DESKTOP: [],
      HEADER_OFFSET_MOBILE: [],
      JOURNAL_FONT_FAMILY: [],
    }

    for (const file of listFeatureSourceFiles()) {
      for (const name of declaredConstants(fs.readFileSync(file, 'utf8'))) {
        owners[name]?.push(path.relative(REPO_ROOT, file))
      }
    }

    expect(owners).toEqual({
      HEADER_OFFSET_DESKTOP: ['components/travel/details/TravelDetailsStyleFragments.ts'],
      HEADER_OFFSET_MOBILE: ['components/travel/details/TravelDetailsStyleFragments.ts'],
      JOURNAL_FONT_FAMILY: ['components/travel/details/TravelDetailsStyleFragments.ts'],
    })
  })

  it('shell-набор и агрегат отдают значение владельца, а не своё', () => {
    // Страховка на случай объявления, которое разбор исходника не разглядит:
    // у экрана два пути к «одному» числу, и разойтись они не имеют права.
    for (const name of ['HEADER_OFFSET_DESKTOP', 'HEADER_OFFSET_MOBILE'] as const) {
      const owned = travelDetailsStyleFragments[name]

      expect([name, travelDetailsShellStyles[name], travelDetailsStyles[name]]).toEqual([
        name,
        owned,
        owned,
      ])
    }
  })
})
