import type { Travel } from '@/types/types';
import { PER_PAGE } from '@/components/listTravel/utils/listTravelConstants';

export interface UserStats {
  /**
   * Сколько у автора маршрутов. `null` — счётчик потерян сбоем общего списка:
   * это не «маршрутов нет», и каждый потребитель обязан развести два случая
   * (#1871).
   */
  travelsCount: number | null;
  favoritesCount: number;
  viewsCount: number;
}

export const keyExtractor = (item: Travel, index: number) => `${item.id}-${index}`;

export const PROFILE_TRAVELS_PER_PAGE = PER_PAGE;

const EMPTY_ENGAGEMENT_STATS = {
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
