const MY_TRAVELS_FIXTURE_DATA = [
  {
    id: 101,
    title: 'My Travel 1',
    countryName: 'Польша',
    countryCode: 'PL',
    engagement_stats: {
      favorites_count: 7,
      wishlist_count: 1,
      visited_count: 3,
      planned_count: 2,
    },
  },
  {
    id: 102,
    title: 'My Travel 2',
    countryName: 'Литва',
    countryCode: 'LT',
    engagementStats: {
      favoritesCount: 1,
      wishlistCount: 0,
      visitedCount: 0,
      plannedCount: 5,
    },
  },
  {
    id: 103,
    title: 'My Travel 3',
    countryName: '',
    engagement_stats: {
      favorites_count: 0,
      wishlist_count: 0,
      visited_count: 0,
      planned_count: 0,
    },
  },
] as const;

export const MY_TRAVELS_FIXTURE = {
  total: 3,
  count: 3,
  engagement_summary: {
    favorites_count: 8,
    wishlist_count: 1,
    visited_count: 3,
    planned_count: 7,
  },
  data: MY_TRAVELS_FIXTURE_DATA,
  results: MY_TRAVELS_FIXTURE_DATA,
} as const;

export const SUBSCRIPTION_AUTHOR_FIXTURE = {
  id: 10,
  first_name: 'Иван',
  last_name: 'Петров',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  avatar: '',
  user: 42,
} as const;

export const SUBSCRIBER_FIXTURE = {
  id: 20,
  first_name: 'Мария',
  last_name: 'Сидорова',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  avatar: '',
  user: 55,
} as const;
