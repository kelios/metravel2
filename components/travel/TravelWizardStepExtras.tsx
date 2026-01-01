import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, ScrollView, findNodeHandle, UIManager, LayoutChangeEvent, Text } from 'react-native';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import GroupedFiltersSection from '@/components/travel/GroupedFiltersSection';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема

interface TravelWizardStepExtrasProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    filters: any;
    travelDataOld: Travel | null;
    isSuperAdmin: boolean;
    onManualSave: () => Promise<TravelFormData | void>;
    onBack: () => void;
    onNext: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    onStepSelect?: (step: number) => void;
}

const TravelWizardStepExtras: React.FC<TravelWizardStepExtrasProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    filters,
    travelDataOld,
    isSuperAdmin,
    onManualSave,
    onBack,
    onNext,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
    onStepSelect,
}) => {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 180;
    }, [footerHeight]);

    const scrollRef = useRef<ScrollView | null>(null);
    const categoriesAnchorRef = useRef<View | null>(null);

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'travelwizard-extras-categories') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = categoriesAnchorRef.current;
        if (!scrollNode || !anchorNode) {
            onAnchorHandled?.();
            return;
        }

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) {
            onAnchorHandled?.();
            return;
        }

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => onAnchorHandled?.(),
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                    onAnchorHandled?.();
                },
            );
        }, 50);
    }, [focusAnchorId, onAnchorHandled]);

    // Валидация шага 5 (опциональный, показываем только warnings)
    const validation = useMemo(() => {
        return validateStep(5, formData);
    }, [formData]);

    // ✅ УЛУЧШЕНИЕ: Подсчет заполненных полей для каждой группы
    const groupsFilledCounts = useMemo(() => {
        const hasCategories = Array.isArray((formData as any).categories) && ((formData as any).categories as any[]).length > 0;
        const hasTransports = Array.isArray((formData as any).transports) && ((formData as any).transports as any[]).length > 0;

        const hasMonths = Array.isArray((formData as any).month) && ((formData as any).month as any[]).length > 0;
        const hasComplexity = Array.isArray((formData as any).complexity) && ((formData as any).complexity as any[]).length > 0;

        const hasCompanions = Array.isArray((formData as any).companions) && ((formData as any).companions as any[]).length > 0;
        const hasNightStay = Array.isArray((formData as any).over_nights_stay) && ((formData as any).over_nights_stay as any[]).length > 0;

        const hasVisa = (formData as any).visa !== undefined && (formData as any).visa !== null;

        return {
            main: [hasCategories, hasTransports].filter(Boolean).length,
            timeComplexity: [hasMonths, hasComplexity].filter(Boolean).length,
            style: [hasCompanions, hasNightStay].filter(Boolean).length,
            practical: [hasVisa].filter(Boolean).length,
        };
    }, [formData]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? 'Доп. параметры'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                />
                {validation.warnings.length > 0 && (
                    <View style={styles.validationSummaryWrapper}>
                        <ValidationSummary
                            errorCount={validation.errors.length}
                            warningCount={validation.warnings.length}
                        />
                    </View>
                )}
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <View ref={categoriesAnchorRef} nativeID="travelwizard-extras-categories" />

                        {/* ✅ УЛУЧШЕНИЕ: Группировка параметров с аккордеонами */}

                        {/* Группа 1: Основное */}
                        <GroupedFiltersSection
                            group={{
                                id: 'main',
                                title: 'Основное',
                                iconName: 'star',
                                description: 'Категории и виды транспорта — помогают пользователям найти ваш маршрут',
                                defaultExpanded: true,
                            }}
                            filledCount={groupsFilledCounts.main}
                            totalCount={2}
                        >
                            <FiltersUpsertComponent
                                filters={filters}
                                formData={formData}
                                setFormData={setFormData}
                                travelDataOld={travelDataOld}
                                isSuperAdmin={isSuperAdmin}
                                onSave={onManualSave}
                                showSaveButton={false}
                                showPreviewButton={false}
                                showPublishControls={false}
                                showCountries={false}
                                showCategories={true}
                                showCoverImage={false}
                                showAdditionalFields={false}
                            />
                        </GroupedFiltersSection>

                        {/* Группа 2: Время и сложность */}
                        <GroupedFiltersSection
                            group={{
                                id: 'timeComplexity',
                                title: 'Время и сложность',
                                iconName: 'calendar',
                                description: 'Лучшие месяцы для поездки и уровень сложности маршрута',
                                defaultExpanded: false,
                            }}
                            filledCount={groupsFilledCounts.timeComplexity}
                            totalCount={2}
                        >
                            <Text style={styles.groupHint}>
                                Помогите путешественникам понять, когда лучше ехать и насколько сложен маршрут
                            </Text>
                            <FiltersUpsertComponent
                                filters={filters}
                                formData={formData}
                                setFormData={setFormData}
                                travelDataOld={travelDataOld}
                                isSuperAdmin={isSuperAdmin}
                                onSave={onManualSave}
                                showSaveButton={false}
                                showPreviewButton={false}
                                showPublishControls={false}
                                showCountries={false}
                                showCategories={false}
                                showCoverImage={false}
                                showAdditionalFields={true}
                            />
                        </GroupedFiltersSection>

                        {/* Группа 3: Стиль путешествия */}
                        <GroupedFiltersSection
                            group={{
                                id: 'style',
                                title: 'Стиль путешествия',
                                iconName: 'users',
                                description: 'С кем ехать и где останавливаться',
                                defaultExpanded: false,
                            }}
                            filledCount={groupsFilledCounts.style}
                            totalCount={2}
                        >
                            <Text style={styles.groupHint}>
                                Информация о компаньонах и типах ночлега
                            </Text>
                        </GroupedFiltersSection>

                        {/* Группа 4: Практическая информация */}
                        <GroupedFiltersSection
                            group={{
                                id: 'practical',
                                title: 'Практическая информация',
                                iconName: 'file-text',
                                description: 'Виза, бюджет и другие важные детали',
                                defaultExpanded: false,
                            }}
                            filledCount={groupsFilledCounts.practical}
                            totalCount={1}
                        >
                            <Text style={styles.groupHint}>
                                Дополнительные практические детали для путешественников
                            </Text>
                        </GroupedFiltersSection>
                    </View>
                </ScrollView>

                <TravelWizardFooter
                    canGoBack={false}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'К публикации'}
                    onSave={onManualSave}
                    saveLabel="Сохранить"
                    primaryDisabled={false}
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
        backgroundColor: colors.background, // ✅ ДИЗАЙН: Динамический цвет фона
    },
    keyboardAvoid: { flex: 1 },
    validationSummaryWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 8,
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    groupHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: DESIGN_TOKENS.spacing.md,
        lineHeight: 20,
    },
});

export default React.memo(TravelWizardStepExtras);
