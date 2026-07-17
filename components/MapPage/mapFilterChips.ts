/**
 * mapFilterChips — единый источник правды про ряд чипов активных фильтров
 * поверх карты (mobile, radius-режим).
 *
 * Зачем модуль: ряд чипов живёт в MapMobileTopOverlay (overlay-слой, zIndex
 * 1500), а плашка «Геолокация недоступна» — в MapCanvas (слой карты, zIndex
 * 1010, absolute `top`). Это РАЗНЫЕ поддеревья, они не участвуют в одном
 * вертикальном потоке, поэтому «стек» под тулбаром приходится собирать вручную.
 * Чтобы оба слоя не разъехались, и предикат видимости ряда, и его высота
 * объявлены здесь один раз:
 *  - MapMobileTopOverlay — рисует ряд и опускает под него поповеры;
 *  - MapMobileLayout — прячет дублирующий FAB сброса, пока ряд виден;
 *  - MapScreen/MapCanvas — опускает гео-баннер под ряд.
 */

export type MapFilterChip = { key: string; label: string }

/** Высота самого ряда чипов (chip: paddingVertical 4 + текст lineHeight ~14 + бордер). */
export const MAP_FILTER_CHIPS_ROW_HEIGHT = 24
/** Воздух между рядом чипов и тем, что идёт под ним. */
export const MAP_FILTER_CHIPS_ROW_GAP = 10
/** Насколько ряд чипов сдвигает вниз всё, что стоит под тулбаром. */
export const MAP_FILTER_CHIPS_STACK_OFFSET =
  MAP_FILTER_CHIPS_ROW_HEIGHT + MAP_FILTER_CHIPS_ROW_GAP

/**
 * Радиус всегда имеет непустое значение и показан отдельной кнопкой-бейджем в
 * тулбаре, поэтому чипа не даёт (как и в панельном ActiveFiltersBar).
 */
export function getVisibleMapFilterChips(
  items: ReadonlyArray<MapFilterChip> | undefined | null,
): MapFilterChip[] {
  return (items ?? []).filter((item) => item.key !== 'radius')
}

/**
 * Ряд виден только в radius-режиме (в маршруте верх занят рядом «Старт» +
 * подсказкой, а категории там ни на что не влияют) и только если чипы реально
 * есть. Текстовый поиск делает «фильтры активны» true, но чипа не даёт — такой
 * случай не считается видимым рядом.
 */
export function isMapFilterChipsRowVisible(params: {
  mode: 'radius' | 'route' | undefined
  items: ReadonlyArray<MapFilterChip> | undefined | null
  canRemove: boolean
}): boolean {
  const { mode, items, canRemove } = params
  if (mode === 'route') return false
  if (!canRemove) return false
  return getVisibleMapFilterChips(items).length > 0
}
