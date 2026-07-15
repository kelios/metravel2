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
import { translate as i18nT } from '@/i18n'


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

    const deleteRoutesMutation = useMutation({
        mutationFn: deleteUserRoutes,
        onSuccess: () => showToast({ type: 'success', text1: i18nT('shared:hooks.useDataOwnership.marshruty_udaleny_69c5c668') }),
        onError: (error) =>
            showToast({ type: 'error', text1: i18nT('shared:hooks.useDataOwnership.oshibka_718d3c7d'), text2: errorMessage(error, i18nT('shared:hooks.useDataOwnership.ne_udalos_udalit_marshruty_c4218ef8')) }),
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

    const deleteRoutes = useCallback(async () => {
        const confirmed = await confirmAction({
            title: i18nT('shared:hooks.useDataOwnership.udalit_marshruty_e479bd12'),
            message: i18nT('shared:hooks.useDataOwnership.vashi_sohranennye_marshruty_budut_udaleny_be_5de38c28'),
            confirmText: i18nT('shared:hooks.useDataOwnership.udalit_fcfe15ec'),
        });
        if (confirmed) deleteRoutesMutation.mutate();
    }, [deleteRoutesMutation]);

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
