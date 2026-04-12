import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
    StyleSheet,
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
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { showToastMessage } from '@/utils/toast';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist';
import PublishChecklistCard from '@/components/travel/PublishChecklistCard';
import InstagramPublishPanel from '@/components/travel/InstagramPublishPanel';
import PublishModerationAdminPanel from '@/components/travel/PublishModerationAdminPanel';
import PublishStatusSummaryPanel from '@/components/travel/PublishStatusSummaryPanel';
import { useInstagramPublishDraft } from '@/components/travel/useInstagramPublishDraft';
import {
    INSTAGRAM_CAPTION_MAX_LENGTH,
    INSTAGRAM_HASHTAG_MAX_COUNT,
} from '@/utils/instagramPublish';
import { openExternalUrl } from '@/utils/externalLinks';
import { buildInstagramOAuthUrl, getInstagramOAuthResolution } from '@/utils/instagramOAuth';

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
    onManualSave: (data?: TravelFormData) => Promise<TravelFormData | void>;
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
    const isNew = !formData.id;

    const scrollRef = useRef<ScrollView | null>(null);
    const missingBannerAnchorRef = useRef<View | null>(null);
    const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [primaryOverrideLabel, setPrimaryOverrideLabel] = useState<string | null>(null);
    const instagramOAuthResolution = useMemo(() => getInstagramOAuthResolution(), []);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);
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

        setTimeout(() => {
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

            hapticNotification('success');

            // После сохранения на последнем шаге логично вывести пользователя из мастера
            // в раздел "Мои путешествия", где он увидит черновик.
            router.replace('/metravel');
        } catch (error) {
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

        if (criticalMissing.length > 0) {
            setMissingForModeration(criticalMissing);
            hapticNotification('warning');
            pulsePrimaryError('Нельзя отправить: исправьте ошибки');
            scrollToMissingBanner();
            finishAction();
            return;
        }

        setMissingForModeration([]);
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: false,
            publish: true, // пользователь отправляет на модерацию: publish=true, moderation остаётся false до решения админа
        };
        setFormData(nextForm);

        // Сохраняем статус на бэкенд (отсюда триггерятся уведомления)
        try {
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось отправить',
                    text2: 'Сохранение не удалось. Проверьте интернет и попробуйте ещё раз.',
                });
                return;
            }

            await trackWizardEvent('wizard_moderation_success', {
                travel_id: resolvedId,
                filled_checklist_count: checklist.filter(item => item.ok).length,
                total_checklist_count: checklist.length,
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
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
            if (!resolvedId) {
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

    const handlePublishToInstagram = useCallback(async () => {
        const oauthUrl = buildInstagramOAuthUrl();

        if (!oauthUrl) {
            void showToastMessage({
                type: 'error',
                text1: 'Instagram OAuth не настроен',
                text2: instagramOAuthResolution.reason,
            });
            return;
        }

        const opened = await openExternalUrl(oauthUrl);
        if (!opened) {
            void showToastMessage({
                type: 'error',
                text1: 'Не удалось открыть Meta OAuth',
                text2: 'Проверьте настройки браузера и повторите попытку.',
            });
        }
    }, [
        instagramOAuthResolution.reason,
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
                        primaryOverrideLabel ??
                        (pendingModeration
                            ? 'Отправлено на модерацию'
                            : status === 'draft'
                            ? 'Сохранить'
                            : 'Отправить на модерацию')
                    }
                    primaryTestID="primary-button"
                    primaryDisabled={pendingModeration}
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
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
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
                            onReject={() => void handleRejectModeration()}
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
                            onPublish={() => void handlePublishToInstagram()}
                        />
                    )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    keyboardAvoid: {
        flex: 1
    },
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    card: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                    (colors as unknown as { boxShadows?: { card?: string } }).boxShadows?.card ??
                    DESIGN_TOKENS.shadows.card,
            } as unknown as object)
            : ((colors as unknown as { shadows?: { light?: object } }).shadows?.light ??
                DESIGN_TOKENS.shadowsNative.light)),
    },
    cardTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    statusCard: {},
    qualityCard: {},
    suggestionsContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        paddingTop: DESIGN_TOKENS.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    suggestionsTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    suggestionItem: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: 4,
        lineHeight: 20,
    },
    statusOptions: {
        gap: DESIGN_TOKENS.spacing.sm,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    statusOptionActive: {
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    statusTextCol: {
        flex: 1,
        minWidth: 0,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.8,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: DESIGN_TOKENS.spacing.xxs,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    statusLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
    },
    statusHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    statusChipCard: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md },
    statusChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipSuccess: { backgroundColor: colors.successSoft, borderColor: colors.successLight },
    statusChipWarning: { backgroundColor: colors.warningSoft, borderColor: colors.warningLight },
    statusChipMuted: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
    statusChipText: { fontWeight: '700', color: colors.text },
    statusChipHint: { flex: 1, color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
    checklistCard: {},
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    progressRing: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primarySoft,
        borderWidth: 3,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRingText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primaryText,
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    checklistRowClickable: {
        borderColor: colors.borderLight,
        backgroundColor: colors.surfaceMuted,
    },
    checklistRowComplete: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checklistTextColumn: {
        flex: 1,
        minWidth: 0,
    },
    checkBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 0,
    },
    checkBadgeOk: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checkBadgeMissing: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    checkBadgeRecommended: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryAlpha40,
    },
    checklistLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        lineHeight: 20,
        fontWeight: '500',
    },
    checklistLabelComplete: {
        color: colors.successDark,
    },
    checklistLabelClickable: {
        fontWeight: '600',
    },
    checklistDetail: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },
    checklistHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        fontStyle: 'italic',
    },
    // ✅ УЛУЧШЕНИЕ: Стили для разделения чеклиста
    checklistSection: {
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
    checklistSectionRecommended: {
        paddingTop: DESIGN_TOKENS.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        gap: DESIGN_TOKENS.spacing.xs,
    },
    sectionHeaderIcon: {
        fontSize: 16,
    },
    sectionHeaderText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    benefitIcon: {
        fontSize: 12,
    },
    benefitText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primaryText,
        fontWeight: '600',
        lineHeight: 16,
    },
    bannerError: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    bannerInfo: {
        backgroundColor: colors.infoSoft,
        borderColor: colors.infoLight,
    },
    bannerInfoText: {
        color: colors.text,
        marginBottom: 0,
    },
    inlineBanner: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.md,
    },
    bannerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.dangerDark,
        marginBottom: 4,
    },
    bannerDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.dangerDark,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    adminCard: {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
    },
    instagramCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    adminHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: 20,
    },
    instagramSection: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    accountList: {
        gap: DESIGN_TOKENS.spacing.xs,
    },
    accountOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
    },
    accountOptionActive: {
        borderColor: colors.borderAccent,
        backgroundColor: colors.primarySoft,
    },
    instagramMetaRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramControlRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramCounterPill: {
        flex: 1,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
    },
    instagramCounterLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    instagramCounterValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.text,
        fontWeight: '700',
    },
    instagramEditor: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramEditorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '600',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    instagramMetaItem: {
        flex: 1,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.backgroundSecondary,
    },
    instagramMetaLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    instagramMetaValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.text,
        fontWeight: '700',
    },
    instagramHintText: {
        marginTop: 2,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    instagramHintDanger: {
        color: colors.dangerDark,
    },
    instagramFieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    instagramCounter: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: '600',
    },
    instagramCounterDanger: {
        color: colors.dangerDark,
    },
    instagramGalleryRow: {
        gap: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    instagramGalleryGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    instagramPhotoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    instagramPhotoHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    instagramPhotoIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instagramPhotoTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 20,
    },
    instagramPhotoSubtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    instagramGalleryCard: {
        width: Platform.OS === 'web' ? '100%' : 96,
        aspectRatio: 1,
        borderRadius: DESIGN_TOKENS.radii.lg,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 2,
        borderColor: colors.borderLight,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                cursor: 'grab',
            } as any)
            : {}),
    },
    instagramGalleryCardDragging: {
        opacity: 0.72,
        borderColor: colors.primary,
        ...(Platform.OS === 'web' ? ({ cursor: 'grabbing' } as any) : {}),
    },
    instagramGalleryImage: {
        width: '100%',
        height: '100%',
    },
    instagramGalleryDragHandle: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: Platform.OS === 'web' ? 36 : 28,
        height: Platform.OS === 'web' ? 36 : 28,
        borderRadius: Platform.OS === 'web' ? 18 : 14,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        ...(Platform.OS === 'web'
            ? ({
                cursor: 'grab',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
            } as any)
            : {}),
    },
    instagramGalleryRemoveButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: Platform.OS === 'web' ? 36 : 28,
        height: Platform.OS === 'web' ? 36 : 28,
        borderRadius: Platform.OS === 'web' ? 18 : 14,
        backgroundColor: 'rgba(239, 68, 68, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        zIndex: 2,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
            } as any)
            : {}),
    },
    instagramGalleryControls: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    instagramGalleryControlButton: {
        width: Platform.OS === 'web' ? 44 : 32,
        height: Platform.OS === 'web' ? 44 : 32,
        borderRadius: Platform.OS === 'web' ? 22 : 16,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
            } as any)
            : {}),
    },
    instagramGalleryControlButtonDisabled: {
        opacity: 0.45,
    },
    instagramPreview: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramPreviewText: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        lineHeight: 20,
    },
    instagramCaptionInput: {
        minHeight: 140,
    },
    rejectionCommentContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    rejectionCommentLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    rejectionCommentInput: {
        borderWidth: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        minHeight: 80,
        textAlignVertical: 'top' as const,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
    },
    adminButtons: {
        marginTop: DESIGN_TOKENS.spacing.md,
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    adminButton: {
        flex: 1,
        minWidth: 150,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderColor: colors.border,
        backgroundColor: colors.success,
    },
    adminButtonApprove: {
        backgroundColor: colors.success,
    },
    adminButtonReject: {
        backgroundColor: colors.danger,
    },
    adminButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: colors.textOnPrimary,
    },
});

export default React.memo(TravelWizardStepPublish);
