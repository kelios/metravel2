// Маршруты, для которых имеет смысл стартовый idle-префетч словарей.
//
// Статический префетч (utils/queryClientStaticPrefetch.ts) наполняет РОВНО два
// ключа React Query — filters() и countries(), — а читают их только два места:
//   • `usePointListCategoryDictionaryModel` (PointList в визарде путешествия)
//     по queryKeys.filters() — маршруты `/travel/new` и `/travel/<id>`;
//   • `useRoulette` по queryKeys.countries() — маршрут `/roulette`.
//
// Остальные потребители словарей (`useTravelFilters`, `useVisitedCountries`,
// `useProfileCountriesData`) ходят в `api/misc` напрямую, мимо этих ключей, и от
// префетча ничего не получают. Поэтому на всех прочих маршрутах — `/quests`,
// `/map`, статьях, профиле, главной — он был чистой тратой канала (~25 КБ).
//
// Файл намеренно не импортирует ничего из `api/*`: его тянет корневой layout, а
// сам префетч подключается динамическим import(), чтобы словари фильтров не
// попадали в стартовый бандл.

/** Нужен ли стартовый префетч словарей на этом маршруте. */
export function shouldPrefetchTravelStatics(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || !pathname) return false;
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (path === '/roulette') return true;
  // Только визард (`/travel/...`, единственное число): каталог и деталь статьи
  // живут на `/travels` и `/travels/<id>` и этих словарей не читают.
  return /^\/travel\/[^/]+$/.test(path);
}
