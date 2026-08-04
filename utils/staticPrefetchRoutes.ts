// Маршруты, для которых имеет смысл стартовый idle-префетч словарей.
//
// Статический префетч (utils/queryClientStaticPrefetch.ts) наполняет ровно один
// ключ React Query — filters(), — и читает его единственный потребитель:
// `usePointListCategoryDictionaryModel` (PointList в визарде путешествия), то
// есть маршруты `/travel/new` и `/travel/<id>`.
//
// Остальные экраны словари либо не читают вовсе, либо берут их своими путями:
// рулетка и каталог — по ключу `filterOptions()`, а
// `useTravelFilters`/`useVisitedCountries`/`useProfileCountriesData` — напрямую
// через общий кэш `api/miscOptimized`. Поэтому на `/quests`, `/map`, статьях,
// профиле, главной и рулетке стартовый префетч был чистой тратой канала (~25 КБ).
//
// Файл намеренно не импортирует ничего из `api/*`: его тянет корневой layout, а
// сам префетч подключается динамическим import(), чтобы словари фильтров не
// попадали в стартовый бандл.

/** Нужен ли стартовый префетч словарей на этом маршруте. */
export function shouldPrefetchTravelStatics(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || !pathname) return false;
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  // Только визард (`/travel/...`, единственное число): каталог и деталь статьи
  // живут на `/travels` и `/travels/<id>` и этого словаря не читают.
  return /^\/travel\/[^/]+$/.test(path);
}
