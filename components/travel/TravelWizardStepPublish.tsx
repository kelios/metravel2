import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { TravelFormData, Travel } from '@/src/types/types';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { trackWizardEvent } from '@/src/utils/analytics';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    filters: any;
    travelDataOld: Travel | null;
    isSuperAdmin: boolean;
    onManualSave: () => Promise<TravelFormData | void>;
    onGoBack: () => void;
    onFinish: () => void;
    onNavigateToIssue?: (issue: ModerationIssue) => void;
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
    filters,
    travelDataOld,
    isSuperAdmin,
    onManualSave,
    onGoBack,
    onFinish,
    onNavigateToIssue,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
}) => {
    const router = useRouter();
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);
    const [status, setStatus] = useState<'draft' | 'moderation'>(
        formData.moderation ? 'moderation' : 'draft',
    );

    const checklist = useMemo(() => {
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
            { key: 'countries', label: 'Страны маршрута (минимум одна, выбираются на шаге “Маршрут”)', ok: hasCountries },
            { key: 'categories', label: 'Категории маршрута (минимум одна, выбираются на шаге “Доп. параметры”)', ok: hasCategories },
            { key: 'route', label: 'Маршрут на карте (минимум одна точка на шаге “Маршрут”)', ok: hasRoute },
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
        setFormData({
            ...formData,
            publish: false,
            moderation: false,
        });
        setMissingForModeration([]);
        await onManualSave();

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
            return;
        }

        setMissingForModeration([]);
        setFormData({
            ...formData,
            moderation: true,
        });

        // Сохраняем статус модерации на бэкенд перед редиректом/уведомлением
        await onManualSave();

        await trackWizardEvent('wizard_moderation_success', {
            travel_id: formData.id ?? null,
            filled_checklist_count: checklist.filter(item => item.ok).length,
            total_checklist_count: checklist.length,
        });

        Toast.show({
            type: 'success',
            text1: 'Маршрут отправлен на модерацию',
            text2: 'После одобрения он появится в разделе “Мои путешествия”.',
        });

        await onFinish();
        router.push('/metravel');
    };

    const handlePrimaryAction = () => {
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
                />
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                    <FiltersUpsertComponent
                        filters={filters}
                        formData={formData}
                        setFormData={setFormData}
                        travelDataOld={travelDataOld}
                        isSuperAdmin={isSuperAdmin}
                        onSave={onManualSave}
                        showSaveButton={true}
                        showPreviewButton={true}
                        showPublishControls={false}
                        showCountries={false}
                        showCoverImage={false}
                        showCategories={false}
                        showAdditionalFields={false}
                    />

                    <View style={[styles.card, styles.statusCard]}>
                        <Text style={styles.cardTitle}>Статус публикации</Text>
                        <View style={styles.statusOptions}>
                            <TouchableOpacity
                                style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                                onPress={() => setStatus('draft')}
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

                    <View style={[styles.card, styles.checklistCard]}>
                        <View style={styles.checklistHeader}>
                            <Text style={styles.cardTitle}>Чек-лист готовности</Text>
                            <View style={styles.progressRing}>
                                <Text style={styles.progressRingText}>
                                    {checklist.filter(item => item.ok).length}/{checklist.length}
                                </Text>
                            </View>
                        </View>
                    {checklist.map(item => {
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
                                    {isClickable && !item.ok && (
                                        <Text style={styles.checklistHint}>Нажмите, чтобы перейти к полю</Text>
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
                    primaryLabel={status === 'draft' ? 'Сохранить черновик' : 'Отправить на модерацию'}
                    onSave={status === 'moderation' ? handleSaveDraft : undefined}
                    saveLabel="Сохранить как черновик"
                    onLayout={handleFooterLayout}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    keyboardAvoid: { flex: 1 },
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
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    cardTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    statusCard: {},
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
        marginTop: DESIGN_TOKENS.spacing.xxs,
        lineHeight: 16,
    },
    checklistCard: {},
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    progressRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
    checklistHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: 2,
    },
    bannerError: {
        backgroundColor: DESIGN_TOKENS.colors.errorSoft,
        borderColor: DESIGN_TOKENS.colors.dangerLight,
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
});

export default React.memo(TravelWizardStepPublish);
