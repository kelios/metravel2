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
export const isTopLevelSectionPath = (
  pathname: string,
  hasFilterQuery: boolean = false,
): boolean => TOP_LEVEL_SECTION_PATHS.has(pathname) && !hasFilterQuery

/**
 * Кабинетные коллекции со своей шапкой (ProfileCollectionHeader: заголовок +
 * «Назад»). Глобальная строка возврата на них дала бы вторую навигацию назад на
 * одном экране (#799), поэтому её не показываем — но сама шапка обязана быть во
 * ВСЕХ состояниях экрана, включая гостя и пустой список (#1725).
 */
export const SELF_HEADED_COLLECTION_PATHS = new Set<string>([
  '/favorites',
  '/history',
  '/calendar',
])

/**
 * Нужна ли экрану ГЛОБАЛЬНАЯ строка возврата (крошки на desktop, «Назад» +
 * заголовок на телефоне): да для всего, куда попадают переходом и что не несёт
 * собственной навигации назад.
 */
export const needsGlobalBackAffordance = (
  pathname: string,
  hasFilterQuery: boolean = false,
): boolean =>
  !isTopLevelSectionPath(pathname, hasFilterQuery) && !SELF_HEADED_COLLECTION_PATHS.has(pathname)
