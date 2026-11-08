/**
 * Leaf-модуль без зависимостей: формат счётчика бейджа живёт отдельно от
 * `TravelListPanel/helpers`, который тянет `useMapTravels` (react-query, API,
 * офлайн-каталог). Иначе общий `SegmentedControl` (страница путешествия,
 * планировщик поездки) затягивал бы этот граф в свои чанки (#3134).
 */
export const PLACE_COUNT_BADGE_CAP = 999
/**
 * Text of a place-count badge: the count itself up to the cap, «999+» above it.
 * The one formula for every map badge and summary (list, sheet, panel header,
 * collapsed strip), so the cap cannot drift between surfaces (#2217).
 */
export const formatPlaceCountBadge = (count: number): string =>
  count > PLACE_COUNT_BADGE_CAP ? `${PLACE_COUNT_BADGE_CAP}+` : String(count)
