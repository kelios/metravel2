export const queryKeys = {
  travel: (slugOrId: string | number) => ['travel', slugOrId] as const,
  travelAll: () => ['travel'] as const,
  travels: () => ['travels'] as const,
  randomTravels: () => ['random-travels'] as const,
  travelsNear: (travelId: number) => ['travels-near', travelId] as const,
  travelsNearMap: (
    travelId: number,
    origin: { lat: number; lng: number },
    travels: Array<{ id: number; slug: string }>,
  ) => ['travels-near-map', travelId, origin, travels] as const,
  travelsPopular: () => ['travels-popular'] as const,
  travelRouteFiles: (travelId: string | number) => ['travel-route-files', travelId] as const,
  travelsOfMonth: () => ['travelsOfMonth'] as const,
  // Справочники живут в общем кэше api/miscOptimized, у React Query остались
  // только ключи, которые кто-то реально читает: filters() — PointList визарда,
  // filterOptions() — каталог и рулетка. Отдельные countries()/allCountries()
  // были ключами без читателей и порождали дубли запросов.
  filters: () => ['filters'] as const,
  filterOptions: () => ['filter-options'] as const,
  travelFacets: (search: string, params: Record<string, unknown>) =>
    ['travel-facets', search, params] as const,
  userPointsAll: () => ['userPointsAll'] as const,
  userPointsPagination: () => ['userPointsAll', 'pagination'] as const,
  myTravelsCount: (userId: string | number | null | undefined) =>
    ['my-travels-count', userId] as const,
  exportMyTravelsCount: (userId: string | number | null | undefined) =>
    ['export-my-travels-count', userId] as const,
  travelUserRating: (travelId: number | undefined) =>
    ['travelUserRating', travelId] as const,
  // Личный отзыв принадлежит аккаунту, а не устройству: при logout/login
  // соседние пользователи не должны делить thank-you state и префилл.
  questUserReview: (userId: string | null, questId: number | undefined) =>
    ['questUserReview', userId, questId] as const,
  homePopularTravels: () => ['home-popular-travels'] as const,
  rouletteTravelFacets: (params: Record<string, unknown>) =>
    ['roulette-travel-facets', params] as const,
  travelsForMap: (params: Record<string, unknown>, perPage: number) =>
    ['travelsForMap', params, { perPage }] as const,
  travelsForMapAll: () => ['travelsForMap'] as const,
  travelsForMapRoute: (params: Record<string, unknown>) =>
    ['travelsForMapRoute', params] as const,
  travelsForMapRouteAll: () => ['travelsForMapRoute'] as const,
  mapClusters: (params: Record<string, unknown>) => ['mapClusters', params] as const,
  mapClustersAll: () => ['mapClusters'] as const,
  // Ленивые материалы места (#1571): ключ по placeKey — один запрос на place
  // на cache lifetime, повторное открытие карточки идёт из кэша.
  mapPlaceSources: (placeKey: string) => ['map-place-sources', placeKey] as const,
  mapPlaceSourcesAll: () => ['map-place-sources'] as const,
  articles: (params: { page: number; itemsPerPage: number; user_id?: string }) =>
    ['articles', params] as const,
  // Язык ответа геокодера зависит от локали интерфейса (#1742/#1782), поэтому
  // локаль входит в ключ: иначе кэш отдал бы чужой язык подсказок.
  addressSearch: (query: string, language: string) =>
    ['address-search', language, query] as const,
  locationSearch: (query: string, locale: string) => ['location-search', locale, query] as const,
  reverseGeocode: (lat: number, lng: number, locale: string) =>
    ['reverse-geocode', locale, lat, lng] as const,
  mySubscriptions: () => ['my-subscriptions'] as const,
  mySubscribers: () => ['my-subscribers'] as const,
  userTravels: (userId: string | number | null | undefined) => ['user-travels', userId] as const,
  userProfile: (id: string | number | null | undefined, suffix?: unknown) =>
    (suffix === undefined
      ? (['user-profile', id] as const)
      : (['user-profile', id, suffix] as const)),
  userCountryProgress: (userId: string | number | null | undefined) =>
    ['user-country-progress', userId] as const,
  // Пользовательские коллекции серверного стейта (FE-ARCH D1 #994).
  // Scoped по userId для identity-isolation: гость (null) ↔ userA ↔ userB
  // не делят кэш; смена пользователя = другой ключ, а не «протекающие» данные.
  favorites: (userId: string | null) => ['favorites', userId] as const,
  recommendations: (userId: string | null) => ['recommendations', userId] as const,
  viewHistory: (userId: string | null) => ['view-history', userId] as const,
  travelStatus: (userId: string | null) => ['travel-status', userId] as const,
  travelStatusAuthored: (userId: string | null) =>
    ['travel-status', userId, 'authored'] as const,
  // Детализация «кто и какой маршрут» по метрике автора (#1192). Автор всегда —
  // текущий пользователь, поэтому ключ scoped по userId, как остальные личные коллекции.
  authorEngagementDetails: (userId: string | null, metric: string) =>
    ['author-engagement', userId, metric] as const,
  questBundle: (slug: string | null | undefined) => ['quest-bundle', slug] as const,
  quests: () => ['quests'] as const,
  // Срез каталога для промо-блоков (главная): отдельный ключ, чтобы пара
  // карточек не тянула весь список квестов. Префикс общий с quests(), поэтому
  // инвалидация каталога подхватывает и его.
  questsPreview: (limit: number) => ['quests', 'preview', limit] as const,
  questDetail: (questId: number | undefined) => ['quest', questId] as const,
  questReviews: (questId: string | undefined) => ['quest', questId, 'reviews'] as const,
  travelsForQuest: (searchTerm: string) => ['travels-for-quest', searchTerm] as const,
  questsNearLocation: (loc: string) => ['quests-near-location', loc] as const,
  // #1484: компактный каталог для коллекции города и блока «следующий квест».
  // Префикс общий с quests(), чтобы инвалидация каталога чистила и его.
  questsCompactCatalog: (userId: string | null) => ['quests', 'compact-catalog', userId] as const,
  // Прохождения текущего пользователя: дешёвый гейт перед каталогом (#1484).
  questProgressAll: (userId: string | null) => ['quest-progress', userId] as const,
  travelsNearLocation: (loc: string) => ['travels-near-location', loc] as const,
  articleRating: (articleId: number | undefined, isAuthenticated: boolean) =>
    ['articleRating', articleId, isAuthenticated] as const,
  placeRating: (placeId: string | number | undefined, isAuthenticated: boolean) =>
    ['placeRating', placeId, isAuthenticated] as const,
  article: (articleIdOrSlug: number | string | undefined) => ['article', articleIdOrSlug] as const,
  stravaStatus: () => ['strava', 'status'] as const,
  stravaActivitiesRoot: () => ['strava', 'activities'] as const,
  stravaActivities: (params: Record<string, unknown>) => ['strava', 'activities', params] as const,
  stravaActivity: (activityId: string | number | null | undefined) =>
    ['strava', 'activity', activityId] as const,
  achievementsBadges: () => ['achievements', 'badges'] as const,
  achievementsMe: () => ['achievements', 'me'] as const,
  achievementsUser: (userId: string | number | null | undefined) =>
    ['achievements', 'user', userId] as const,
  achievementsPeerCatalog: () => ['achievements', 'peer-catalog'] as const,
  achievementsTravelPeer: (travelId: string | number | null | undefined) =>
    ['achievements', 'travel-peer', travelId] as const,
  achievementsRareMe: () => ['achievements', 'rare', 'me'] as const,
  achievementsRareUser: (userId: string | number | null | undefined) =>
    ['achievements', 'rare', 'user', userId] as const,
  achievementsRareCatalog: () => ['achievements', 'rare', 'catalog'] as const,
  gamificationPlaceBadgesMe: () => ['gamification', 'place-badges', 'me'] as const,
  gamificationPlaceBadgesUser: (userId: string | number | null | undefined) =>
    ['gamification', 'place-badges', 'user', userId] as const,
  gamificationProgressMe: () => ['gamification', 'progress', 'me'] as const,
  gamificationProgressUser: (userId: string | number | null | undefined) =>
    ['gamification', 'progress', 'user', userId] as const,
  gamificationCharacterMe: () => ['gamification', 'character', 'me'] as const,
  gamificationCharacterUser: (userId: string | number | null | undefined) =>
    ['gamification', 'character', 'user', userId] as const,
  privacySettings: () => ['privacy', 'settings'] as const,
  securityJournal: () => ['security', 'journal'] as const,
  publicTrips: (filters: Record<string, unknown>) => ['public-trips', filters] as const,
  publicTripsAll: () => ['public-trips'] as const,
  publicTrip: (tripId: string | number | null | undefined) =>
    ['public-trip', tripId] as const,
  tripMyApplications: () => ['trip-applications', 'me'] as const,
  tripApplications: (tripId: string | number | null | undefined) =>
    ['trip-applications', 'trip', tripId] as const,
  tripNotifications: () => ['trip-notifications'] as const,
  // Планирование поездок (Sprint 13 / блок D)
  plannedTripsMine: () => ['planned-trips', 'me'] as const,
  plannedTripsAll: () => ['planned-trips'] as const,
  plannedTrip: (tripId: string | number | null | undefined) =>
    ['planned-trip', tripId] as const,
  communityTrips: (filters: Record<string, unknown>) =>
    ['community-trips', filters] as const,
  communityTripsAll: () => ['community-trips'] as const,
  tripRouteElevation: (tripId: string | number | null | undefined) =>
    ['trip-route-elevation', tripId] as const,
  // Исходный GPX/KML поездки и распарсенная из него неупрощённая геометрия (#1496).
  // Ключ трека держит `revision` (updated_at/created_at), потому что замена файла
  // сохраняет тот же id — без него на карте осталась бы геометрия прошлого файла.
  plannedTripRouteFile: (tripId: string | number | null | undefined) =>
    ['planned-trip-route-file', tripId] as const,
  plannedTripRouteTrack: (
    tripId: string | number | null | undefined,
    routeId: string | number | null | undefined,
    revision: string | null | undefined,
  ) => ['planned-trip-route-track', tripId, routeId, revision ?? ''] as const,
  routeTemplates: () => ['route-templates'] as const,
  tripSuggestions: (tripId: string | number | null | undefined) =>
    ['trip-suggestions', tripId] as const,
  // Trust & Safety (Sprint 16)
  userReportReasons: () => ['user-report-reasons'] as const,
  myBlockedUsers: () => ['user-blocked', 'me'] as const,
  myVerifications: () => ['user-verifications', 'me'] as const,
  participantRating: (
    tripId: string | number | null | undefined,
    userId: string | number | null | undefined,
  ) => ['participant-rating', tripId, userId] as const,
  // Коммуникация участников (Sprint 15 / блок 6)
  myTelegramLink: () => ['telegram-link', 'me'] as const,
  tripChat: (tripId: string | number | null | undefined) => ['trip-chat', tripId] as const,
  tripChatAll: () => ['trip-chat'] as const,
  tripChatMessages: (threadId: string | number | null | undefined) =>
    ['trip-chat-messages', threadId] as const,
  tripTelegramGroup: (tripId: string | number | null | undefined) =>
    ['trip-telegram-group', tripId] as const,
  contactRequests: (direction: string, status?: string) =>
    ['contact-requests', direction, status ?? 'all'] as const,
  contactRequestsAll: () => ['contact-requests'] as const,
  // Привязка к пользователю обязательна: логаут кэш не чистит, и без неё
  // следующий вошедший увидел бы чужое число непрочитанных (#1661).
  messagesUnreadCount: (userId: string | null) => ['messages', 'unread-count', userId] as const,
} as const;
