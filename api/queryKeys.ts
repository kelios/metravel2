export const queryKeys = {
  travel: (slugOrId: string | number) => ['travel', slugOrId] as const,
  travelAll: () => ['travel'] as const,
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
  myTravelsCount: (userId: string | number | null | undefined) =>
    ['my-travels-count', userId] as const,
  exportMyTravelsCount: (userId: string | number | null | undefined) =>
    ['export-my-travels-count', userId] as const,
  travelUserRating: (travelId: number | undefined) =>
    ['travelUserRating', travelId] as const,
  questUserReview: (questId: number | undefined) =>
    ['questUserReview', questId] as const,
  homePopularTravels: () => ['home-popular-travels'] as const,
  rouletteTravelFacets: (params: Record<string, unknown>) =>
    ['roulette-travel-facets', params] as const,
  travelsForMap: (params: Record<string, unknown>, perPage: number) =>
    ['travelsForMap', params, { perPage }] as const,
  travelsForMapAll: () => ['travelsForMap'] as const,
  travelsForMapRoute: (params: Record<string, unknown>) =>
    ['travelsForMapRoute', params] as const,
  travelsForMapRouteAll: () => ['travelsForMapRoute'] as const,
  articles: (params: { page: number; itemsPerPage: number; user_id?: string }) =>
    ['articles', params] as const,
  addressSearch: (query: string) => ['address-search', query] as const,
  locationSearch: (query: string) => ['location-search', query] as const,
  reverseGeocode: (lat: number, lng: number) => ['reverse-geocode', lat, lng] as const,
  mySubscriptions: () => ['my-subscriptions'] as const,
  mySubscribers: () => ['my-subscribers'] as const,
  userTravels: (userId: string | number | null | undefined) => ['user-travels', userId] as const,
  userProfile: (id: string | number | null | undefined, suffix?: unknown) =>
    (suffix === undefined
      ? (['user-profile', id] as const)
      : (['user-profile', id, suffix] as const)),
  userCountryProgress: (userId: string | number | null | undefined) =>
    ['user-country-progress', userId] as const,
  questBundle: (slug: string | null | undefined) => ['quest-bundle', slug] as const,
  quests: () => ['quests'] as const,
  questDetail: (questId: number | undefined) => ['quest', questId] as const,
  questRating: (questId: number | undefined) => ['quest', questId, 'rating'] as const,
  questReviews: (questId: string | undefined) => ['quest', questId, 'reviews'] as const,
  travelsForQuest: (searchTerm: string) => ['travels-for-quest', searchTerm] as const,
  articleRating: (articleId: number | undefined, isAuthenticated: boolean) =>
    ['articleRating', articleId, isAuthenticated] as const,
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
  messagesUnreadCount: () => ['messages', 'unread-count'] as const,
} as const;
