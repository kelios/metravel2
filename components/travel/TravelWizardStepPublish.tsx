import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
    Text,
    TextInput,
    StyleSheet,
    findNodeHandle,
    UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/ui/paper';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { sendMessage } from '@/api/messages';
import { devError } from '@/utils/logger';
import { QualityIndicator } from '@/components/travel/ValidationFeedback';
import { TravelFormData } from '@/types/types';
import Button from '@/components/ui/Button';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { trackWizardEvent } from '@/utils/analytics';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist';
import PublishChecklistCard from '@/components/travel/PublishChecklistCard';

async function showToastMessage(payload: any) {
    await showToast(payload);
}

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
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

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

    useEffect(() => {
        trackWizardEvent('wizard_step_view', {
            step: currentStep,
        });
    }, [currentStep]);

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
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
                return;
            }

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

            // После сохранения на последнем шаге логично вывести пользователя из мастера
            // в раздел "Мои путешествия", где он увидит черновик.
            router.replace('/metravel');
        } catch (error) {
            // ✅ FIX: Обработка ошибок сохранения
            void showToastMessage({
                type: 'error',
                text1: 'Ошибка сохранения',
                text2: error instanceof Error ? error.message : 'Попробуйте ещё раз',
            });
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
            pulsePrimaryError('Нельзя отправить: исправьте ошибки');
            scrollToMissingBanner();
            finishAction();
            return;
        }

        setMissingForModeration([]);
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

            // Навигация без повторного сохранения (чтобы не перезаписать publish=false старым стейтом)
            // Используем replace, чтобы мастер точно размонтировался и не продолжал автосохранение.
            router.replace('/metravel');
        } finally {
            finishAction();
        }
    };

    const handleApproveModeration = async () => {
        if (!startAction()) return;
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
        } finally {
            finishAction();
        }
    };

    const handleRejectModeration = async () => {
        if (!startAction()) return;
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

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                    <View style={[styles.card, styles.statusChipCard]}>
                        <Text style={styles.cardTitle}>Текущий статус</Text>
                        <View style={styles.statusChipRow}>
                            <View
                                style={[
                                    styles.statusChip,
                                    currentBackendStatus.tone === 'success' && styles.statusChipSuccess,
                                    currentBackendStatus.tone === 'warning' && styles.statusChipWarning,
                                    currentBackendStatus.tone === 'muted' && styles.statusChipMuted,
                                ]}
                            >
                                <Text style={styles.statusChipText}>{currentBackendStatus.label}</Text>
                            </View>
                            <Text style={styles.statusChipHint}>
                                {pendingModeration
                                    ? 'Маршрут отправлен на модерацию, ожидает решения администратора.'
                                    : 'Это статус, который уже сохранён. Ниже вы можете выбрать новый (черновик или модерация).'}
                            </Text>
                        </View>
                    </View>

                    {!pendingModeration && (
                        <View style={[styles.card, styles.statusCard]}>
                            <Text style={styles.cardTitle}>Статус публикации</Text>
                            <View style={styles.statusOptions}>
                                <CardActionPressable
                                    style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                                    onPress={() => setStatus('draft')}
                                    disabled={userPendingModeration}
                                    accessibilityLabel="Сохранить как черновик"
                                >
                                    <View style={styles.radioOuter}>
                                        {status === 'draft' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.statusTextCol}>
                                        <Text style={styles.statusLabel}>Сохранить как черновик</Text>
                                        <Text style={styles.statusHint}>
                                            Черновик виден только вам. Его можно дополнять и отправить на модерацию позже.
                                        </Text>
                                    </View>
                                </CardActionPressable>

                                <View style={styles.divider} />

                                <CardActionPressable
                                    style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                                    onPress={() => setStatus('moderation')}
                                    disabled={userPendingModeration}
                                    accessibilityLabel="Отправить на модерацию"
                                >
                                    <View style={styles.radioOuter}>
                                        {status === 'moderation' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.statusTextCol}>
                                        <Text style={styles.statusLabel}>Отправить на модерацию</Text>
                                        <Text style={styles.statusHint}>
                                            После одобрения маршрут станет публичным и появится в списке путешествий.
                                        </Text>
                                    </View>
                                </CardActionPressable>
                            </View>
                        </View>
                    )}

                    {status === 'moderation' && missingForModeration.length > 0 && (
                        <View ref={missingBannerAnchorRef} nativeID="travelwizard-publish-missing-banner" />
                    )}

                    {status === 'moderation' && missingForModeration.length > 0 && (
                        <View style={[styles.card, styles.bannerError]}>
                            <Text style={styles.bannerTitle}>Нужно дополнить перед модерацией</Text>
                            <Text style={styles.bannerDescription}>
                                Проверьте отмеченные пункты чек-листа. Без них мы не сможем отправить маршрут на модерацию.
                            </Text>
                            {missingForModeration.map(issue => {
                                const isClickable = !!onNavigateToIssue;

                                const rowContent = (
                                    <>
                                        <View style={[styles.checkBadge, styles.checkBadgeMissing]}>
                                            <Icon source="alert" size={14} color={colors.dangerDark} />
                                        </View>
                                        <Text
                                            style={[
                                                styles.checklistLabel,
                                                isClickable && styles.checklistLabelClickable,
                                            ]}
                                        >
                                            {issue.label}
                                        </Text>
                                    </>
                                );

                                const rowStyle = [
                                    styles.checklistRow,
                                    isClickable && styles.checklistRowClickable,
                                ];

                                if (isClickable) {
                                    return (
                                        <CardActionPressable
                                            key={issue.key}
                                            style={rowStyle}
                                            onPress={() => onNavigateToIssue?.(issue)}
                                            accessibilityLabel={issue.label}
                                        >
                                            {rowContent}
                                        </CardActionPressable>
                                    );
                                }

                                return (
                                    <View key={issue.key} style={rowStyle}>
                                        {rowContent}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={[styles.card, styles.qualityCard]}>
                        <Text style={styles.cardTitle}>Качество заполнения</Text>
                        <QualityIndicator level={qualityScore.level} score={qualityScore.score} />
                        {qualityScore.suggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>Рекомендации для улучшения:</Text>
                                {qualityScore.suggestions.map((suggestion, idx) => (
                                    <Text key={idx} style={styles.suggestionItem}>• {suggestion}</Text>
                                ))}
                            </View>
                        )}
                    </View>

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
                        <View style={[styles.card, styles.adminCard]}>
                            <Text style={styles.cardTitle}>Панель модератора</Text>
                            <Text style={styles.adminHint}>
                                Маршрут находится на модерации. Вы можете одобрить или отклонить его.
                            </Text>
                            <View style={styles.rejectionCommentContainer}>
                                <Text style={styles.rejectionCommentLabel}>Комментарий при отклонении (будет отправлен автору):</Text>
                                <TextInput
                                    style={[
                                        styles.rejectionCommentInput,
                                        {
                                            backgroundColor: colors.backgroundSecondary,
                                            color: colors.text,
                                            borderColor: colors.borderLight,
                                        },
                                    ]}
                                    value={rejectionComment}
                                    onChangeText={setRejectionComment}
                                    placeholder="Укажите причину отклонения..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={1000}
                                    accessibilityLabel="Комментарий при отклонении"
                                />
                            </View>
                            <View style={styles.adminButtons}>
                                <Button
                                    label="Одобрить модерацию"
                                    onPress={handleApproveModeration}
                                    icon={<Feather name="check-circle" size={20} color={colors.textOnPrimary} />}
                                    variant="primary"
                                    size="md"
                                    style={[styles.adminButton, styles.adminButtonApprove]}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Одобрить модерацию"
                                />
                                <Button
                                    label="Отклонить"
                                    onPress={handleRejectModeration}
                                    icon={<Feather name="x-circle" size={20} color={colors.textOnPrimary} />}
                                    variant="danger"
                                    size="md"
                                    style={[styles.adminButton, styles.adminButtonReject]}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Отклонить модерацию"
                                />
                            </View>
                        </View>
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
    adminHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: 20,
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
