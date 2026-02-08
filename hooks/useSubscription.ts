import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
    fetchMySubscriptions,
    subscribeToUser,
    unsubscribeFromUser,
    type UserProfileDto,
} from '@/api/user';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import { showToast } from '@/utils/toast';

/**
 * Hook to manage subscription state for a target user.
 * Fetches the current user's subscriptions list and provides
 * subscribe/unsubscribe mutations with optimistic updates.
 */
export function useSubscription(targetUserId: string | number | null | undefined) {
    const { isAuthenticated, userId: currentUserId } = useAuth();
    const queryClient = useQueryClient();

    const normalizedTargetId = useMemo(() => {
        if (targetUserId == null) return null;
        const v = String(targetUserId).trim();
        return v || null;
    }, [targetUserId]);

    const isOwnProfile =
        currentUserId != null &&
        normalizedTargetId != null &&
        String(currentUserId) === normalizedTargetId;

    const enabled = isAuthenticated && !!normalizedTargetId && !isOwnProfile;

    const subscriptionsQuery = useQuery<UserProfileDto[]>({
        queryKey: queryKeys.mySubscriptions(),
        queryFn: fetchMySubscriptions,
        enabled,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            return failureCount < 2;
        },
    });

    const isSubscribed = useMemo(() => {
        if (!normalizedTargetId || !subscriptionsQuery.data) return false;
        return subscriptionsQuery.data.some(
            (p) =>
                String(p.user ?? p.id) === normalizedTargetId ||
                String(p.id) === normalizedTargetId
        );
    }, [normalizedTargetId, subscriptionsQuery.data]);

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.mySubscriptions() });
        queryClient.invalidateQueries({ queryKey: queryKeys.mySubscribers() });
    }, [queryClient]);

    const subscribeMutation = useMutation({
        mutationFn: () => subscribeToUser(normalizedTargetId!),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: queryKeys.mySubscriptions() });
            const previous = queryClient.getQueryData<UserProfileDto[]>(queryKeys.mySubscriptions());
            if (previous && normalizedTargetId) {
                const placeholder: UserProfileDto = {
                    id: Number(normalizedTargetId) || 0,
                    first_name: '',
                    last_name: '',
                    youtube: '',
                    instagram: '',
                    twitter: '',
                    vk: '',
                    avatar: '',
                    user: Number(normalizedTargetId) || 0,
                };
                queryClient.setQueryData<UserProfileDto[]>(
                    queryKeys.mySubscriptions(),
                    [...previous, placeholder]
                );
            }
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.mySubscriptions(), context.previous);
            }
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось подписаться. Попробуйте позже.' });
        },
        onSettled: () => invalidate(),
    });

    const unsubscribeMutation = useMutation({
        mutationFn: () => unsubscribeFromUser(normalizedTargetId!),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: queryKeys.mySubscriptions() });
            const previous = queryClient.getQueryData<UserProfileDto[]>(queryKeys.mySubscriptions());
            if (previous && normalizedTargetId) {
                queryClient.setQueryData<UserProfileDto[]>(
                    queryKeys.mySubscriptions(),
                    previous.filter(
                        (p) =>
                            String(p.user ?? p.id) !== normalizedTargetId &&
                            String(p.id) !== normalizedTargetId
                    )
                );
            }
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.mySubscriptions(), context.previous);
            }
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось отписаться. Попробуйте позже.' });
        },
        onSettled: () => invalidate(),
    });

    const toggleSubscription = useCallback(() => {
        if (!normalizedTargetId || !isAuthenticated) return;
        if (isSubscribed) {
            unsubscribeMutation.mutate();
        } else {
            subscribeMutation.mutate();
        }
    }, [normalizedTargetId, isAuthenticated, isSubscribed, subscribeMutation, unsubscribeMutation]);

    return useMemo(
        () => ({
            isSubscribed,
            isLoading: subscriptionsQuery.isLoading,
            isMutating: subscribeMutation.isPending || unsubscribeMutation.isPending,
            toggleSubscription,
            subscribe: () => subscribeMutation.mutate(),
            unsubscribe: () => unsubscribeMutation.mutate(),
            canSubscribe: enabled,
        }),
        [
            isSubscribed,
            subscriptionsQuery.isLoading,
            toggleSubscription,
            subscribeMutation,
            unsubscribeMutation,
            enabled,
        ]
    );
}
