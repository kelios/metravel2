import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    ScrollView,
    View,
    findNodeHandle,
    UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';

import type { TravelFormData } from '@/types/types';
import { sendMessage } from '@/api/messages';
import { devError } from '@/utils/logger';
import { hapticNotification } from '@/utils/haptics';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { trackWizardEvent } from '@/utils/analytics';
import {
    trackRouteCreateDraftFailed,
    trackRouteCreateDraftSaved,
    trackRouteCreatePublishAttempted,
    trackRouteCreatePublishBlocked,
    trackRouteCreatePublishFailed,
    trackRouteCreatePublishSucceeded,
} from '@/utils/growthFunnelAnalytics';
import { showToastMessage } from '@/utils/toast';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { translate as i18nT } from '@/i18n';

type ChecklistItem = { ok: boolean };

const resolveSavedId = (
    saved: TravelFormData | void,
    fallback: TravelFormData,
): string | null => {
    const savedId = saved && typeof saved === 'object' ? saved.id : undefined;
    return savedId ?? fallback.id ?? null;
};

type UseTravelPublishModerationArgs = {
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>> | ((data: TravelFormData) => void);
    onManualSave: (
        data?: TravelFormData,
        options?: { intent?: 'save' | 'publish' },
    ) => Promise<TravelFormData | void>;
    currentStep: number;
    isSuperAdmin: boolean;
    routePoints: unknown[];
    galleryItems: unknown[];
    checklist: ChecklistItem[];
};

export function useTravelPublishModeration({
    formData,
    setFormData,
    onManualSave,
    currentStep,
    isSuperAdmin,
    routePoints,
    galleryItems,
    checklist,
}: UseTravelPublishModerationArgs) {
    const router = useRouter();
    const actionPendingRef = useRef(false);

    const startAction = useCallback(() => {
        if (actionPendingRef.current) return false;
        actionPendingRef.current = true;
        return true;
    }, []);

    const finishAction = useCallback(() => {
        actionPendingRef.current = false;
    }, []);

    const [status, setStatus] = useState<'draft' | 'moderation'>(
        formData.moderation || formData.publish ? 'moderation' : 'draft',
    );

    // ✅ FIX: Синхронизация status с formData при изменении (например, при редактировании)
    useEffect(() => {
        const newStatus = formData.moderation || formData.publish ? 'moderation' : 'draft';
        setStatus(newStatus);
    }, [formData.moderation, formData.publish]);

    const currentBackendStatus = useMemo(() => {
        if (formData.moderation) return { label: i18nT('travel:components.travel.TravelWizardStepPublish.opublikovano_572457aa'), tone: 'success' } as const;
        if (formData.publish) return { label: i18nT('travel:components.travel.TravelWizardStepPublish.otpravleno_na_moderatsiyu_6f9b87dd'), tone: 'warning' } as const;
        return { label: i18nT('travel:components.travel.TravelWizardStepPublish.chernovik_80f263f2'), tone: 'muted' } as const;
    }, [formData.moderation, formData.publish]);

    const isUser = !isSuperAdmin;
    const pendingModeration = formData.publish && !formData.moderation;
    const userPendingModeration = isUser && pendingModeration;
    const isNew = !formData.id;

    const [missingForModeration, setMissingForModeration] = useState<ModerationIssue[]>([]);
    const [rejectionComment, setRejectionComment] = useState('');
    const [rejectConfirmVisible, setRejectConfirmVisible] = useState(false);
    const [primaryOverrideLabel, setPrimaryOverrideLabel] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const scrollRef = useRef<ScrollView | null>(null);
    const missingBannerAnchorRef = useRef<View | null>(null);
    const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const missingBannerScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (buttonErrorTimeoutRef.current) {
                clearTimeout(buttonErrorTimeoutRef.current);
                buttonErrorTimeoutRef.current = null;
            }
            if (missingBannerScrollTimerRef.current) {
                clearTimeout(missingBannerScrollTimerRef.current);
                missingBannerScrollTimerRef.current = null;
            }
        };
    }, []);

    const pulsePrimaryError = useCallback((label: string) => {
        setPrimaryOverrideLabel(label);
        if (buttonErrorTimeoutRef.current) clearTimeout(buttonErrorTimeoutRef.current);
        buttonErrorTimeoutRef.current = setTimeout(() => {
            setPrimaryOverrideLabel(null);
            buttonErrorTimeoutRef.current = null;
        }, 2500);
    }, []);

    const scrollToMissingBanner = useCallback(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const el = document.getElementById('travelwizard-publish-missing-banner');
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = missingBannerAnchorRef.current;
        if (!scrollNode || !anchorNode) return;

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) return;

        if (missingBannerScrollTimerRef.current) clearTimeout(missingBannerScrollTimerRef.current);
        missingBannerScrollTimerRef.current = setTimeout(() => {
            missingBannerScrollTimerRef.current = null;
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => undefined,
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                },
            );
        }, 50);
    }, []);

    const handleSaveDraft = async () => {
        // ✅ FIX: Предотвращаем одновременные операции
        if (!startAction()) return;
        setIsSaving(true);
        const previousForm = formData;

        try {
            const nextForm = {
                ...formData,
                publish: false,
                moderation: false,
            };
            setFormData(nextForm);
            setMissingForModeration([]);
            const saved = await onManualSave(nextForm);
            const resolvedId = resolveSavedId(saved, nextForm);

            const hasName = !!nextForm.name && nextForm.name.trim().length > 0;
            const hasDescription = !!nextForm.description && nextForm.description.trim().length > 0;
            const hasCountries = Array.isArray(nextForm.countries) && nextForm.countries.length > 0;
            const hasRoute = routePoints.length > 0;
            const galleryArr = galleryItems;
            const hasCover = !!nextForm.travel_image_thumb_small_url;
            const hasPhotos = hasCover || galleryArr.length > 0;
            const fieldsCompletedCount = [
                hasName,
                hasDescription,
                hasCountries,
                hasRoute,
                hasPhotos,
            ].filter(Boolean).length;

            await trackWizardEvent('wizard_draft_saved', {
                travel_id: resolvedId,
                step: currentStep,
                fields_filled: {
                    name: hasName,
                    description: hasDescription,
                    countries: hasCountries,
                    markers: hasRoute,
                    photos: hasPhotos,
                },
            });

            trackRouteCreateDraftSaved({
                travelId: resolvedId,
                step: currentStep,
                fieldsCompletedCount,
                hasName,
                hasDescription,
                hasCountries,
                hasRoute,
                hasPhotos,
            });

            hapticNotification('success');

            // После сохранения на последнем шаге логично вывести пользователя из мастера
            // в раздел "Мои путешествия", где он увидит черновик.
            router.replace('/metravel');
        } catch (error) {
            trackRouteCreateDraftFailed({
                travelId: formData.id,
                step: currentStep,
                errorType: 'save_failed',
            });
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.oshibka_sohraneniya_02c1b824'),
                    text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.poprobuyte_esche_raz_7abf248f'),
                });
            }
        } finally {
            setIsSaving(false);
            finishAction();
        }
    };

    const handleSendToModeration = async () => {
        if (!startAction()) return;
        const criticalMissing = getModerationIssues({
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
            categories: formData.categories ?? [],
            coordsMeTravel: routePoints,
            gallery: galleryItems,
            travel_image_thumb_small_url: formData.travel_image_thumb_small_url ?? null,
        });
        const missingLabels = criticalMissing.map(i => i.label);

        await trackWizardEvent('wizard_moderation_attempt', {
            missing_fields: missingLabels,
            is_new: isNew,
            is_edit: !isNew,
            travel_id: formData.id ?? null,
        });
        trackRouteCreatePublishAttempted({
            travelId: formData.id,
            step: currentStep,
            isNew,
            missingFieldsCount: criticalMissing.length,
        });

        if (criticalMissing.length > 0) {
            trackRouteCreatePublishBlocked({
                travelId: formData.id,
                step: currentStep,
                missingFieldsCount: criticalMissing.length,
                firstMissingField: criticalMissing[0]?.key,
            });
            setMissingForModeration(criticalMissing);
            hapticNotification('warning');
            pulsePrimaryError(i18nT('travel:components.travel.TravelWizardStepPublish.nelzya_otpravit_ispravte_oshibki_eb8fb6a9'));
            scrollToMissingBanner();
            finishAction();
            return;
        }

        setMissingForModeration([]);
        setIsSaving(true);
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: false,
            publish: true, // пользователь отправляет на модерацию: publish=true, moderation остаётся false до решения админа
        };
        setFormData(nextForm);

        // Сохраняем статус на бэкенд (отсюда триггерятся уведомления)
        try {
            const saved = await onManualSave(nextForm, { intent: 'publish' });
            const resolvedId = resolveSavedId(saved, nextForm);
            if (!resolvedId) {
                // Сохранение не дало id — откатываем оптимистичный publish=true,
                // иначе UI покажет «на модерации», хотя ничего не отправлено.
                trackRouteCreatePublishFailed({
                    travelId: formData.id,
                    step: currentStep,
                    errorType: 'missing_saved_id',
                });
                setFormData(previousForm);
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otpravit_46d67527'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.sohranenie_ne_udalos_proverte_internet_i_pop_ab095dd2'),
                });
                setIsSaving(false);
                return;
            }

            await trackWizardEvent('wizard_moderation_success', {
                travel_id: resolvedId,
                filled_checklist_count: checklist.filter(item => item.ok).length,
                total_checklist_count: checklist.length,
            });
            trackRouteCreatePublishSucceeded({
                travelId: resolvedId,
                step: currentStep,
                checklistCompletedCount: checklist.filter(item => item.ok).length,
                checklistTotalCount: checklist.length,
            });

            void showToastMessage({
                type: 'success',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.marshrut_otpravlen_na_moderatsiyu_0d19b6a4'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.posle_odobreniya_on_poyavitsya_v_razdele_moi_03ac6085'),
            });

            hapticNotification('success');

            // Навигация без повторного сохранения (чтобы не перезаписать publish=false старым стейтом)
            // Используем replace, чтобы мастер точно размонтировался и не продолжал автосохранение.
            router.replace('/metravel');
        } catch (error) {
            trackRouteCreatePublishFailed({
                travelId: formData.id,
                step: currentStep,
                errorType: 'save_failed',
            });
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otpravit_46d67527'),
                    text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_i_poprobuyte_esche_raz_415d3732'),
                });
            }
        } finally {
            finishAction();
        }
    };

    const handleApproveModeration = async () => {
        if (!startAction()) return;
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: true,
            publish: true,
        };
        setFormData(nextForm);

        try {
            const saved = await onManualSave(nextForm, { intent: 'publish' });
            const resolvedId = resolveSavedId(saved, nextForm);
            if (!resolvedId) {
                // Откатываем оптимистичный moderation/publish=true при неуспешном сохранении.
                setFormData(previousForm);
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_sohranit_4605a31e'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_soedinenie_i_poprobuyte_es_8be75220'),
                });
                return;
            }

            await trackWizardEvent('admin_moderation_approved', {
                travel_id: resolvedId,
            });

            void showToastMessage({
                type: 'success',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.moderatsiya_odobrena_b8eb059d'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.marshrut_opublikovan_i_dostupen_vsem_polzova_bccaf03e'),
            });

            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_sohranit_4605a31e'),
                    text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_soedinenie_i_poprobuyte_es_8be75220'),
                });
            }
        } finally {
            finishAction();
        }
    };

    const handleRejectModeration = async () => {
        if (!startAction()) return;
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: false,
            publish: false,
        };
        setFormData(nextForm);

        try {
            const saved = await onManualSave(nextForm);
            const resolvedId = resolveSavedId(saved, nextForm);
            if (!resolvedId) {
                // Откатываем оптимистичный moderation/publish=false при неуспешном сохранении.
                setFormData(previousForm);
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_sohranit_4605a31e'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_soedinenie_i_poprobuyte_es_8be75220'),
                });
                return;
            }

            // Send rejection comment as a message to the travel author
            const authorRecord = formData as unknown as {
                user?: { id?: unknown };
                userId?: unknown;
                user_id?: unknown;
            };
            const authorId =
                authorRecord.user?.id ??
                authorRecord.userId ??
                authorRecord.user_id ??
                null;
            const commentText = rejectionComment.trim();
            if (authorId && commentText) {
                try {
                    const travelName = formData.name || i18nT('travel:common.untitled');
                    const messageText = i18nT('travel:components.travel.TravelWizardStepPublish.moderatsiya_otklonena_dlya_value1_value2_a111c39e', { value1: travelName, value2: commentText });
                    await sendMessage({
                        participants: [Number(authorId)],
                        text: messageText,
                    });
                } catch (msgError) {
                    devError('Failed to send rejection message:', msgError);
                }
            }

            await trackWizardEvent('admin_moderation_rejected', {
                travel_id: resolvedId,
                has_comment: !!commentText,
            });

            void showToastMessage({
                type: 'info',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.moderatsiya_otklonena_ac183762'),
                text2: commentText
                    ? i18nT('travel:components.travel.TravelWizardStepPublish.marshrut_vozvraschen_v_chernoviki_kommentari_9adead67')
                    : i18nT('travel:components.travel.TravelWizardStepPublish.marshrut_vozvraschen_v_chernoviki_d5241a14'),
            });

            setRejectionComment('');
            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_sohranit_4605a31e'),
                    text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_soedinenie_i_poprobuyte_es_8be75220'),
                });
            }
        } finally {
            finishAction();
        }
    };

    const handlePrimaryAction = () => {
        if (userPendingModeration) return;
        if (status === 'draft') {
            void handleSaveDraft();
        } else {
            void handleSendToModeration();
        }
    };

    return {
        status,
        setStatus,
        currentBackendStatus,
        pendingModeration,
        userPendingModeration,
        missingForModeration,
        rejectionComment,
        setRejectionComment,
        rejectConfirmVisible,
        setRejectConfirmVisible,
        primaryOverrideLabel,
        isSaving,
        scrollRef,
        missingBannerAnchorRef,
        handlePrimaryAction,
        handleApproveModeration,
        handleRejectModeration,
    };
}
