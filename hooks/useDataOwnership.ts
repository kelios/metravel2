import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import {
    requestDataExport,
    deleteUserMessages,
    deleteUserRoutes,
    revokeUserConsents,
    type DataExportDto,
} from '@/api/privacy';

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof ApiError ? error.message : fallback;

/**
 * Действия пользователя над своими данными (GDPR-подобные):
 * экспорт архива, удаление переписки/маршрутов, отзыв согласий.
 * Удаление аккаунта здесь НЕ дублируется — оно уже в settings (deleteCurrentUserAccount).
 */
export function useDataOwnership() {
    const [lastExport, setLastExport] = useState<DataExportDto | null>(null);

    const exportMutation = useMutation({
        mutationFn: requestDataExport,
        onSuccess: (data) => {
            setLastExport(data);
            if (data.status === 'ready' && data.download_url) {
                openExternalUrl(data.download_url);
                showToast({ type: 'success', text1: 'Архив готов', text2: 'Загрузка началась' });
            } else {
                showToast({
                    type: 'success',
                    text1: 'Запрос принят',
                    text2: 'Архив с вашими данными готовится. Мы пришлём ссылку.',
                });
            }
        },
        onError: (error) => {
            showToast({ type: 'error', text1: 'Ошибка', text2: errorMessage(error, 'Не удалось запросить экспорт') });
        },
    });

    const deleteMessagesMutation = useMutation({
        mutationFn: deleteUserMessages,
        onSuccess: () => showToast({ type: 'success', text1: 'Переписка удалена' }),
        onError: (error) =>
            showToast({ type: 'error', text1: 'Ошибка', text2: errorMessage(error, 'Не удалось удалить переписку') }),
    });

    const deleteRoutesMutation = useMutation({
        mutationFn: deleteUserRoutes,
        onSuccess: () => showToast({ type: 'success', text1: 'Маршруты удалены' }),
        onError: (error) =>
            showToast({ type: 'error', text1: 'Ошибка', text2: errorMessage(error, 'Не удалось удалить маршруты') }),
    });

    const revokeConsentsMutation = useMutation({
        mutationFn: revokeUserConsents,
        onSuccess: () => showToast({ type: 'success', text1: 'Согласия отозваны' }),
        onError: (error) =>
            showToast({ type: 'error', text1: 'Ошибка', text2: errorMessage(error, 'Не удалось отозвать согласия') }),
    });

    const exportData = useCallback(() => {
        if (exportMutation.isPending) return;
        exportMutation.mutate();
    }, [exportMutation]);

    const deleteMessages = useCallback(async () => {
        const confirmed = await confirmAction({
            title: 'Удалить переписку',
            message: 'Вся ваша личная переписка будет удалена без возможности восстановления. Продолжить?',
            confirmText: 'Удалить',
        });
        if (confirmed) deleteMessagesMutation.mutate();
    }, [deleteMessagesMutation]);

    const deleteRoutes = useCallback(async () => {
        const confirmed = await confirmAction({
            title: 'Удалить маршруты',
            message: 'Ваши сохранённые маршруты будут удалены без возможности восстановления. Продолжить?',
            confirmText: 'Удалить',
        });
        if (confirmed) deleteRoutesMutation.mutate();
    }, [deleteRoutesMutation]);

    const revokeConsents = useCallback(async () => {
        const confirmed = await confirmAction({
            title: 'Отозвать согласия',
            message: 'Будут отозваны ранее данные согласия на обработку данных. Продолжить?',
            confirmText: 'Отозвать',
        });
        if (confirmed) revokeConsentsMutation.mutate();
    }, [revokeConsentsMutation]);

    return useMemo(
        () => ({
            exportData,
            deleteMessages,
            deleteRoutes,
            revokeConsents,
            lastExport,
            isExporting: exportMutation.isPending,
            isDeletingMessages: deleteMessagesMutation.isPending,
            isDeletingRoutes: deleteRoutesMutation.isPending,
            isRevokingConsents: revokeConsentsMutation.isPending,
        }),
        [
            exportData,
            deleteMessages,
            deleteRoutes,
            revokeConsents,
            lastExport,
            exportMutation.isPending,
            deleteMessagesMutation.isPending,
            deleteRoutesMutation.isPending,
            revokeConsentsMutation.isPending,
        ]
    );
}
