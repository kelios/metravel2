import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import { useAuthStore } from '@/stores/authStore';
import { invalidateTravelCollections } from '@/utils/travelQueryInvalidation';
import {
    requestDataExport,
    deleteUserMessages,
    deleteAuthoredContent,
    fetchAuthoredContentSummary,
    revokeUserConsents,
    type AuthoredContentSummaryDto,
    type DataExportDto,
} from '@/api/privacy';
import { formatInteger, selectPlural, translate as i18nT } from '@/i18n'


const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof ApiError ? error.message : fallback;

/** Сколько ждём счётчик затрагиваемых путешествий, прежде чем спросить без числа. */
const COUNT_BUDGET_MS = 2500;

const isCountable = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Две фразы подтверждения: сколько путешествий исчезнет и с какого числа совместных
 * снимется авторство. Нулевую половину фраза не упоминает — «удалить 0 путешествий»
 * читается как ошибка, а не как факт; когда нулевые обе, чисел нет вовсе и
 * подтверждение возвращается к копии без них.
 */
const describeAffectedContent = (summary: AuthoredContentSummaryDto): string | null => {
    const phrases: string[] = [];

    if (summary.travels_to_delete > 0) {
        const value1 = formatInteger(summary.travels_to_delete);
        const many = i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedOwnedMany', { value1 });
        phrases.push(
            selectPlural(summary.travels_to_delete, {
                one: i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedOwnedOne', { value1 }),
                few: i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedOwnedFew', { value1 }),
                many,
                other: many,
            })
        );
    }

    if (summary.co_authored_to_detach > 0) {
        const value1 = formatInteger(summary.co_authored_to_detach);
        const many = i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedSharedMany', { value1 });
        phrases.push(
            selectPlural(summary.co_authored_to_detach, {
                one: i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedSharedOne', { value1 }),
                few: i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedSharedFew', { value1 }),
                many,
                other: many,
            })
        );
    }

    return phrases.length > 0 ? phrases.join(' ') : null;
};

/**
 * Действия пользователя над своими данными (GDPR-подобные):
 * экспорт архива, удаление переписки, удаление своих путешествий, отзыв согласий.
 * Удаление аккаунта здесь НЕ дублируется — оно уже в settings (deleteCurrentUserAccount).
 *
 * `DELETE /user/data/authored-content/` хардом стирает все Travel, где пользователь
 * единственный автор, вместе с фотографиями и файлами треков, и снимает его авторство
 * со всех совместных (`users/services/data_ownership_service.py:delete_authored_content`).
 * Поэтому копия здесь называет путешествия, а не маршруты, а подтверждение идёт в два
 * шага. Очистка сохранённых маршрутов живёт отдельно, на экране «Хочу поехать».
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
        mutationFn: deleteAuthoredContent,
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

    // Что именно снесёт действие. Общий счётчик «Мои путешествия» сюда не годится:
    // он складывает личные и совместные, а удаляются только первые — со вторых
    // снимается авторство. Разделение знает один сервер, поэтому числа берутся из
    // `GET /user/data/authored-content/`. Ошибка запроса не должна маскироваться
    // нулём: тогда возвращается `null`, и подтверждение показывает вариант без
    // чисел. Числа — уточнение, а не условие показа: медленная сеть не имеет права
    // держать нажатую кнопку немой, поэтому счётчик ждём не дольше `COUNT_BUDGET_MS`.
    const countAffectedTravels = useCallback(async (): Promise<AuthoredContentSummaryDto | null> => {
        if (!userId) return null;

        const counted = (async (): Promise<AuthoredContentSummaryDto | null> => {
            try {
                const summary = await fetchAuthoredContentSummary();
                return isCountable(summary?.travels_to_delete) && isCountable(summary?.co_authored_to_detach)
                    ? summary
                    : null;
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
        let affected: AuthoredContentSummaryDto | null;
        try {
            affected = await countAffectedTravels();
        } finally {
            setIsPreparingDelete(false);
        }

        const counted = affected === null ? null : describeAffectedContent(affected);
        const acknowledged = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.deleteTravelsTitle'),
            message:
                counted === null
                    ? i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage')
                    : i18nT('shared:hooks.useDataOwnership.deleteTravelsMessageCounted', { value1: counted }),
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
