import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Раскладка «Мои поездки» (`MyCreatedTripsList`) по брейкпоинту desktop (#2253,
 * механизм #2112). Статический HTML `/trips/my` (#864) рендерится при `width = 0`:
 * React рисовал мобильную сетку (одна колонка, без боковой панели), а после
 * гидратации на 1280 перекладывал её в две колонки с панелью — CLS 0,23 от
 * `my-created-trips-list` и `trip-plan-card-skeleton-frame`. Здесь всё, что
 * меняется между узким и широким видом, объявлено один раз: React читает по
 * живому `isDesktop`, critical CSS отдаёт широкую сторону первому кадру.
 * Граница — `METRICS.breakpoints.desktop`, та же, что у `useResponsive().isDesktop`.
 */
export const MY_CREATED_TRIPS_LAYOUT = defineBreakpointLayout({
  scope: 'myTrips',
  minWidth: METRICS.breakpoints.desktop,
  blocks: {
    // Телефон: колонка «поиск и фильтры → список»; desktop: панель слева от списка.
    body: {
      narrow: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
      wide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    },
    sidebar: { narrow: { width: '100%' }, wide: { width: 260 } },
    // Кнопка «Фильтры» есть только на телефоне; панель фильтров на desktop открыта всегда.
    filterToggle: { narrow: { display: 'flex' }, wide: { display: 'none' } },
    filterPanel: { narrow: { display: 'none' }, wide: { display: 'flex' } },
    gridItem: { narrow: { width: '100%' }, wide: { width: '48.8%' } },
  },
})

export type MyCreatedTripsLayoutKey = keyof typeof MY_CREATED_TRIPS_LAYOUT.blocks
