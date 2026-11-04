import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchSubscriptionStatus, subscribeToUser, unsubscribeFromUser } from '@/api/user';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { translate as i18nT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { readRetryTwice } from '@/utils/queryRetryPolicy';

type SubscriptionChange = { owner: string; target: number; subscribe: boolean };

const isCurrentOwner = (owner: string) => {
    const state = useAuthStore.getState();
    return state.isAuthenticated && state.userId === owner;
};

export function useSubscriptionMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ owner, target, subscribe }: SubscriptionChange) => {
            const ensureCurrentOwner = () => {
                if (isCurrentOwner(owner)) return;
                const error = new Error('Subscription viewer changed');
                error.name = 'AbortError';
                throw error;
            };
            ensureCurrentOwner();
            return subscribe ? subscribeToUser(target, ensureCurrentOwner) : unsubscribeFromUser(target, ensureCurrentOwner);
        },
        onMutate: async ({ owner, target, subscribe }) => {
            const key = queryKeys.subscriptionStatus(owner, target);
            await queryClient.cancelQueries({ queryKey: key, exact: true });
            const previous = queryClient.getQueryData<boolean>(key);
            if (isCurrentOwner(owner) && previous !== undefined) queryClient.setQueryData(key, subscribe);
            return previous;
        },
        onError: (_error, { owner, target }, previous) => {
            if (isCurrentOwner(owner) && previous !== undefined) {
                queryClient.setQueryData(queryKeys.subscriptionStatus(owner, target), previous);
            }
        },
        onSuccess: (_result, { owner, target, subscribe }) => {
            if (!isCurrentOwner(owner)) return;
            const statusKey = queryKeys.subscriptionStatus(owner, target);
            queryClient.setQueryData(statusKey, subscribe);
            void queryClient.invalidateQueries({ queryKey: statusKey, exact: true });
            void queryClient.invalidateQueries({ queryKey: queryKeys.compactSocialPage(owner, 'subscriptions'), exact: true });
            void queryClient.invalidateQueries({ queryKey: queryKeys.mySubscriptions(owner), exact: true });
            void queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(owner), exact: true });
        },
    });
}

export function useSubscription(targetUserId: string | number | null | undefined, readStatus = true) {
    const { isAuthenticated, userId: currentUserId } = useAuth();
    const owner = useQueryOwner();
    const { run } = useActionFeedback();
    const { mutateAsync, isPending } = useSubscriptionMutation();

    const numericTarget = Number(targetUserId);
    const target = Number.isSafeInteger(numericTarget) && numericTarget > 0 ? numericTarget : null;
    const canSubscribe = isAuthenticated && owner !== null && target !== null && Number(currentUserId) !== target;
    const statusQuery = useQuery({
        queryKey: queryKeys.subscriptionStatus(owner, target),
        queryFn: ({ signal }) => fetchSubscriptionStatus(target!, signal),
        enabled: canSubscribe && readStatus,
        staleTime: 5 * 60 * 1000,
        retry: readRetryTwice,
    });

    const changeSubscription = useCallback((subscribe: boolean) => {
        if (!canSubscribe || !owner || target === null || statusQuery.data === undefined) return;
        const change = { owner, target, subscribe };
        return run({
            key: `subscription:${owner}:${target}`,
            commit: () => mutateAsync(change),
            success: {
                message: i18nT(subscribe ? 'common:feedback.subscribed' : 'common:feedback.unsubscribed'),
                ...(subscribe ? {} : { type: 'info' as const }),
                undo: { commit: () => mutateAsync({ ...change, subscribe: !subscribe }) },
            },
            error: {
                message: i18nT('shared:hooks.useSubscription.oshibka_282b48f5'),
                description: i18nT(subscribe
                    ? 'shared:hooks.useSubscription.ne_udalos_podpisatsya_poprobuyte_pozzhe_0dfb8d0c'
                    : 'shared:hooks.useSubscription.ne_udalos_otpisatsya_poprobuyte_pozzhe_a1ce39c4'),
            },
        });
    }, [canSubscribe, mutateAsync, owner, run, statusQuery.data, target]);

    return {
        isSubscribed: statusQuery.data === true,
        isLoading: canSubscribe && readStatus && statusQuery.isPending && !statusQuery.isPaused,
        isStatusUnavailable: canSubscribe && readStatus && statusQuery.data === undefined && (statusQuery.isError || statusQuery.isPaused),
        isMutating: isPending,
        canSubscribe,
        retryStatus: statusQuery.refetch,
        toggleSubscription: () => { void changeSubscription(!statusQuery.data); },
        subscribe: () => { void changeSubscription(true); },
        unsubscribe: () => { void changeSubscription(false); },
    };
}
