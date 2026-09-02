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
 */

import { getThemedColors } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'
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
    const sets = loadStyleSets()

    for (const key of SHELL_OWNED_KEYS) {
      const sources = Object.entries(sets)
        .filter(([, styleSet]) => key in styleSet)
        .map(([source]) => source)

      expect([key, sources]).toEqual([key, ['shell']])
    }
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
    const sets = loadStyleSets()
    const owned = [
      'sliderContainer',
      'heroFavoriteBtn',
      'heroFavoriteBtnActive',
      'heroFavoriteBtnMobile',
      'heroFavoriteBtnLabel',
      'heroFavoriteBtnLabelActive',
    ]

    for (const key of owned) {
      const sources = Object.entries(sets)
        .filter(([, styleSet]) => key in styleSet)
        .map(([source]) => source)

      expect([key, sources]).toEqual([key, ['hero']])
    }
  })
})
