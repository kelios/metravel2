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
 * Исключений два. Первое — общий фрагмент, который наборы раскладывают спредом:
 * у него одно определение по построению, поэтому его ключи разрешено видеть в
 * нескольких наборах, но значение обязано совпадать с фрагментом, иначе кто-то
 * переобъявил ключ поверх спреда. Второе — `KNOWN_OPEN_DUPLICATES`: восемнадцать
 * имён shell-набора, продублированных в агрегате ещё до #1708. Они пришпилены
 * поимённо, а не пропущены: новый дубль падает, снятый — тоже.
 */

import { getThemedColors } from '@/constants/designSystem'
import { createTravelDetailsDecisionSummaryStyles } from '@/components/travel/details/TravelDetailsStyleFragments'
import { getTravelDetailsHeroStyles } from '@/components/travel/details/TravelDetailsHeroStyles'
import { getTravelDetailsShellStyles } from '@/components/travel/details/TravelDetailsShellStyles'
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
 * Долг, унаследованный до #1708 и снаружи его scope: `TravelDetailsShellStyles`
 * повторяет тринадцать имён `travelDetailsLayoutStyles` и пять
 * `travelDetailsMiscStyles`. Копии уже разошлись (`sideMenuBase` в shell —
 * `surfaceMuted` и `dashed`, в layout — `surface` и `solid`; у `scrollContent`
 * на web в shell `calc(max(var(--mt-dock-h)…))`, в layout `spacing.lg`), а
 * читает эти имена только shell-набор: контейнер, скролл-рантайм,
 * `useTravelDetailsLayout` и экраны ошибок берут стили из
 * `getTravelDetailsShellStyles`. Снимать копии из агрегата — отдельная карточка
 * (файлы вне scope #1708), поэтому здесь они пришпилены поимённо: гейт не
 * пропускает ни новый дубль, ни молча снятый.
 */
const KNOWN_OPEN_DUPLICATES: Record<string, string[]> = {
  wrapper: ['layout', 'shell'],
  safeArea: ['layout', 'shell'],
  mainContainer: ['layout', 'shell'],
  mainContainerMobile: ['layout', 'shell'],
  sideMenuBase: ['layout', 'shell'],
  scrollView: ['layout', 'shell'],
  scrollContent: ['layout', 'shell'],
  contentOuter: ['layout', 'shell'],
  contentWrapper: ['layout', 'shell'],
  sectionTabsContainer: ['layout', 'shell'],
  sideMenuNative: ['layout', 'shell'],
  sideMenuWebDesktop: ['layout', 'shell'],
  sideMenuWebMobile: ['layout', 'shell'],
  errorContainer: ['misc', 'shell'],
  errorTitle: ['misc', 'shell'],
  errorText: ['misc', 'shell'],
  errorButton: ['misc', 'shell'],
  errorButtonText: ['misc', 'shell'],
}

const loadStyleSets = () => {
  const colors = getThemedColors(false)

  return {
    // Спредятся в агрегат `getTravelDetailsStyles`, порядок — как там.
    decisionSummary: createTravelDetailsDecisionSummaryStyles(colors) as StyleSet,
    layout: createTravelDetailsLayoutStyles(colors) as StyleSet,
    nav: createTravelDetailsNavStyles(colors) as StyleSet,
    sectionHeader: createTravelDetailsSectionHeaderStyles(colors) as StyleSet,
    heroMedia: createTravelDetailsHeroMediaStyles(colors) as StyleSet,
    insight: createTravelDetailsInsightStyles(colors) as StyleSet,
    misc: createTravelDetailsMiscStyles(colors) as StyleSet,
    // Второй и третий наборы экрана, мимо агрегата.
    hero: getTravelDetailsHeroStyles(colors) as unknown as StyleSet,
    shell: getTravelDetailsShellStyles(colors) as unknown as StyleSet,
  }
}

describe('владение ключами стилей travel details', () => {
  it('ни одно имя ключа не объявлено в двух наборах сразу, кроме пришпиленного долга', () => {
    const duplicates = findDuplicateStyleKeys(loadStyleSets())
    const unexpected = Object.fromEntries(
      Object.entries(duplicates).filter(([key]) => !(key in KNOWN_OPEN_DUPLICATES)),
    )

    expect(unexpected).toEqual({})
  })

  it('пришпиленный долг shell-набора не рассасывается молча', () => {
    const duplicates = findDuplicateStyleKeys(loadStyleSets())
    const pinned = Object.fromEntries(
      Object.keys(KNOWN_OPEN_DUPLICATES).map((key) => [key, duplicates[key]]),
    )

    expect(pinned).toEqual(KNOWN_OPEN_DUPLICATES)
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
