import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
    fetchUserProfile,
    normalizeAvatar,
    normalizeProfileName,
    type UserProfileDto,
} from '@/api/user';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'


/**
 * Shared hook for loading and managing user profile state.
 * Used by both profile.tsx and settings.tsx to avoid duplicated logic.
 *
 * Backed by React Query on queryKeys.userProfile(userId) so it shares one cache
 * entry (and request-dedupes) with authStore.checkAuthentication's boot fetch and
 * other consumers (useUserProfileCached, breadcrumbs).
 */
export function useUserProfile() {
    const { isAuthenticated, userId, setUserAvatar } = useAuth();
    const queryClient = useQueryClient();

    const syncAvatar = useCallback(
        (avatarRaw: unknown) => {
            const avatar = normalizeAvatar(avatarRaw);
            setUserAvatar(avatar);
            if (avatar) {
                setStorageBatch([['userAvatar', avatar]]).catch(() => undefined);
            } else {
                removeStorageBatch(['userAvatar']).catch(() => undefined);
            }
        },
        [setUserAvatar],
    );

    const query = useQuery<UserProfileDto | null>({
        queryKey: queryKeys.userProfile(userId),
        queryFn: async () => {
            try {
                return await fetchUserProfile(userId!);
            } catch (error) {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                    return null;
                }
                throw error;
            }
        },
        enabled: isAuthenticated && !!userId,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            if (isTimeoutError(error)) return false;
            return failureCount < 2;
        },
    });

    const profile = query.data ?? null;

    // Surface fetch failures as a toast (parity with the previous imperative hook),
    // but only for genuine errors — 401/403 resolve to null, not an error.
    const lastErrorRef = useRef<unknown>(null);
    useEffect(() => {
        if (query.error && query.error !== lastErrorRef.current) {
            lastErrorRef.current = query.error;
            const message =
                query.error instanceof ApiError
                    ? query.error.message
                    : i18nT('profile:hooks.useUserProfile.ne_udalos_zagruzit_profil_27527c73');
            showToast({
                type: 'error',
                text1: i18nT('profile:hooks.useUserProfile.oshibka_c577784e'),
                text2: message,
                visibilityTime: 4000,
            });
        }
        if (!query.error) lastErrorRef.current = null;
    }, [query.error]);

    // Keep the auth-store avatar + persisted storage in sync with the fetched profile.
    useEffect(() => {
        if (profile) syncAvatar(profile.avatar);
    }, [profile, syncAvatar]);

    const setProfile = useCallback(
        (next: UserProfileDto | null) => {
            queryClient.setQueryData(queryKeys.userProfile(userId), next);
        },
        [queryClient, userId],
    );

    const loadProfile = useCallback(async () => {
        await query.refetch();
    }, [query]);

    const fullName = useMemo(() => {
        if (!profile) return '';
        return `${normalizeProfileName(profile.first_name)} ${normalizeProfileName(profile.last_name)}`.trim();
    }, [profile]);

    return {
        profile,
        setProfile,
        isLoading: query.isLoading,
        loadProfile,
        syncAvatar,
        fullName,
    };
}
