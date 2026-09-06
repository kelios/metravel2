/**
 * #1812 — плашка «нет сети» на карте стояла хардкодом `topInset={56}` и внутри
 * себя добавляла ещё 10, то есть всегда сидела на y≈66 от верха карты. Реальная
 * нижняя граница верхнего ряда кнопок — `getMapToolbarBottom(insets.top)` =
 * `max(insets.top, 8) + 51`: при safe-area 47 ряд кончается на 98, при 59 — на
 * 110, и плашка ложилась прямо на кнопки. На mobile web (safe-area 0) дефект не
 * воспроизводился, поэтому арифметика проверяется на наборе реальных вырезов.
 *
 * Второй ярус того же стека — гео-баннер: до правки при «нет сети + геолокация
 * запрещена» плашка целилась в 66, а баннер в 67, то есть друг на друга.
 */
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import { MapScreenMobile } from '@/components/MapPage/MapScreenParts/MapScreenMobile'
import {
  getMapTopStackOffsets,
  getMapToolbarBottom,
  MAP_LOCATION_QUALITY_PILL_STACK_OFFSET,
  MAP_OFFLINE_INDICATOR_HEIGHT,
  MAP_OFFLINE_INDICATOR_STACK_OFFSET,
  MAP_ROUTE_ROW_STACK_OFFSET,
  MAP_TOOLBAR_STACK_GAP,
} from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { MAP_FILTER_CHIPS_STACK_OFFSET } from '@/components/MapPage/mapFilterChips'
import { getStyles } from '@/screens/tabs/map.styles'
import { getThemedColors } from '@/hooks/useTheme'

// Мобильный chrome тянет тяжёлый отложенный слой (bottom sheet, панели, карта
// списка) — для проверки проводки позиции он не нужен и только замедляет набор.
jest.mock('@/screens/tabs/mapDeferred', () => ({
  MapMobileLayout: () => null,
  MapOnboarding: () => null,
}))

/** Реальные safe-area top: web/0, старые Android, iPhone SE/13 mini/16 Pro. */
const TOP_INSETS = [0, 8, 20, 24, 44, 47, 50, 54, 59, 62]

/** Позиция плашки до правки: хардкод 56 + скрытые 10 внутри компонента. */
const LEGACY_TOP = 66

const themedColors = getThemedColors(false)

const stackFor = (
  topInset: number,
  overrides: { chips?: boolean; offline?: boolean; route?: boolean } = {},
) =>
  getMapTopStackOffsets({
    topInset,
    filterChipsVisible: overrides.chips ?? false,
    offlineIndicatorVisible: overrides.offline ?? true,
    routeRowVisible: overrides.route ?? false,
  })

/** Верх гео-баннера с учётом яруса, который приходит сдвигом (`MapCanvas`). */
const geoBannerTopFor = (topInset: number, stackOffset: number) => {
  const flat = StyleSheet.flatten(getStyles(true, topInset, themedColors).geoBanner)
  return (flat?.top as number) + stackOffset
}

describe('#1812 — плашка «нет сети» не наезжает на верхний ряд кнопок карты', () => {
  it.each(TOP_INSETS)('safe-area top = %ipt: плашка ниже ряда кнопок', (topInset) => {
    expect(stackFor(topInset).offlineIndicatorTop).toBeGreaterThanOrEqual(
      getMapToolbarBottom(topInset) + MAP_TOOLBAR_STACK_GAP,
    )
  })

  it('на вырезе прежний хардкод лежал на кнопках, а новая позиция — нет', () => {
    // Регрессия ловится только на ненулевой safe-area: ровно поэтому дефект
    // прожил до отчёта с устройства, а браузерный замер его не показывал.
    const withNotch = [47, 59]

    withNotch.forEach((topInset) => {
      expect(LEGACY_TOP).toBeLessThan(getMapToolbarBottom(topInset))
      expect(stackFor(topInset).offlineIndicatorTop).toBeGreaterThan(getMapToolbarBottom(topInset))
    })
  })

  it('на mobile web позиция практически не изменилась', () => {
    // 67 против прежних 66: единственный источник вертикали даёт на 1pt больше,
    // визуально это тот же ярус — регресс mobile web не требуется.
    expect(stackFor(0).offlineIndicatorTop).toBe(67)
    expect(Math.abs(stackFor(0).offlineIndicatorTop - LEGACY_TOP)).toBeLessThanOrEqual(1)
  })

  it('ряд чипов активных фильтров опускает плашку ровно на свою высоту', () => {
    TOP_INSETS.forEach((topInset) => {
      expect(stackFor(topInset, { chips: true }).offlineIndicatorTop).toBe(
        stackFor(topInset).offlineIndicatorTop + MAP_FILTER_CHIPS_STACK_OFFSET,
      )
    })
  })

  // Ряд маршрута («Старт»/сводка) занимает ярус сразу под тулбаром: его нижняя
  // граница — `getMapToolbarBottom + MAP_ROUTE_ROW_STACK_OFFSET`. Без этого
  // слагаемого плашка уходит из-под кнопок ровно на этот ряд.
  it.each(TOP_INSETS)('safe-area top = %ipt: в режиме маршрута плашка ниже ряда «Старт»', (
    topInset,
  ) => {
    expect(stackFor(topInset, { route: true }).offlineIndicatorTop).toBeGreaterThanOrEqual(
      getMapToolbarBottom(topInset) + MAP_ROUTE_ROW_STACK_OFFSET + MAP_TOOLBAR_STACK_GAP,
    )
  })

  it('без учёта ряда маршрута плашка легла бы прямо на него', () => {
    TOP_INSETS.forEach((topInset) => {
      const withoutRouteRow = stackFor(topInset, { route: false }).offlineIndicatorTop

      expect(withoutRouteRow).toBeLessThan(
        getMapToolbarBottom(topInset) + MAP_ROUTE_ROW_STACK_OFFSET,
      )
    })
  })
})

describe('#1812 — плашка «нет сети» и гео-баннер не накладываются', () => {
  it.each(TOP_INSETS)(
    'safe-area top = %ipt: при «нет сети + нет геолокации» баннер начинается под плашкой',
    (topInset) => {
      const { offlineIndicatorTop, geoBannerStackOffset } = stackFor(topInset, { offline: true })

      expect(geoBannerTopFor(topInset, geoBannerStackOffset)).toBeGreaterThanOrEqual(
        offlineIndicatorTop + MAP_OFFLINE_INDICATOR_HEIGHT + MAP_TOOLBAR_STACK_GAP,
      )
    },
  )

  it('без плашки гео-баннер остаётся на прежнем ярусе', () => {
    TOP_INSETS.forEach((topInset) => {
      expect(stackFor(topInset, { offline: false }).geoBannerStackOffset).toBe(0)
      expect(stackFor(topInset, { offline: false, chips: true }).geoBannerStackOffset).toBe(
        MAP_FILTER_CHIPS_STACK_OFFSET,
      )
    })
  })

  it('ярусы складываются: чипы и плашка вместе сдвигают баннер на сумму', () => {
    expect(stackFor(47, { chips: true, offline: true }).geoBannerStackOffset).toBe(
      MAP_FILTER_CHIPS_STACK_OFFSET + MAP_OFFLINE_INDICATOR_STACK_OFFSET,
    )
  })
})

describe('#1812 — компонент рисует ровно ту позицию, которую ему дали', () => {
  it('не добавляет скрытого слагаемого к переданному top', () => {
    render(<MapOfflineIndicator visible top={123} />)

    const flat = StyleSheet.flatten(screen.getByTestId('map-offline-indicator').props.style)
    expect(flat?.top).toBe(123)
  })

  it('без позиции остаётся на прежнем десктопном отступе', () => {
    render(<MapOfflineIndicator visible />)

    const flat = StyleSheet.flatten(screen.getByTestId('map-offline-indicator').props.style)
    expect(flat?.top).toBe(10)
  })

  // Высота задана ПОЛОМ без вертикальных полей: при обычном масштабе шрифта
  // пилюля ровно такая, из какой считается ярус под ней, а при системном
  // укрупнении текста растёт, вместо того чтобы обрезать сообщение.
  it('высота пилюли совпадает с той, из которой считается ярус под ней', () => {
    render(<MapOfflineIndicator visible top={0} />)

    const pill = screen.getByTestId('map-offline-indicator').props.children
    const flat = StyleSheet.flatten(pill.props.style)
    expect(flat?.minHeight).toBe(MAP_OFFLINE_INDICATOR_HEIGHT)
    expect(flat?.height).toBeUndefined()
    expect(flat?.paddingVertical ?? 0).toBe(0)
  })
})

describe('#1812 — экран отдаёт плашке посчитанную позицию, а не собственный хардкод', () => {
  /** iPhone 13 mini/16 Pro: ровно тот класс устройств, где дефект и увидели. */
  const NOTCH_INSET = 47

  const mobileProps = {
    travelsData: [],
    hasMore: false,
    refetchMapData: jest.fn(),
    loading: false,
    isFetching: false,
    isPlaceholderData: false,
    coordinates: null,
    transportMode: 'car',
    buildRouteTo: jest.fn(),
    travelsCount: 0,
    centerOnUser: jest.fn(),
    handleSelectSearchTab: jest.fn(),
    requestOpenBottomSheet: jest.fn(),
    filtersPanelProps: {},
    handleClearAllFilters: jest.fn(),
    handleExpandRadius: jest.fn(),
    shouldLoadOnboarding: false,
    isWeb: false,
    isMobile: true,
  }

  it('на вырезе плашка стоит ниже ряда кнопок, а не на прежних 66', () => {
    const { offlineIndicatorTop } = stackFor(NOTCH_INSET)

    render(
      <MapScreenMobile
        {...mobileProps}
        isConnected={false}
        offlineIndicatorTop={offlineIndicatorTop}
      />,
    )

    const flat = StyleSheet.flatten(screen.getByTestId('map-offline-indicator').props.style)
    expect(flat?.top).toBe(offlineIndicatorTop)
    expect(flat?.top as number).toBeGreaterThan(getMapToolbarBottom(NOTCH_INSET))
    expect(flat?.top).not.toBe(LEGACY_TOP)
  })

  it('в сети плашки нет вовсе', () => {
    render(
      <MapScreenMobile
        {...mobileProps}
        isConnected
        offlineIndicatorTop={stackFor(NOTCH_INSET).offlineIndicatorTop}
      />,
    )

    expect(screen.queryByTestId('map-offline-indicator')).toBeNull()
  })
})


describe('#1812 — плашка «нет сети» и пилюля качества геолокации не накладываются', () => {
  /**
   * Пилюля живёт при `locationState.status === 'current'` (stale/refreshing), а
   * GPS работает без сети — значит состояние «офлайн + пилюля» реально. Её ярус
   * (41) фиксирован и рядами чипов/маршрута не сдвигается, поэтому без сдвига
   * плашка (zIndex 1015) легла бы на неё сверху.
   */
  const pillTopFor = (topInset: number, stackOffset: number) => {
    const flat = StyleSheet.flatten(getStyles(true, topInset, themedColors).locationQualityPill)
    return (flat?.top as number) + stackOffset
  }

  it.each(TOP_INSETS)(
    'safe-area top = %ipt: в любом сочетании ярусов пилюля начинается под плашкой',
    (topInset) => {
      const combos = [
        { offline: true },
        { offline: true, chips: true },
        { offline: true, route: true },
      ]

      combos.forEach((combo) => {
        const { offlineIndicatorTop, locationQualityStackOffset } = stackFor(topInset, combo)

        expect(pillTopFor(topInset, locationQualityStackOffset)).toBeGreaterThanOrEqual(
          offlineIndicatorTop + MAP_OFFLINE_INDICATOR_HEIGHT + MAP_TOOLBAR_STACK_GAP,
        )
      })
    },
  )

  it('без плашки пилюля остаётся ровно на своём прежнем ярусе', () => {
    TOP_INSETS.forEach((topInset) => {
      expect(stackFor(topInset, { offline: false }).locationQualityStackOffset).toBe(0)
      expect(stackFor(topInset, { offline: false, chips: true }).locationQualityStackOffset).toBe(0)
      expect(pillTopFor(topInset, 0)).toBe(
        getMapToolbarBottom(topInset) + MAP_LOCATION_QUALITY_PILL_STACK_OFFSET,
      )
    })
  })

  it('в базовом офлайне пилюля не двигается: плашка выше её яруса', () => {
    // 8 + 28 + 8 = 44 против яруса пилюли 41 — сдвиг 3pt, а не «ярус целиком».
    expect(stackFor(47).locationQualityStackOffset).toBe(3)
    expect(stackFor(47, { chips: true }).locationQualityStackOffset).toBe(
      3 + MAP_FILTER_CHIPS_STACK_OFFSET,
    )
    expect(stackFor(47, { route: true }).locationQualityStackOffset).toBe(
      3 + MAP_ROUTE_ROW_STACK_OFFSET,
    )
  })
})
