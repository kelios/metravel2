import { BOTTOM_DOCK_SECTION_PATHS } from '@/constants/bottomDockRoutes'
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'

/**
 * Разделы верхней навигации: их адресуют основное меню (desktop) и нижний док
 * (mobile). На такой экран попадают одним нажатием из самой навигации, у него
 * нет «предыдущего» по построению, и строка возврата на нём только съедала бы
 * высоту первого экрана.
 *
 * Набор ВЫВОДИТСЯ из самой навигации, а не переписывается руками. #1725: три
 * рукописные копии этого списка (`customHeaderModel`, `HeaderContextBar`,
 * `useHeaderContextBarFallbackVisibility.native`) разошлись между собой и с
 * навигацией — `/favorites`, `/history`, `/calendar` и `/metravel` числились
 * «верхними разделами», хотя ни в меню, ни в доке их нет и попасть туда можно
 * только переходом. Всё, чего нет в навигации, — экран, куда попали переходом,
 * и он обязан показать хотя бы один явный способ вернуться.
 */
export const TOP_LEVEL_SECTION_PATHS = new Set<string>([
  '/',
  '/index',
  ...HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path),
  ...BOTTOM_DOCK_SECTION_PATHS,
])

/**
 * Параметры, с которыми список маршрутов открывают уже отфильтрованным: их
 * кладёт в адрес `buildFilterPath` (подсказки главной, чипы «Идеи») и читает
 * `components/listTravel/hooks/useListTravelInitialFilter.ts`. `sort` сюда
 * НЕ входит: сортировку выбирают на самом экране, и `ListTravelBase` сам
 * дописывает её в адрес.
 */
const LIST_FILTER_QUERY_KEYS = new Set<string>([
  'categories',
  'categoryTravelAddress',
  // expo-router на web иногда экранирует «_» в ключе запроса как «__».
  'category_travel_address',
  'category__travel__address',
  'over_nights_stay',
  'over__nights__stay',
  'companions',
  'complexity',
  'month',
  'user_id',
  'search',
  'q',
])

const tryDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const hasQueryValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.some((item) => hasQueryValue(item))
  return String(value).trim().length > 0
}

/**
 * `true`, когда адрес несёт фильтр списка маршрутов, то есть экран открыт
 * переходом с уже выбранной подборкой, а не как раздел навигации.
 * Принимает и объект параметров (`useGlobalSearchParams`), и сырую строку
 * запроса (`window.location.search`).
 */
export const hasListFilterQuery = (
  query: Record<string, unknown> | string | null | undefined,
): boolean => {
  if (!query) return false

  if (typeof query === 'string') {
    const raw = query.startsWith('?') ? query.slice(1) : query
    if (!raw) return false

    return raw.split('&').some((pair) => {
      if (!pair) return false
      const separator = pair.indexOf('=')
      const key = separator === -1 ? pair : pair.slice(0, separator)
      const value = separator === -1 ? '' : pair.slice(separator + 1)
      return LIST_FILTER_QUERY_KEYS.has(tryDecode(key)) && tryDecode(value).trim().length > 0
    })
  }

  return Object.entries(query).some(
    ([key, value]) => LIST_FILTER_QUERY_KEYS.has(key) && hasQueryValue(value),
  )
}

/**
 * Экран навигации, а не результат перехода. Отфильтрованный список разделом
 * быть перестаёт: `/search` без параметров — это «Маршруты» из дока, а
 * `/search?categoryTravelAddress=33,43` — подборка «Замки», открытая с главной,
 * и вернуться с неё должно быть куда (#1725).
 */
/**
 * Пункты верхнего меню desktop, которых нет в нижнем доке (корни дока — /search,
 * /map, /quests, /profile). `/places` и `/roulette` на телефоне открывают из
 * «Ещё»; `/trips` — только переходом (CTA главной, «Мои поездки»), ни дока, ни
 * «Ещё» у него нет, и назад иначе вернуться нечем. Это вложенные экраны со
 * строкой «←» (#2099, `docs/features/mobile-screen-shell-mock.md` §2).
 */
export const MOBILE_NESTED_SECTION_PATHS = new Set<string>(['/trips', '/places', '/roulette'])

export const isTopLevelSectionPath = (
  pathname: string,
  hasFilterQuery: boolean = false,
  isMobile: boolean = false,
): boolean =>
  TOP_LEVEL_SECTION_PATHS.has(pathname) &&
  !(isMobile && MOBILE_NESTED_SECTION_PATHS.has(pathname)) &&
  !hasFilterQuery

/**
 * Кабинетные коллекции (#2099). На телефоне их заголовок, «←» и «⋯» рисует
 * глобальная строка `HeaderContextBar` по декларации `useScreenHeader`, а
 * `ProfileCollectionHeader` молчит; на desktop строки нет, а «Назад», крошки и
 * «Очистить» — в `ProfileCollectionHeader`. Владелец «Назад» ровно один на
 * каждой ширине (семья NATIVE-DUP-BACK-AFFORDANCE-001).
 */
export const COLLECTION_PATHS = new Set<string>([
  '/favorites',
  '/history',
  '/calendar',
])

/**
 * Нужна ли экрану ГЛОБАЛЬНАЯ строка возврата (крошки на desktop, «←» +
 * заголовок на телефоне): да для всего, куда попадают переходом и что не несёт
 * собственной навигации назад. Кабинетные коллекции получают её только на
 * телефоне (`isMobile`).
 */
export const needsGlobalBackAffordance = (
  pathname: string,
  hasFilterQuery: boolean = false,
  isMobile: boolean = false,
): boolean =>
  !isTopLevelSectionPath(pathname, hasFilterQuery, isMobile) && (isMobile || !COLLECTION_PATHS.has(pathname))
