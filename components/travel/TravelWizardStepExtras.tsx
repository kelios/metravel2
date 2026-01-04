import React, { useEffect, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, ScrollView, findNodeHandle, UIManager } from 'react-native';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import GroupedFiltersSection from '@/components/travel/GroupedFiltersSection';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData, Travel, type TravelFilters } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема

interface TravelWizardStepExtrasProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    // ✅ FIX: Унифицированная сигнатура setFormData для совместимости с другими шагами
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>> | ((data: TravelFormData) => void);
    filters: TravelFilters;
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
    onPreview?: () => void;
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
    onPreview,
}) => {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

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

    // ✅ УЛУЧШЕНИЕ: Подсчет заполненных полей
    const groupsFilledCounts = useMemo(() => {
        const hasCategories = Array.isArray(formData.categories) && formData.categories.length > 0;
        const hasTransports = Array.isArray(formData.transports) && formData.transports.length > 0;
        const hasComplexity = Array.isArray(formData.complexity) && formData.complexity.length > 0;
        const hasCompanions = Array.isArray(formData.companions) && formData.companions.length > 0;
        const hasNightStay = Array.isArray(formData.over_nights_stay) && formData.over_nights_stay.length > 0;
        const hasMonths = Array.isArray(formData.month) && formData.month.length > 0;
        const hasYear = formData.year !== undefined && formData.year !== null && String(formData.year).trim().length > 0;
        const hasVisa = formData.visa !== undefined && formData.visa !== null;
        const hasBudget = formData.budget !== undefined && formData.budget !== null && String(formData.budget).trim().length > 0;
        const hasNumberPeoples =
            formData.number_peoples !== undefined &&
            formData.number_peoples !== null &&
            String(formData.number_peoples).trim().length > 0;
        const hasNumberDays =
            formData.number_days !== undefined &&
            formData.number_days !== null &&
            String(formData.number_days).trim().length > 0;

        // Все поля в одной группе (showAdditionalFields показывает все)
        const allFields = [
            hasCategories,
            hasTransports,
            hasComplexity,
            hasCompanions,
            hasNightStay,
            hasMonths,
            hasYear,
            hasVisa,
            hasBudget,
            hasNumberPeoples,
            hasNumberDays,
        ].filter(Boolean).length;

        return {
            main: allFields,
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
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'К публикации'}
                    onSave={onManualSave}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
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

                        {/* Группа 1: Категории и транспорт */}
                        <GroupedFiltersSection
                            group={{
                                id: 'main',
                                title: 'Дополнительные параметры',
                                iconName: 'sliders',
                                description: 'Категории, транспорт, сложность, время путешествия и другие детали',
                                defaultExpanded: true,
                            }}
                            filledCount={groupsFilledCounts.main}
                            totalCount={11}
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
                                showAdditionalFields={true}
                            />
                        </GroupedFiltersSection>
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
