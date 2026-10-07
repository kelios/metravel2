import { readRetryTwice } from '@/utils/queryRetryPolicy';
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

import { queryKeys } from '@/api/queryKeys';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { fetchSecurityJournal, type SecurityJournalEntryDto, type SecurityJournalPage } from '@/api/privacy';

/**
 * Журнал безопасности текущего пользователя с постраничной подгрузкой.
 * Graceful-degradation: пока BE-security-journal не готов, отдаёт пустой список.
 */
export function useSecurityJournal(enabled = true) {
    const { isAuthenticated } = useAuth();
    const owner = useQueryOwner();

    const query = useInfiniteQuery<SecurityJournalPage>({
        queryKey: queryKeys.securityJournal(owner),
        queryFn: ({ pageParam }) => fetchSecurityJournal((pageParam as number) ?? 1),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
        enabled: isAuthenticated && enabled,
        staleTime: 60 * 1000,
        retry: readRetryTwice,
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
