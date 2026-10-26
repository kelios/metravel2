import type Feather from '@expo/vector-icons/Feather'

type FeatherIconName = keyof typeof Feather.glyphMap

/**
 * #2777 (MAP-TOOLBAR-ICON-SEMANTICS) — один словарь «действие карты → иконка»
 * для мобильного ряда, тура и desktop-панели. До него ряд взял `maximize`
 * («развернуть») для сброса фильтров и `navigation` (стрелку «где я») для входа
 * в маршрут, а «моё местоположение» было прицелом: иконка обещала одно, кнопка
 * делала другое.
 *
 * - `route` — та же развилка, что у сегмента «Маршрут» (`alt-route` →
 *   `git-branch`, `mapIconName.ts`); стрелки `navigation*` и `crosshair` заняты
 *   геолокацией и навигаторами.
 * - `reset` — «вернуть как было», не «развернуть».
 *
 * Контроль — `__tests__/components/MapPage/mapActionIcons.test.tsx`.
 */
export const MAP_ACTION_ICON = {
  locate: 'crosshair',
  filters: 'sliders',
  radius: 'target',
  layers: 'layers',
  list: 'list',
  reset: 'rotate-ccw',
  route: 'git-branch',
} as const satisfies Record<string, FeatherIconName>

/** Иконки, которые пользователь читает как «где я / навигатор» — не для маршрута и сброса. */
export const MAP_GEOLOCATION_LOOKALIKE_ICONS: readonly FeatherIconName[] = [
  'navigation',
  'navigation-2',
  'crosshair',
  'compass',
]

/** Иконки «развернуть/свернуть» — не для сброса. */
export const MAP_EXPAND_LOOKALIKE_ICONS: readonly FeatherIconName[] = [
  'maximize',
  'maximize-2',
  'minimize',
  'minimize-2',
]
