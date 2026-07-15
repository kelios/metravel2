import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, normalizeProfileName, type UserProfileDto } from '@/api/user';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';

type Options = {
  enabled?: boolean;
  staleTimeMs?: number;
  cacheKeySuffix?: unknown;
};

export function useUserProfileCached(userId: string | number | null | undefined, options: Options = {}) {
  const enabled = options.enabled ?? true;

  const normalizedUserId = useMemo(() => {
    if (userId == null) return null;
    const v = String(userId).trim();
    return v ? v : null;
  }, [userId]);

  const query = useQuery<UserProfileDto | null>({
    queryKey: queryKeys.userProfile(normalizedUserId, options.cacheKeySuffix),
    queryFn: async () => {
      try {
        return await fetchUserProfile(String(normalizedUserId));
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return null;
        }
        throw e;
      }
    },
    enabled: enabled && !!normalizedUserId,
    staleTime: options.staleTimeMs ?? 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      // Не ретраим таймаут: повтор зависшего бэка лишь утраивает ожидание под
      // спиннером карточки автора (~33с вместо ~10с).
      if (isTimeoutError(error)) return false;
      return failureCount < 2;
    },
  });

  const fullName = useMemo(() => {
    const p: UserProfileDto | null | undefined = query.data;
    if (!p) return '';
    return `${normalizeProfileName(p.first_name)} ${normalizeProfileName(p.last_name)}`.trim();
  }, [query.data]);

  return useMemo(() => ({
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    fullName,
    refetch: query.refetch,
  }), [query.data, query.isLoading, query.isFetching, query.error, fullName, query.refetch]);
}
