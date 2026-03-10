import { useQuery } from '@tanstack/react-query';

import { listTravelRouteFiles } from '@/api/travelRoutes';
import { queryKeys } from '@/queryKeys';
import { queryConfigs } from '@/utils/reactQueryConfig';

export function useTravelRouteFiles(travelId: string | number | null | undefined) {
  try {
    return useQuery({
      queryKey: queryKeys.travelRouteFiles(String(travelId ?? '')),
      queryFn: () => listTravelRouteFiles(String(travelId)),
      enabled: travelId != null && String(travelId).trim().length > 0,
      ...queryConfigs.static,
    });
  } catch {
    return {
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: async () => ({ data: [] }),
    } as const;
  }
}
