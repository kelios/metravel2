import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import { useAuthStore } from '@/stores/authStore';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelUserQueries';
import { invalidateTravelCollections } from '@/utils/travelQueryInvalidation';
import {
    requestDataExport,
    deleteUserMessages,
    deleteUserRoutes,
    revokeUserConsents,
    type DataExportDto,
} from '@/api/privacy';
import { translate as i18nT } from '@/i18n'


const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof ApiError ? error.message : fallback;

/** Сколько ждём счётчик затрагиваемых путешествий, прежде чем спросить без числа. */
const COUNT_BUDGET_MS = 2500;

/**
 * Действия пользователя над своими данными (GDPR-подобные):
 * экспорт архива, удаление переписки, удаление своих путешествий, отзыв согласий.
 * Удаление аккаунта здесь НЕ дублируется — оно уже в settings (deleteCurrentUserAccount).
 *
 * #1828: `DELETE /user/data/routes/` называется «routes», но удаляет НЕ сохранённые
 * маршруты. Сервер (`users/services/data_ownership_service.py:delete_routes`) хардом
 * стирает все Travel, где пользователь единственный автор, вместе с файлами треков, и
 * снимает авторство со всех совместных (`TravelUser.objects.filter(user=user).delete()`).
 * Поэтому копия здесь обязана называть путешествия, а не маршруты, а подтверждение —
 * идти в два шага. Очистка сохранённых маршрутов живёт отдельно, на вкладке «Избранное».
 */
export function useDataOwnership() {
    const [lastExport, setLastExport] = useState<DataExportDto | null>(null);
    // Подсчёт идёт до первого диалога, и всё это время кнопка обязана выглядеть
    // занятой: иначе нажатие на секунды остаётся без ответа, а второе нажатие
    // заводит второй цикл подтверждений.
    const [isPreparingDelete, setIsPreparingDelete] = useState(false);
    const queryClient = useQueryClient();
    const userId = useAuthStore((s) => s.userId);

    const exportMutation = useMutation({
        mutationFn: requestDataExport,
        onSuccess: (data) => {
            setLastExport(data);
            if (data.status === 'ready' && data.download_url) {
                openExternalUrl(data.download_url);
                showToast({ type: 'success', text1: i18nT('shared:hooks.useDataOwnership.arhiv_gotov_df06a08d'), text2: i18nT('shared:hooks.useDataOwnership.zagruzka_nachalas_672ebe0d') });
            } else {
                showToast({
                    type: 'success',
                    text1: i18nT('shared:hooks.useDataOwnership.zapros_prinyat_4f1da9a9'),
                    text2: i18nT('shared:hooks.useDataOwnership.arhiv_s_vashimi_dannymi_gotovitsya_my_prishl_cb30f698'),
                });
            }
        },
        onError: (error) => {
            showToast({ type: 'error', text1: i18nT('shared:hooks.useDataOwnership.oshibka_718d3c7d'), text2: errorMessage(error, i18nT('shared:hooks.useDataOwnership.ne_udalos_zaprosit_eksport_bb7e0c6c')) });
        },
    });

    const deleteMessagesMutation = useMutation({
        mutationFn: deleteUserMessages,
        onSuccess: () => showToast({ type: 'success', text1: i18nT('shared:hooks.useDataOwnership.perepiska_udalena_647250f7') }),
        onError: (error) =>
            showToast({ type: 'error', text1: i18nT('shared:hooks.useDataOwnership.oshibka_718d3c7d'), text2: errorMessage(error, i18nT('shared:hooks.useDataOwnership.ne_udalos_udalit_perepisku_f24184c9')) }),
    });

    const deleteTravelsMutation = useMutation({
        mutationFn: deleteUserRoutes,
        onSuccess: () => {
            // Удалённое не должно пережить действие в кэше: профиль, «Мои путешествия»
            // и счётчики читают те же ключи, что и сохранение путешествия.
            void invalidateTravelCollections(queryClient, userId ?? null);
            showToast({ type: 'success', text1: i18nT('shared:hooks.useDataOwnership.deleteTravelsSuccess') });
        },
        onError: (error) =>
            showToast({ type: 'error', text1: i18nT('shared:hooks.useDataOwnership.oshibka_718d3c7d'), text2: errorMessage(error, i18nT('shared:hooks.useDataOwnership.deleteTravelsError')) }),
    });

    const revokeConsentsMutation = useMutation({
        mutationFn: revokeUserConsents,
        onSuccess: () => showToast({ type: 'success', text1: i18nT('shared:hooks.useDataOwnership.soglasiya_otozvany_c280176e') }),
        onError: (error) =>
            showToast({ type: 'error', text1: i18nT('shared:hooks.useDataOwnership.oshibka_718d3c7d'), text2: errorMessage(error, i18nT('shared:hooks.useDataOwnership.ne_udalos_otozvat_soglasiya_b7ee15b9')) }),
    });

    const exportData = useCallback(() => {
        if (exportMutation.isPending) return;
        exportMutation.mutate();
    }, [exportMutation]);

    const deleteMessages = useCallback(async () => {
        const confirmed = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.udalit_perepisku_1d65d54f'),
            message: i18nT('shared:hooks.useDataOwnership.vsya_vasha_lichnaya_perepiska_budet_udalena__45ded7c4'),
            confirmText: i18nT('shared:hooks.useDataOwnership.udalit_fcfe15ec'),
        });
        if (confirmed) deleteMessagesMutation.mutate();
    }, [deleteMessagesMutation]);

    // Сколько путешествий заденет действие. Считается по тому же источнику, что и
    // счётчик «Мои путешествия» (`fetchMyTravels`), с черновиками — сервер их тоже
    // удаляет. Ошибка запроса не должна маскироваться нулём: тогда возвращается
    // `null`, и подтверждение показывает вариант без числа. Число — уточнение, а не
    // условие показа: медленная сеть не имеет права держать нажатую кнопку немой,
    // поэтому счётчик ждём не дольше `COUNT_BUDGET_MS`.
    const countAffectedTravels = useCallback(async (): Promise<number | null> => {
        if (!userId) return null;

        const counted = (async (): Promise<number | null> => {
            try {
                const payload = await fetchMyTravels({
                    user_id: userId,
                    perPage: 1,
                    includeDrafts: true,
                    throwOnError: true,
                });
                const { total } = unwrapMyTravelsPayload(payload);
                return Number.isFinite(total) ? total : null;
            } catch {
                return null;
            }
        })();

        let budget: ReturnType<typeof setTimeout> | undefined;
        const expired = new Promise<null>((resolve) => {
            budget = setTimeout(() => resolve(null), COUNT_BUDGET_MS);
        });

        try {
            return await Promise.race([counted, expired]);
        } finally {
            if (budget) clearTimeout(budget);
        }
    }, [userId]);

    const deleteTravels = useCallback(async () => {
        if (isPreparingDelete || deleteTravelsMutation.isPending) return;

        setIsPreparingDelete(true);
        let affected: number | null;
        try {
            affected = await countAffectedTravels();
        } finally {
            setIsPreparingDelete(false);
        }

        const acknowledged = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.deleteTravelsTitle'),
            message:
                affected === null
                    ? i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage')
                    : i18nT('shared:hooks.useDataOwnership.deleteTravelsMessageWithCount', { value1: affected }),
            confirmText: i18nT('shared:hooks.useDataOwnership.deleteTravelsContinue'),
        });
        if (!acknowledged) return;

        // Второй шаг обязателен: действие необратимо и уносит фотографии и треки.
        const confirmed = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.deleteTravelsFinalTitle'),
            message: i18nT('shared:hooks.useDataOwnership.deleteTravelsFinalMessage'),
            confirmText: i18nT('shared:hooks.useDataOwnership.deleteTravelsFinalConfirm'),
        });
        if (confirmed) deleteTravelsMutation.mutate();
    }, [countAffectedTravels, deleteTravelsMutation, isPreparingDelete]);

    const revokeConsents = useCallback(async () => {
        const confirmed = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.otozvat_soglasiya_7f94de65'),
            message: i18nT('shared:hooks.useDataOwnership.budut_otozvany_ranee_dannye_soglasiya_na_obr_d73e6fbd'),
            confirmText: i18nT('shared:hooks.useDataOwnership.otozvat_60af44ae'),
        });
        if (confirmed) revokeConsentsMutation.mutate();
    }, [revokeConsentsMutation]);

    return useMemo(
        () => ({
            exportData,
            deleteMessages,
            deleteTravels,
            revokeConsents,
            lastExport,
            isExporting: exportMutation.isPending,
            isDeletingMessages: deleteMessagesMutation.isPending,
            isDeletingTravels: isPreparingDelete || deleteTravelsMutation.isPending,
            isRevokingConsents: revokeConsentsMutation.isPending,
        }),
        [
            exportData,
            deleteMessages,
            deleteTravels,
            revokeConsents,
            lastExport,
            isPreparingDelete,
            exportMutation.isPending,
            deleteMessagesMutation.isPending,
            deleteTravelsMutation.isPending,
            revokeConsentsMutation.isPending,
        ]
    );
}
