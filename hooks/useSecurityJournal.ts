import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import { fetchSecurityJournal, type SecurityJournalEntryDto, type SecurityJournalPage } from '@/api/privacy';

/**
 * Журнал безопасности текущего пользователя с постраничной подгрузкой.
 * Graceful-degradation: пока BE-security-journal не готов, отдаёт пустой список.
 */
export function useSecurityJournal(enabled = true) {
    const { isAuthenticated } = useAuth();

    const query = useInfiniteQuery<SecurityJournalPage>({
        queryKey: queryKeys.securityJournal(),
        queryFn: ({ pageParam }) => fetchSecurityJournal((pageParam as number) ?? 1),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
        enabled: isAuthenticated && enabled,
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            if (isTimeoutError(error)) return false;
            return failureCount < 2;
        },
    });

    const entries: SecurityJournalEntryDto[] = useMemo(
        () => query.data?.pages.flatMap((p) => p.results) ?? [],
        [query.data]
    );

    return useMemo(
        () => ({
            entries,
            total: query.data?.pages?.[0]?.count ?? entries.length,
            isLoading: query.isLoading,
            isError: query.isError,
            hasNextPage: !!query.hasNextPage,
            isFetchingNextPage: query.isFetchingNextPage,
            fetchNextPage: query.fetchNextPage,
            refetch: query.refetch,
        }),
        [entries, query.data, query.isLoading, query.isError, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query.refetch]
    );
}
