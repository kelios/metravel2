import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import { showToast } from '@/utils/toast';
import {
    fetchPrivacySettings,
    updatePrivacySettings,
    PRIVACY_SETTINGS_DEFAULTS,
    type PrivacyContentType,
    type PrivacyAudience,
    type PrivacySettingsDto,
} from '@/api/privacy';
import { translate as i18nT } from '@/i18n'


/**
 * Управление настройками приватности (видимость × аудитории).
 * Read с graceful-degradation (дефолты, пока BE-privacy-settings не готов),
 * update с оптимистичным апдейтом и откатом при ошибке.
 */
export function usePrivacySettings() {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = queryKeys.privacySettings();

    const settingsQuery = useQuery<PrivacySettingsDto>({
        queryKey,
        queryFn: fetchPrivacySettings,
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            if (isTimeoutError(error)) return false;
            return failureCount < 2;
        },
    });

    const updateMutation = useMutation({
        mutationFn: (payload: Partial<PrivacySettingsDto>) => updatePrivacySettings(payload),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<PrivacySettingsDto>(queryKey);
            const base = previous ?? PRIVACY_SETTINGS_DEFAULTS;
            queryClient.setQueryData<PrivacySettingsDto>(queryKey, { ...base, ...payload });
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKey, context.previous);
            }
            showToast({
                type: 'error',
                text1: i18nT('profile:hooks.usePrivacySettings.oshibka_572c75e2'),
                text2: i18nT('profile:hooks.usePrivacySettings.ne_udalos_sohranit_nastroyki_privatnosti_pop_6adb578d'),
            });
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKey, data);
        },
    });

    const settings = settingsQuery.data ?? PRIVACY_SETTINGS_DEFAULTS;

    const setAudience = useCallback(
        (contentType: PrivacyContentType, audience: PrivacyAudience) => {
            if (settings[contentType] === audience) return;
            updateMutation.mutate({ [contentType]: audience });
        },
        [settings, updateMutation]
    );

    return useMemo(
        () => ({
            settings,
            isLoading: settingsQuery.isLoading,
            isError: settingsQuery.isError && !(settingsQuery.error instanceof ApiError && settingsQuery.error.status === 404),
            isSaving: updateMutation.isPending,
            setAudience,
            refetch: settingsQuery.refetch,
        }),
        [settings, settingsQuery.isLoading, settingsQuery.isError, settingsQuery.error, settingsQuery.refetch, updateMutation.isPending, setAudience]
    );
}
