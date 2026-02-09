import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    fetchUserProfile,
    normalizeAvatar,
    type UserProfileDto,
} from '@/api/user';
import { ApiError } from '@/api/client';
import { setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { showToast } from '@/utils/toast';

/**
 * Shared hook for loading and managing user profile state.
 * Used by both profile.tsx and settings.tsx to avoid duplicated logic.
 */
export function useUserProfile() {
    const { isAuthenticated, userId, setUserAvatar } = useAuth();

    const [profile, setProfile] = useState<UserProfileDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);

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

    const loadProfile = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const data = await fetchUserProfile(userId);
            setProfile(data);
            syncAvatar(data.avatar);
        } catch (error) {
            const message =
                error instanceof ApiError
                    ? error.message
                    : 'Не удалось загрузить профиль';
            showToast({
                type: 'error',
                text1: 'Ошибка',
                text2: message,
                visibilityTime: 4000,
            });
        } finally {
            setIsLoading(false);
        }
    }, [syncAvatar, userId]);

    useEffect(() => {
        if (isAuthenticated && userId) {
            loadProfile();
        }
    }, [isAuthenticated, userId, loadProfile]);

    const fullName = useMemo(() => {
        if (!profile) return '';
        return `${normalizeAvatar(profile.first_name) ?? ''} ${normalizeAvatar(profile.last_name) ?? ''}`.trim();
    }, [profile]);

    return {
        profile,
        setProfile,
        isLoading,
        loadProfile,
        syncAvatar,
        fullName,
    };
}
