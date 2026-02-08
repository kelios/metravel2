export const queryKeys = {
  travel: (slugOrId: string | number) => ['travel', slugOrId] as const,
  travelsNear: (travelId: number) => ['travels-near', travelId] as const,
  travelsPopular: () => ['travels-popular'] as const,
  travelsOfMonth: () => ['travels-of-month'] as const,
  articles: (params: { page: number; itemsPerPage: number; user_id?: string }) =>
    ['articles', params] as const,
  addressSearch: (query: string) => ['address-search', query] as const,
  mySubscriptions: () => ['my-subscriptions'] as const,
  mySubscribers: () => ['my-subscribers'] as const,
} as const;
