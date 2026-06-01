import type { Travel } from '@/types/types';
import { PER_PAGE } from '@/components/listTravel/utils/listTravelConstants';

export interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export const keyExtractor = (item: Travel, index: number) => `${item.id}-${index}`;

export const PROFILE_TRAVELS_PER_PAGE = PER_PAGE;

export const EMPTY_ENGAGEMENT_STATS = {
  favoritesCount: 0,
  wishlistCount: 0,
  visitedCount: 0,
  plannedCount: 0,
} as const;

export const withVisibleEngagementStats = (travel: Travel): Travel =>
  travel.engagementStats
    ? travel
    : {
        ...travel,
        engagementStats: EMPTY_ENGAGEMENT_STATS,
      };
