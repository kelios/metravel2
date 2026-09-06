import { useCallback, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { useQueryOwner } from '@/hooks/useQueryOwner';

type PointLike = Record<string, unknown>;

type Params = {
  queryClient: QueryClient;
  setIsBulkWorking: (value: boolean) => void;
};

export const usePointsDeletePoint = ({ queryClient, setIsBulkWorking }: Params) => {
  const owner = useQueryOwner();
  const [pointToDelete, setPointToDelete] = useState<PointLike | null>(null);

  const requestDeletePoint = useCallback((point: unknown) => {
    if (!point || typeof point !== 'object') {
      setPointToDelete(null);
      return;
    }
    setPointToDelete(point as PointLike);
  }, []);

  const confirmDeletePoint = useCallback(async () => {
    const id = Number(pointToDelete?.id);
    if (!Number.isFinite(id)) {
      setPointToDelete(null);
      return;
    }

    setIsBulkWorking(true);
    try {
      await userPointsApi.deletePoint(id);
      queryClient.setQueryData(queryKeys.userPointsAll(owner), (prev: unknown) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((p: unknown) => {
          const item = (p ?? {}) as Record<string, unknown>;
          return Number(item.id) !== id;
        });
      });
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setPointToDelete(null);
    }
  }, [owner, pointToDelete, queryClient, setIsBulkWorking]);

  return {
    pointToDelete,
    setPointToDelete,
    requestDeletePoint,
    confirmDeletePoint,
  };
};
