import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
    KeyboardAvoidingView,
    AppState,
    Platform,
    ScrollView,
    Text,
    View,
    findNodeHandle,
    UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
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
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { showToastMessage } from '@/utils/toast';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist';
import PublishChecklistCard from '@/components/travel/PublishChecklistCard';
import InstagramPublishPanel from '@/components/travel/InstagramPublishPanel';
import FacebookPublishPanel, {
    type FacebookPublishUiState,
} from '@/components/travel/FacebookPublishPanel';
import PublishModerationAdminPanel from '@/components/travel/PublishModerationAdminPanel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PublishStatusSummaryPanel from '@/components/travel/PublishStatusSummaryPanel';
import { useInstagramPublishDraft } from '@/components/travel/useInstagramPublishDraft';
import {
    INSTAGRAM_CAPTION_MAX_LENGTH,
    INSTAGRAM_HASHTAG_MAX_COUNT,
    parseInstagramHashtags,
    getInstagramAccountOptions,
} from '@/utils/instagramPublish';
import { openExternalUrl } from '@/utils/externalLinks';
import { publishTravelToInstagram, fetchInstagramOAuthStartUrl } from '@/api/instagramPublish';
import {
    fetchFacebookOAuthStartUrl,
    fetchFacebookPublishStatus,
    publishTravelToFacebook,
    type FacebookPublishCapability,
} from '@/api/facebookPublish';
import { ApiError } from '@/api/client';
import { createStyles } from '@/components/travel/travelWizardStepPublish.styles';
import type { TravelWizardStepPublishProps } from '@/components/travel/TravelWizardStepPublish.types';
import { translate as i18nT } from '@/i18n'

const TravelWizardStepPublish: React.FC<TravelWizardStepPublishProps> = ({
    currentStep,
    totalSteps,
    formData,
    countries = [],
    setFormData,
    isSuperAdmin,
    onManualSave,
    onGoBack,
    onFinish: _onFinish,
    onNavigateToIssue,
    onStepSelect,
    stepMeta,
    autosaveBadge,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const actionPendingRef = useRef(false);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

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

    const {
        routePoints,
        galleryItems,
        requiredChecklist,
        recommendedChecklist,
        checklist,
        moderationIssuesByKey,
        qualityScore,
    } = useTravelPublishChecklist(formData);
    const missingRequiredCount = useMemo(
        () => requiredChecklist.filter((item) => !item.ok).length,
        [requiredChecklist],
    );

    const [missingForModeration, setMissingForModeration] = useState<ModerationIssue[]>([]);
    const [rejectionComment, setRejectionComment] = useState('');
    const [rejectConfirmVisible, setRejectConfirmVisible] = useState(false);
    const isNew = !formData.id;

    const scrollRef = useRef<ScrollView | null>(null);
    const missingBannerAnchorRef = useRef<View | null>(null);
    const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const missingBannerScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const instagramPublishingRef = useRef(false);
    const [isPublishingInstagram, setIsPublishingInstagram] = useState(false);
    const instagramConnectingRef = useRef(false);
    const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
    const facebookActionRef = useRef(false);
    const facebookMessageEditedRef = useRef(false);
    const facebookCapabilityMountedRef = useRef(true);
    const [facebookCapability, setFacebookCapability] = useState<FacebookPublishCapability | null>(null);
    const [facebookMessage, setFacebookMessage] = useState('');
    const [facebookState, setFacebookState] = useState<FacebookPublishUiState>('idle');
    const [facebookPostUrl, setFacebookPostUrl] = useState<string | undefined>();
    const [primaryOverrideLabel, setPrimaryOverrideLabel] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const instagramAccountKey = useMemo(
        () =>
            getInstagramAccountOptions(process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS)[0]?.key ||
            'metravelby',
        [],
    );

    const {
        editableInstagramCaption,
        editableInstagramHashtags,
        editableInstagramImages,
        draggedInstagramImageIndex,
        finalInstagramText,
        instagramCaptionLength,
        instagramHashtagCount,
        instagramFinalLength,
        isInstagramCaptionTooLong,
        isInstagramHashtagCountTooHigh,
        handleMoveInstagramImage,
        handleRemoveInstagramImage,
        handleInstagramDragStart,
        handleInstagramDrop,
        handleInstagramDragEnd,
        handleInstagramCaptionChange,
        handleInstagramHashtagsChange,
    } = useInstagramPublishDraft({ formData, countries });

    useEffect(() => {
        if (!facebookMessageEditedRef.current && editableInstagramCaption.trim()) {
            setFacebookMessage(editableInstagramCaption.trim());
        }
    }, [editableInstagramCaption]);

    const refreshFacebookCapability = useCallback(async () => {
        try {
            const capability = await fetchFacebookPublishStatus();
            if (!facebookCapabilityMountedRef.current) return;
            setFacebookCapability(capability);
            setFacebookState(capability.connected ? 'idle' : 'not_connected');
        } catch (error) {
            // A missing/forbidden capability must not expose a dead action.
            devError('Facebook publish capability unavailable:', error);
            if (facebookCapabilityMountedRef.current) setFacebookCapability(null);
        }
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) return;
        facebookCapabilityMountedRef.current = true;
        void refreshFacebookCapability();
        const subscription = Platform.OS === 'web'
            ? null
            : AppState.addEventListener('change', (nextState) => {
                if (facebookCapabilityMountedRef.current && nextState === 'active') {
                    void refreshFacebookCapability();
                }
            });
        return () => {
            facebookCapabilityMountedRef.current = false;
            subscription?.remove();
        };
    }, [isSuperAdmin, refreshFacebookCapability]);

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
            if (el && typeof (el as any).scrollIntoView === 'function') {
                (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;

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
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
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
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
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
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
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
            const authorId =
                (formData as any)?.user?.id ??
                (formData as any)?.userId ??
                (formData as any)?.user_id ??
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

    const handleCopyInstagramText = useCallback(async () => {
        const finalText = finalInstagramText;
        if (!finalText) return;
        await Clipboard.setStringAsync(finalText);
        void showToastMessage({
            type: 'success',
            text1: i18nT('travel:components.travel.TravelWizardStepPublish.tekst_dlya_instagram_skopirovan_d5e8c582'),
        });
    }, [finalInstagramText]);

    // Подключение аккаунта: бэк сам отдаёт authUrl с корректным redirect и подписанным
    // state (фронт НЕ строит OAuth-URL сам — старый /auth/instagram/callback не существует).
    const handleConnectInstagram = useCallback(async () => {
        if (instagramConnectingRef.current) return;
        instagramConnectingRef.current = true;
        setIsConnectingInstagram(true);
        try {
            const returnTo =
                Platform.OS === 'web' && typeof window !== 'undefined'
                    ? window.location?.href
                    : undefined;
            const authUrl = await fetchInstagramOAuthStartUrl(returnTo);
            if (!authUrl) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.instagram_ne_nastroen_na_servere_080724da'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.nuzhny_klyuchi_meta_na_bekende_zadacha_be_06_3ef88e17'),
                });
                return;
            }
            const opened = await openExternalUrl(authUrl);
            if (!opened) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otkryt_meta_oauth_3c11f44b'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.proverte_blokirovku_vsplyvayuschih_okon_i_po_e1079518'),
                });
            }
        } catch (error) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_nachat_podklyuchenie_instagram_409edc30'),
                text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.povtorite_popytku_pozzhe_fa7a4481'),
            });
        } finally {
            instagramConnectingRef.current = false;
            setIsConnectingInstagram(false);
        }
    }, []);

    const handlePublishToInstagram = useCallback(async () => {
        // Защита от двойного клика.
        if (instagramPublishingRef.current) return;

        const travelId = Number(formData.id);
        if (!Number.isFinite(travelId) || travelId <= 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.snachala_sohranite_puteshestvie_f91c1dce'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.publikatsiya_v_instagram_dostupna_posle_sohr_4e51d7a0'),
            });
            return;
        }

        const imageUrls = editableInstagramImages.filter(Boolean);
        if (imageUrls.length === 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.net_foto_dlya_publikatsii_26980134'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.dobavte_hotya_by_odno_foto_v_galereyu_ee5be50f'),
            });
            return;
        }

        instagramPublishingRef.current = true;
        setIsPublishingInstagram(true);
        try {
            const result = await publishTravelToInstagram({
                travelId,
                accountKey: instagramAccountKey,
                caption: editableInstagramCaption.trim(),
                hashtags: parseInstagramHashtags(editableInstagramHashtags),
                imageUrls,
            });
            void showToastMessage({
                type: 'success',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.opublikovano_v_instagram_0edea0fd'),
                text2: result?.postUrl || undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const notConnected = new RegExp(
                i18nT('travel:components.travel.TravelWizardStepPublish.instagramNotConnectedPattern'),
                'i',
            ).test(message);
            void showToastMessage({
                type: 'error',
                text1: notConnected ? i18nT('travel:components.travel.TravelWizardStepPublish.akkaunt_instagram_ne_podklyuchen_a04bf7ce') : i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_opublikovat_3fbabd22'),
                text2: notConnected
                    ? i18nT('travel:components.travel.TravelWizardStepPublish.nazhmite_podklyuchit_instagram_zatem_povtori_6c7379a0')
                    : message,
            });
        } finally {
            instagramPublishingRef.current = false;
            setIsPublishingInstagram(false);
        }
    }, [
        formData.id,
        editableInstagramImages,
        editableInstagramCaption,
        editableInstagramHashtags,
        instagramAccountKey,
    ]);

    const handleFacebookMessageChange = useCallback((value: string) => {
        facebookMessageEditedRef.current = true;
        setFacebookMessage(value);
    }, []);

    const handleConnectFacebook = useCallback(async () => {
        if (facebookActionRef.current || !facebookCapability?.configured) return;
        facebookActionRef.current = true;
        setFacebookState('connecting');
        try {
            const returnTo =
                Platform.OS === 'web' && typeof window !== 'undefined'
                    ? window.location?.href
                    : undefined;
            const authUrl = await fetchFacebookOAuthStartUrl(returnTo);
            if (!authUrl || !(await openExternalUrl(authUrl))) {
                throw new Error(i18nT('travel:components.travel.FacebookPublishPanel.oauthOpenError'));
            }
        } catch (error) {
            setFacebookState('error');
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.connectError'),
                text2: error instanceof Error ? error.message : undefined,
            });
        } finally {
            facebookActionRef.current = false;
            setFacebookState(facebookCapability.connected ? 'idle' : 'not_connected');
        }
    }, [facebookCapability]);

    const handlePublishToFacebook = useCallback(async () => {
        if (facebookActionRef.current) return;
        const travelId = Number(formData.id);
        if (!Number.isFinite(travelId) || travelId <= 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.saveFirst'),
            });
            return;
        }
        if (!facebookCapability?.connected || !facebookCapability.canPublish) {
            setFacebookState('not_connected');
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.notConnectedError'),
            });
            return;
        }
        const message = facebookMessage.trim();
        if (!message) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.messageRequired'),
            });
            return;
        }

        facebookActionRef.current = true;
        setFacebookState('publishing');
        try {
            const result = await publishTravelToFacebook(travelId, message);
            const nextState = result.status === 'already_published' || result.duplicate
                ? 'already_published'
                : 'published';
            setFacebookState(nextState);
            setFacebookPostUrl(result.postUrl || undefined);
            void showToastMessage({
                type: 'success',
                text1: i18nT(
                    nextState === 'already_published'
                        ? 'travel:components.travel.FacebookPublishPanel.alreadyPublishedToast'
                        : 'travel:components.travel.FacebookPublishPanel.publishedToast',
                ),
            });
        } catch (error) {
            const notConnected = error instanceof ApiError && error.status === 409;
            setFacebookState(notConnected ? 'not_connected' : 'error');
            if (notConnected) {
                setFacebookCapability((current) => current ? { ...current, connected: false, canPublish: false } : current);
            }
            void showToastMessage({
                type: 'error',
                text1: i18nT(
                    notConnected
                        ? 'travel:components.travel.FacebookPublishPanel.notConnectedError'
                        : 'travel:components.travel.FacebookPublishPanel.publishError',
                ),
                text2: error instanceof Error ? error.message : undefined,
            });
        } finally {
            facebookActionRef.current = false;
        }
    }, [facebookCapability, facebookMessage, formData.id]);

    const handleOpenFacebookPost = useCallback(async () => {
        if (facebookPostUrl) await openExternalUrl(facebookPostUrl);
    }, [facebookPostUrl]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onGoBack}
                    title={stepMeta?.title ?? i18nT('travel:components.travel.TravelWizardStepPublish.defaultTitle')}
                    subtitle={stepMeta?.subtitle ?? i18nT('travel:components.travel.TravelWizardStepPublish.defaultSubtitle')}
                    progressPercent={qualityScore.score}
                    errorCount={missingRequiredCount}
                    autosaveBadge={autosaveBadge}
                    onPrimary={handlePrimaryAction}
                    primaryLabel={
                        isSaving
                            ? i18nT('travel:components.travel.TravelWizardStepPublish.sohranenie_6ac62247')
                            : primaryOverrideLabel ??
                              (pendingModeration
                                  ? i18nT('travel:components.travel.TravelWizardStepPublish.otpravleno_na_moderatsiyu_6f9b87dd')
                                  : status === 'draft'
                                  ? i18nT('travel:components.travel.TravelWizardStepPublish.sohranit_chernovik_7d6023b4')
                                  : i18nT('travel:components.travel.TravelWizardStepPublish.otpravit_na_moderatsiyu_55154a94'))
                    }
                    primaryTestID="primary-button"
                    primaryDisabled={pendingModeration || isSaving}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                    extraBelowProgress={
                        <View style={styles.readinessNote}>
                            <Text style={styles.readinessNoteText}>
                                {i18nT('travel:components.travel.TravelWizardStepPublish.vy_na_poslednem_shage_mastera_indikator_poka_df37fcf6')}{qualityScore.score}%.
                            </Text>
                        </View>
                    }
                />
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: DESIGN_TOKENS.spacing.xl }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                    <PublishStatusSummaryPanel
                        colors={colors}
                        styles={styles}
                        currentBackendStatus={currentBackendStatus}
                        pendingModeration={pendingModeration}
                        userPendingModeration={userPendingModeration}
                        status={status}
                        missingForModeration={missingForModeration}
                        qualityScore={qualityScore}
                        onStatusChange={setStatus}
                        onNavigateToIssue={onNavigateToIssue}
                        missingBannerAnchor={missingBannerAnchorRef}
                    />

                    <PublishChecklistCard
                        colors={colors}
                        styles={styles}
                        checklist={checklist}
                        requiredChecklist={requiredChecklist}
                        recommendedChecklist={recommendedChecklist}
                        moderationIssuesByKey={moderationIssuesByKey}
                        onNavigateToIssue={onNavigateToIssue}
                    />

                    {isSuperAdmin && (pendingModeration || formData.moderation || status === 'moderation') && (
                        <PublishModerationAdminPanel
                            colors={colors}
                            styles={styles}
                            rejectionComment={rejectionComment}
                            onRejectionCommentChange={setRejectionComment}
                            onApprove={() => void handleApproveModeration()}
                            onReject={() => setRejectConfirmVisible(true)}
                        />
                    )}

                    {isSuperAdmin && (
                        <InstagramPublishPanel
                            colors={colors}
                            styles={styles}
                            editableInstagramCaption={editableInstagramCaption}
                            editableInstagramHashtags={editableInstagramHashtags}
                            editableInstagramImages={editableInstagramImages}
                            draggedInstagramImageIndex={draggedInstagramImageIndex}
                            instagramCaptionLength={instagramCaptionLength}
                            instagramHashtagCount={instagramHashtagCount}
                            instagramFinalLength={instagramFinalLength}
                            isInstagramCaptionTooLong={isInstagramCaptionTooLong}
                            isInstagramHashtagCountTooHigh={isInstagramHashtagCountTooHigh}
                            instagramCaptionMaxLength={INSTAGRAM_CAPTION_MAX_LENGTH}
                            instagramHashtagMaxCount={INSTAGRAM_HASHTAG_MAX_COUNT}
                            finalInstagramText={finalInstagramText}
                            onCaptionChange={handleInstagramCaptionChange}
                            onHashtagsChange={handleInstagramHashtagsChange}
                            onMoveImage={handleMoveInstagramImage}
                            onRemoveImage={handleRemoveInstagramImage}
                            onDragStart={handleInstagramDragStart}
                            onDrop={handleInstagramDrop}
                            onDragEnd={handleInstagramDragEnd}
                            onCopyText={() => void handleCopyInstagramText()}
                            onConnect={() => void handleConnectInstagram()}
                            onPublish={() => void handlePublishToInstagram()}
                            isConnecting={isConnectingInstagram}
                            isPublishing={isPublishingInstagram}
                        />
                    )}

                    {isSuperAdmin && facebookCapability?.configured && (
                        <FacebookPublishPanel
                            colors={colors}
                            styles={styles}
                            message={facebookMessage}
                            pageName={facebookCapability.pageName}
                            connected={facebookCapability.connected}
                            canPublish={facebookCapability.canPublish}
                            state={facebookState}
                            postUrl={facebookPostUrl}
                            onMessageChange={handleFacebookMessageChange}
                            onConnect={() => void handleConnectFacebook()}
                            onPublish={() => void handlePublishToFacebook()}
                            onOpenPost={() => void handleOpenFacebookPost()}
                        />
                    )}
                    </View>
                </ScrollView>

                <ConfirmDialog
                    visible={rejectConfirmVisible}
                    onClose={() => setRejectConfirmVisible(false)}
                    onConfirm={() => {
                        setRejectConfirmVisible(false);
                        void handleRejectModeration();
                    }}
                    title={i18nT('travel:components.travel.TravelWizardStepPublish.otklonit_moderatsiyu_27e138a4')}
                    message={
                        rejectionComment.trim()
                            ? i18nT('travel:components.travel.TravelWizardStepPublish.puteshestvie_vernetsya_v_chernoviki_avtor_po_7e1bc9af')
                            : i18nT('travel:components.travel.TravelWizardStepPublish.puteshestvie_vernetsya_v_chernoviki_i_budet__d9185285')
                    }
                    confirmText={i18nT('travel:components.travel.TravelWizardStepPublish.otklonit_a76b58b3')}
                    cancelText={i18nT('travel:components.travel.TravelWizardStepPublish.otmena_1fdffdc8')}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default React.memo(TravelWizardStepPublish);
