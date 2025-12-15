import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, type UserProfileDto } from '@/src/api/user';

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

  const query = useQuery({
    queryKey: ['user-profile', normalizedUserId, options.cacheKeySuffix],
    queryFn: () => fetchUserProfile(String(normalizedUserId)),
    enabled: enabled && !!normalizedUserId,
    staleTime: options.staleTimeMs ?? 10 * 60 * 1000,
  });

  const fullName = useMemo(() => {
    const p: UserProfileDto | undefined = query.data;
    if (!p) return '';

    const clean = (value: unknown) => {
      const v = String(value ?? '').trim();
      if (!v) return '';
      const lower = v.toLowerCase();
      if (lower === 'null' || lower === 'undefined') return '';
      return v;
    };

    return `${clean(p.first_name)} ${clean(p.last_name)}`.trim();
  }, [query.data]);

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    fullName,
    refetch: query.refetch,
  };
}
