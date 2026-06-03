export const queryKeys = {
  travel: (slugOrId: string | number) => ['travel', slugOrId] as const,
  travels: () => ['travels'] as const,
  randomTravels: () => ['random-travels'] as const,
  travelsNear: (travelId: number) => ['travels-near', travelId] as const,
  travelsPopular: () => ['travels-popular'] as const,
  travelRouteFiles: (travelId: string | number) => ['travel-route-files', travelId] as const,
  travelsOfMonth: () => ['travelsOfMonth'] as const,
  filters: () => ['filters'] as const,
  countries: () => ['countries'] as const,
  filterOptions: () => ['filter-options'] as const,
  allCountries: () => ['all-countries'] as const,
  travelFacets: (search: string, params: Record<string, unknown>) =>
    ['travel-facets', search, params] as const,
  userPointsAll: () => ['userPointsAll'] as const,
  userPointsCategoryDictionary: () => ['userPointsCategoryDictionary'] as const,
  myTravelsCount: (userId: string | number | null | undefined) =>
    ['my-travels-count', userId] as const,
  exportMyTravelsCount: (userId: string | number | null | undefined) =>
    ['export-my-travels-count', userId] as const,
  travelUserRating: (travelId: number | undefined) =>
    ['travelUserRating', travelId] as const,
  articles: (params: { page: number; itemsPerPage: number; user_id?: string }) =>
    ['articles', params] as const,
  addressSearch: (query: string) => ['address-search', query] as const,
  mySubscriptions: () => ['my-subscriptions'] as const,
  mySubscribers: () => ['my-subscribers'] as const,
  userProfile: (id: string | number | null | undefined, suffix?: unknown) =>
    (suffix === undefined
      ? (['user-profile', id] as const)
      : (['user-profile', id, suffix] as const)),
  questBundle: (slug: string | null | undefined) => ['quest-bundle', slug] as const,
  articleRating: (articleId: number | undefined, isAuthenticated: boolean) =>
    ['articleRating', articleId, isAuthenticated] as const,
  article: (articleId: number | undefined) => ['article', articleId] as const,
} as const;
