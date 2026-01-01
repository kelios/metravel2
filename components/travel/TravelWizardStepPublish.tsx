import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { QualityIndicator } from '@/components/travel/ValidationFeedback';
import { TravelFormData } from '@/src/types/types';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { getQualityScore } from '@/utils/travelWizardValidation';
import { trackWizardEvent } from '@/src/utils/analytics';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
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
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);
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

    const currentBackendStatus = useMemo(() => {
        if (formData.moderation) return { label: 'Опубликовано', tone: 'success' } as const;
        if (formData.publish) return { label: 'Отправлено на модерацию', tone: 'warning' } as const;
        return { label: 'Черновик', tone: 'muted' } as const;
    }, [formData.moderation, formData.publish]);

    const isUser = !isSuperAdmin;
    const pendingModeration = formData.publish && !formData.moderation;
    const userPendingModeration = isUser && pendingModeration;

    // ✅ УЛУЧШЕНИЕ: Разделение чеклиста на обязательные и рекомендуемые
    const requiredChecklist = useMemo(() => {
        const hasName = !!formData.name && formData.name.trim().length >= 3;
        const hasDescription = !!formData.description && formData.description.trim().length >= 50;
        const hasRoute = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length > 0
            : Array.isArray((formData as any).markers)
                ? ((formData as any).markers as any[]).length > 0
                : false;

        return [
            { key: 'name', label: 'Название маршрута', detail: 'Минимум 3 символа', ok: hasName, required: true },
            { key: 'description', label: 'Описание маршрута', detail: 'Минимум 50 символов', ok: hasDescription, required: true },
            { key: 'route', label: 'Маршрут на карте', detail: 'Минимум 1 точка (шаг 2)', ok: hasRoute, required: true },
        ];
    }, [formData]);

    const recommendedChecklist = useMemo(() => {
        const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
        const hasCategories = Array.isArray((formData as any).categories) && ((formData as any).categories as any[]).length > 0;
        const galleryArr = Array.isArray((formData as any).gallery) ? ((formData as any).gallery as any[]) : [];
        const hasCover = !!(formData as any).travel_image_thumb_small_url;
        const hasPhotos = hasCover || galleryArr.length > 0;

        return [
            {
                key: 'countries',
                label: 'Страны маршрута',
                detail: 'Для фильтров и поиска',
                benefit: 'Помогает пользователям найти ваш маршрут',
                ok: hasCountries,
                required: false,
            },
            {
                key: 'categories',
                label: 'Категории маршрута',
                detail: 'Выбираются на шаге 5',
                benefit: '+40% находят в поиске',
                ok: hasCategories,
                required: false,
            },
            {
                key: 'photos',
                label: 'Фото или обложка',
                detail: 'Рекомендуем горизонтальное 16:9',
                benefit: 'В 3 раза больше просмотров',
                ok: hasPhotos,
                required: false,
            },
        ];
    }, [formData]);

    const checklist = useMemo(() => {
        // Для обратной совместимости со старым кодом
        const hasName = !!formData.name && formData.name.trim().length > 0;
        const hasDescription = !!formData.description && formData.description.trim().length > 0;
        const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
        const hasCategories = Array.isArray((formData as any).categories) && ((formData as any).categories as any[]).length > 0;
        const hasRoute = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length > 0
            : Array.isArray((formData as any).markers)
                ? ((formData as any).markers as any[]).length > 0
                : false;
        const galleryArr = Array.isArray((formData as any).gallery)
            ? ((formData as any).gallery as any[])
            : [];
        const hasCover = !!(formData as any).travel_image_thumb_small_url;
        const hasPhotos = hasCover || galleryArr.length > 0;

        return [
            { key: 'name', label: 'Название маршрута (не менее 3 символов)', ok: hasName },
            { key: 'description', label: 'Описание для кого маршрут и чего ожидать (не менее 50 символов)', ok: hasDescription },
            { key: 'countries', label: 'Страны маршрута (минимум одна, выбираются на шаге "Маршрут")', ok: hasCountries },
            { key: 'categories', label: 'Категории маршрута (минимум одна, выбираются на шаге "Доп. параметры")', ok: hasCategories },
            { key: 'route', label: 'Маршрут на карте (минимум одна точка на шаге "Маршрут")', ok: hasRoute },
            { key: 'photos', label: 'Фото или обложка маршрута (рекомендуем горизонтальное изображение, без коллажей)', ok: hasPhotos },
        ];
    }, [formData]);

    const moderationIssues = useMemo(() => {
        return getModerationIssues({
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
            categories: (formData as any).categories ?? [],
            coordsMeTravel: (formData as any).coordsMeTravel ?? (formData as any).markers ?? [],
            gallery: (formData as any).gallery ?? [],
            travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
        } as any);
    }, [formData]);

    // Качественная оценка заполнения
    const qualityScore = useMemo(() => {
        return getQualityScore(formData);
    }, [formData]);

    const moderationIssuesByKey = useMemo(() => {
        const map = new Map<string, ModerationIssue>();
        moderationIssues.forEach(issue => map.set(issue.key, issue));
        return map;
    }, [moderationIssues]);

    const [missingForModeration, setMissingForModeration] = useState<ModerationIssue[]>([]);
    const isNew = !formData.id;

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 220;
    }, [footerHeight]);

    useEffect(() => {
        trackWizardEvent('wizard_step_view', {
            step: currentStep,
        });
    }, [currentStep]);

    const handleSaveDraft = async () => {
        const nextForm = {
            ...formData,
            publish: false,
            moderation: false,
        };
        setFormData(nextForm);
        setMissingForModeration([]);
        await onManualSave(nextForm);

        const hasName = !!formData.name && formData.name.trim().length > 0;
        const hasDescription = !!formData.description && formData.description.trim().length > 0;
        const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
        const hasRoute = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length > 0
            : Array.isArray((formData as any).markers)
                ? ((formData as any).markers as any[]).length > 0
                : false;
        const galleryArr = Array.isArray((formData as any).gallery)
            ? ((formData as any).gallery as any[])
            : [];
        const hasCover = !!(formData as any).travel_image_thumb_small_url;
        const hasPhotos = hasCover || galleryArr.length > 0;

        await trackWizardEvent('wizard_draft_saved', {
            travel_id: formData.id ?? null,
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
    };

    const handleSendToModeration = async () => {
        if (!startAction()) return;
        const criticalMissing = getModerationIssues({
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
            categories: (formData as any).categories ?? [],
            coordsMeTravel: (formData as any).coordsMeTravel ?? (formData as any).markers ?? [],
            gallery: (formData as any).gallery ?? [],
            travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
        } as any);
        const missingLabels = criticalMissing.map(i => i.label);

        await trackWizardEvent('wizard_moderation_attempt', {
            missing_fields: missingLabels,
            is_new: isNew,
            is_edit: !isNew,
            travel_id: formData.id ?? null,
        });

        if (criticalMissing.length > 0) {
            setMissingForModeration(criticalMissing);
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
            await onManualSave(nextForm);

            await trackWizardEvent('wizard_moderation_success', {
                travel_id: formData.id ?? null,
                filled_checklist_count: checklist.filter(item => item.ok).length,
                total_checklist_count: checklist.length,
            });

            Toast.show({
                type: 'success',
                text1: 'Маршрут отправлен на модерацию',
                text2: 'После одобрения он появится в разделе "Мои путешествия".',
            });

            // Навигация без повторного сохранения (чтобы не перезаписать publish=false старым стейтом)
            router.push('/metravel');
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
            await onManualSave(nextForm);

            await trackWizardEvent('admin_moderation_approved', {
                travel_id: formData.id ?? null,
            });

            Toast.show({
                type: 'success',
                text1: 'Модерация одобрена',
                text2: 'Маршрут опубликован и доступен всем пользователям.',
            });

            router.push('/metravel');
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
            await onManualSave(nextForm);

            await trackWizardEvent('admin_moderation_rejected', {
                travel_id: formData.id ?? null,
            });

            Toast.show({
                type: 'info',
                text1: 'Модерация отклонена',
                text2: 'Маршрут возвращен в черновики.',
            });

            router.push('/metravel');
        } finally {
            finishAction();
        }
    };

    const handlePrimaryAction = () => {
        if (userPendingModeration) return;
        if (status === 'draft') {
            handleSaveDraft();
        } else {
            handleSendToModeration();
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
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                />
                <ScrollView
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
                                <TouchableOpacity
                                    style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                                    onPress={() => setStatus('draft')}
                                    disabled={userPendingModeration}
                                    activeOpacity={0.85}
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
                                </TouchableOpacity>

                                <View style={styles.divider} />

                                <TouchableOpacity
                                    style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                                    onPress={() => setStatus('moderation')}
                                    disabled={userPendingModeration}
                                    activeOpacity={0.85}
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
                                </TouchableOpacity>
                            </View>
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

                    <View style={[styles.card, styles.checklistCard]}>
                        <View style={styles.checklistHeader}>
                            <Text style={styles.cardTitle}>Готовность к публикации</Text>
                            <View style={styles.progressRing}>
                                <Text style={styles.progressRingText}>
                                    {checklist.filter(item => item.ok).length}/{checklist.length}
                                </Text>
                            </View>
                        </View>

                        {/* ✅ УЛУЧШЕНИЕ: Обязательные пункты */}
                        <View style={styles.checklistSection}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeaderIcon}>✅</Text>
                                <Text style={styles.sectionHeaderText}>Обязательно для публикации</Text>
                            </View>
                            {requiredChecklist.map(item => {
                                const issue = moderationIssuesByKey.get(item.key);
                                const isClickable = !item.ok && !!issue && !!onNavigateToIssue;

                                const RowWrapper: any = isClickable ? TouchableOpacity : View;
                                return (
                                    <RowWrapper
                                        key={item.key}
                                        style={[
                                            styles.checklistRow,
                                            isClickable && styles.checklistRowClickable,
                                            item.ok && styles.checklistRowComplete
                                        ]}
                                        onPress={
                                            isClickable
                                                ? () => onNavigateToIssue?.(issue)
                                                : undefined
                                        }
                                        disabled={!isClickable}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.checkBadge,
                                                item.ok ? styles.checkBadgeOk : styles.checkBadgeMissing,
                                            ]}
                                        >
                                            <Icon
                                                source={item.ok ? 'check' : 'alert-circle'}
                                                size={16}
                                                color={item.ok ? DESIGN_TOKENS.colors.successDark : DESIGN_TOKENS.colors.dangerDark}
                                            />
                                        </View>
                                        <View style={styles.checklistTextColumn}>
                                            <Text
                                                style={[
                                                    styles.checklistLabel,
                                                    isClickable && styles.checklistLabelClickable,
                                                    item.ok && styles.checklistLabelComplete
                                                ]}
                                            >
                                                {item.label}
                                            </Text>
                                            <Text style={styles.checklistDetail}>{item.detail}</Text>
                                            {isClickable && !item.ok && (
                                                <Text style={styles.checklistHint}>Нажмите, чтобы перейти</Text>
                                            )}
                                        </View>
                                        {isClickable && !item.ok && (
                                            <Icon
                                                source="chevron-right"
                                                size={16}
                                                color={DESIGN_TOKENS.colors.textMuted}
                                            />
                                        )}
                                    </RowWrapper>
                                );
                            })}
                        </View>

                        {/* ✅ УЛУЧШЕНИЕ: Рекомендуемые пункты */}
                        <View style={[styles.checklistSection, styles.checklistSectionRecommended]}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeaderIcon}>💡</Text>
                                <Text style={styles.sectionHeaderText}>Рекомендуем заполнить</Text>
                            </View>
                            {recommendedChecklist.map(item => {
                                const issue = moderationIssuesByKey.get(item.key);
                                const isClickable = !item.ok && !!issue && !!onNavigateToIssue;

                                const RowWrapper: any = isClickable ? TouchableOpacity : View;
                                return (
                                    <RowWrapper
                                        key={item.key}
                                        style={[
                                            styles.checklistRow,
                                            isClickable && styles.checklistRowClickable,
                                            item.ok && styles.checklistRowComplete
                                        ]}
                                        onPress={
                                            isClickable
                                                ? () => onNavigateToIssue?.(issue)
                                                : undefined
                                        }
                                        disabled={!isClickable}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.checkBadge,
                                                item.ok ? styles.checkBadgeOk : styles.checkBadgeRecommended,
                                            ]}
                                        >
                                            <Icon
                                                source={item.ok ? 'check' : 'information'}
                                                size={16}
                                                color={item.ok ? DESIGN_TOKENS.colors.successDark : DESIGN_TOKENS.colors.primary}
                                            />
                                        </View>
                                        <View style={styles.checklistTextColumn}>
                                            <Text
                                                style={[
                                                    styles.checklistLabel,
                                                    isClickable && styles.checklistLabelClickable,
                                                    item.ok && styles.checklistLabelComplete
                                                ]}
                                            >
                                                {item.label}
                                            </Text>
                                            <Text style={styles.checklistDetail}>{item.detail}</Text>
                                            {!item.ok && item.benefit && (
                                                <View style={styles.benefitRow}>
                                                    <Text style={styles.benefitIcon}>📊</Text>
                                                    <Text style={styles.benefitText}>{item.benefit}</Text>
                                                </View>
                                            )}
                                            {isClickable && !item.ok && (
                                                <Text style={styles.checklistHint}>Нажмите, чтобы перейти</Text>
                                            )}
                                        </View>
                                        {isClickable && !item.ok && (
                                            <Icon
                                                source="chevron-right"
                                                size={16}
                                                color={DESIGN_TOKENS.colors.textMuted}
                                            />
                                        )}
                                    </RowWrapper>
                                );
                            })}
                        </View>
                    </View>

                    {isSuperAdmin && (pendingModeration || formData.moderation || status === 'moderation') && (
                        <View style={[styles.card, styles.adminCard]}>
                            <Text style={styles.cardTitle}>Панель модератора</Text>
                            <Text style={styles.adminHint}>
                                Маршрут находится на модерации. Вы можете одобрить или отклонить его.
                            </Text>
                            <View style={styles.adminButtons}>
                                <TouchableOpacity
                                    style={[styles.adminButton, styles.adminButtonApprove]}
                                    onPress={handleApproveModeration}
                                    activeOpacity={0.85}
                                >
                                    <Icon source="check-circle" size={20} color="#fff" />
                                    <Text style={styles.adminButtonText}>Одобрить модерацию</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.adminButton, styles.adminButtonReject]}
                                    onPress={handleRejectModeration}
                                    activeOpacity={0.85}
                                >
                                    <Icon source="close-circle" size={20} color="#fff" />
                                    <Text style={styles.adminButtonText}>Отклонить</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {status === 'moderation' && missingForModeration.length > 0 && (
                        <View style={[styles.card, styles.bannerError]}>
                            <Text style={styles.bannerTitle}>Нужно дополнить перед модерацией</Text>
                            <Text style={styles.bannerDescription}>
                                Проверьте отмеченные пункты чек-листа. Без них мы не сможем отправить маршрут на модерацию.
                            </Text>
                            {missingForModeration.map(issue => {
                                const isClickable = !!onNavigateToIssue;
                                const RowWrapper: any = isClickable ? TouchableOpacity : View;
                                return (
                                    <RowWrapper
                                        key={issue.key}
                                        style={[styles.checklistRow, isClickable && styles.checklistRowClickable]}
                                        onPress={isClickable ? () => onNavigateToIssue?.(issue) : undefined}
                                        disabled={!isClickable}
                                        activeOpacity={0.85}
                                    >
                                        <View style={[styles.checkBadge, styles.checkBadgeMissing]}>
                                            <Icon
                                                source={'alert'}
                                                size={14}
                                                color={DESIGN_TOKENS.colors.dangerDark}
                                            />
                                        </View>
                                        <Text style={[styles.checklistLabel, isClickable && styles.checklistLabelClickable]}>
                                            {issue.label}
                                        </Text>
                                    </RowWrapper>
                                );
                            })}
                        </View>
                    )}
                    </View>
                </ScrollView>
                <TravelWizardFooter
                    canGoBack={false}
                    onPrimary={handlePrimaryAction}
                    primaryLabel={
                        pendingModeration
                            ? 'Отправлено на модерацию'
                            : status === 'draft'
                            ? 'Сохранить'
                            : 'Отправить на модерацию'
                    }
                    primaryDisabled={pendingModeration}
                    onSave={undefined}
                    onLayout={handleFooterLayout}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                />
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
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
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
        borderTopColor: DESIGN_TOKENS.colors.borderLight,
    },
    suggestionsTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    suggestionItem: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
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
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
    },
    statusTextCol: {
        flex: 1,
        minWidth: 0,
    },
    divider: {
        height: 1,
        backgroundColor: DESIGN_TOKENS.colors.border,
        opacity: 0.8,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: DESIGN_TOKENS.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: DESIGN_TOKENS.spacing.xxs,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: DESIGN_TOKENS.colors.primary,
    },
    statusLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    statusHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    statusChipCard: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    statusChipRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md },
    statusChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    statusChipSuccess: { backgroundColor: '#e9f8ef', borderColor: '#b6e4c6' },
    statusChipWarning: { backgroundColor: '#fff5e6', borderColor: '#ffd9a8' },
    statusChipMuted: { backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary, borderColor: DESIGN_TOKENS.colors.border },
    statusChipText: { fontWeight: '700', color: DESIGN_TOKENS.colors.text },
    statusChipHint: { flex: 1, color: DESIGN_TOKENS.colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
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
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderWidth: 3,
        borderColor: DESIGN_TOKENS.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRingText: {
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.primary,
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
        borderColor: DESIGN_TOKENS.colors.borderLight,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    checklistRowComplete: {
        backgroundColor: DESIGN_TOKENS.colors.successSoft,
        borderColor: DESIGN_TOKENS.colors.successLight,
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
        backgroundColor: DESIGN_TOKENS.colors.successSoft,
        borderColor: DESIGN_TOKENS.colors.successLight,
    },
    checkBadgeMissing: {
        backgroundColor: DESIGN_TOKENS.colors.errorSoft,
        borderColor: DESIGN_TOKENS.colors.dangerLight,
    },
    checkBadgeRecommended: {
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderColor: DESIGN_TOKENS.colors.primary + '40',
    },
    checklistLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
        lineHeight: 20,
        fontWeight: '500',
    },
    checklistLabelComplete: {
        color: DESIGN_TOKENS.colors.successDark,
    },
    checklistLabelClickable: {
        fontWeight: '600',
    },
    checklistDetail: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },
    checklistHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
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
        borderTopColor: DESIGN_TOKENS.colors.borderLight,
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
        color: DESIGN_TOKENS.colors.text,
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
        color: DESIGN_TOKENS.colors.primary,
        fontWeight: '600',
        lineHeight: 16,
    },
    bannerError: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    bannerInfo: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd',
    },
    bannerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.dangerDark,
        marginBottom: 4,
    },
    bannerDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.dangerDark,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    adminCard: {
        backgroundColor: '#f8fafc',
        borderColor: DESIGN_TOKENS.colors.border,
    },
    adminHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: 20,
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
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.success,
    },
    adminButtonApprove: {
        backgroundColor: DESIGN_TOKENS.colors.success,
    },
    adminButtonReject: {
        backgroundColor: DESIGN_TOKENS.colors.danger,
    },
    adminButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: '#fff',
    },
});

export default React.memo(TravelWizardStepPublish);
