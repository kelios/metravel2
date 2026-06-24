import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
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
import { TravelFormData } from '@/types/types';
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
import { createStyles } from '@/components/travel/travelWizardStepPublish.styles';

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    countries?: Array<{
        country_id: string;
        title_ru: string;
        title_en?: string;
        title?: string;
        name?: string;
    }>;
    // ✅ FIX: Унифицированная сигнатура setFormData для совместимости с другими шагами
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>> | ((data: TravelFormData) => void);
    isSuperAdmin: boolean;
    onManualSave: (
        data?: TravelFormData,
        options?: { intent?: 'save' | 'publish' },
    ) => Promise<TravelFormData | void>;
    onGoBack: () => void;
    onFinish: () => void;
    onNavigateToIssue?: (issue: ModerationIssue) => void;
    onStepSelect?: (step: number) => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    onPreview?: () => void;
    onOpenPublic?: () => void;
}

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
    progress = currentStep / totalSteps,
    autosaveBadge,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
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
        if (formData.moderation) return { label: 'Опубликовано', tone: 'success' } as const;
        if (formData.publish) return { label: 'Отправлено на модерацию', tone: 'warning' } as const;
        return { label: 'Черновик', tone: 'muted' } as const;
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
                    text1: 'Ошибка сохранения',
                    text2: error instanceof Error ? error.message : 'Попробуйте ещё раз',
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
            pulsePrimaryError('Нельзя отправить: исправьте ошибки');
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
                    text1: 'Не удалось отправить',
                    text2: 'Сохранение не удалось. Проверьте интернет и попробуйте ещё раз.',
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
                text1: 'Маршрут отправлен на модерацию',
                text2: 'После одобрения он появится в разделе "Мои путешествия".',
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
                    text1: 'Не удалось отправить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет и попробуйте ещё раз.',
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
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
                return;
            }

            await trackWizardEvent('admin_moderation_approved', {
                travel_id: resolvedId,
            });

            void showToastMessage({
                type: 'success',
                text1: 'Модерация одобрена',
                text2: 'Маршрут опубликован и доступен всем пользователям.',
            });

            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет-соединение и попробуйте ещё раз',
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
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
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
                    const travelName = formData.name || 'Без названия';
                    const messageText = `Модерация отклонена для "${travelName}": ${commentText}`;
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
                text1: 'Модерация отклонена',
                text2: commentText
                    ? 'Маршрут возвращен в черновики. Комментарий отправлен автору.'
                    : 'Маршрут возвращен в черновики.',
            });

            setRejectionComment('');
            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет-соединение и попробуйте ещё раз',
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
            text1: 'Текст для Instagram скопирован',
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
                    text1: 'Instagram не настроен на сервере',
                    text2: 'Нужны ключи Meta на бэкенде (задача BE-066).',
                });
                return;
            }
            const opened = await openExternalUrl(authUrl);
            if (!opened) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось открыть Meta OAuth',
                    text2: 'Проверьте блокировку всплывающих окон и повторите.',
                });
            }
        } catch (error) {
            void showToastMessage({
                type: 'error',
                text1: 'Не удалось начать подключение Instagram',
                text2: error instanceof Error ? error.message : 'Повторите попытку позже.',
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
                text1: 'Сначала сохраните путешествие',
                text2: 'Публикация в Instagram доступна после сохранения.',
            });
            return;
        }

        const imageUrls = editableInstagramImages.filter(Boolean);
        if (imageUrls.length === 0) {
            void showToastMessage({
                type: 'error',
                text1: 'Нет фото для публикации',
                text2: 'Добавьте хотя бы одно фото в галерею.',
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
                text1: 'Опубликовано в Instagram',
                text2: result?.postUrl || undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const notConnected = /\b401\b|\b403\b|config|connect|подключ|token|account/i.test(message);
            void showToastMessage({
                type: 'error',
                text1: notConnected ? 'Аккаунт Instagram не подключён' : 'Не удалось опубликовать',
                text2: notConnected
                    ? 'Нажмите «Подключить Instagram», затем повторите публикацию.'
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
                    title={stepMeta?.title ?? 'Публикация путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    onPrimary={handlePrimaryAction}
                    primaryLabel={
                        isSaving
                            ? 'Сохранение…'
                            : primaryOverrideLabel ??
                              (pendingModeration
                                  ? 'Отправлено на модерацию'
                                  : status === 'draft'
                                  ? 'Сохранить и выйти'
                                  : 'Отправить на модерацию')
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
                    </View>
                </ScrollView>

                <ConfirmDialog
                    visible={rejectConfirmVisible}
                    onClose={() => setRejectConfirmVisible(false)}
                    onConfirm={() => {
                        setRejectConfirmVisible(false);
                        void handleRejectModeration();
                    }}
                    title="Отклонить модерацию"
                    message={
                        rejectionComment.trim()
                            ? 'Путешествие вернётся в черновики, автор получит сообщение с вашим комментарием. Действие необратимо.'
                            : 'Путешествие вернётся в черновики и будет снято с публикации. Комментарий не заполнен — автор не узнает причину. Действие необратимо.'
                    }
                    confirmText="Отклонить"
                    cancelText="Отмена"
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default React.memo(TravelWizardStepPublish);
