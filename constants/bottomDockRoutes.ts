/**
 * Маршруты нижнего дока — отдельно от `components/layout/bottomDockModel.ts`,
 * где живут подписи, иконки и порядок пунктов.
 *
 * Разделение не косметическое: список маршрутов нужен ЭАГЕРНОМУ слою шапки
 * (`components/layout/topLevelSections.ts` решает, показывать ли строку
 * возврата, и его зовёт `app/(tabs)/_layout.tsx` ещё до гидратации), а сам
 * `bottomDockModel` с сорока i18n-геттерами на web приезжает лениво вместе с
 * `BottomDock`. Импорт модели ради четырёх строк затащил бы её в стартовый граф
 * каждого маршрута — ровно то, что гейт `guard:bundle-budget` считает
 * регрессией (#1286, #1543, #1721).
 *
 * Ключ «more» сюда не входит: он открывает шит, а не экран.
 */
export const BOTTOM_DOCK_ROUTES = {
  home: '/search',
  map: '/map',
  quests: '/quests',
  favorites: '/profile',
} as const

export const BOTTOM_DOCK_SECTION_PATHS: readonly string[] = Object.values(BOTTOM_DOCK_ROUTES)
