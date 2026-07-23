import React, { useEffect, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, Text, StyleSheet, ScrollView, findNodeHandle, UIManager } from 'react-native';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import GroupedFiltersSection from '@/components/travel/GroupedFiltersSection';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { CollapsibleValidationSummary, ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData, Travel, type TravelFilters } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { useResponsive } from '@/hooks/useResponsive';
import { WIZARD_KEYBOARD_BEHAVIOR } from '@/components/travel/upsert/wizardKeyboard';
import WizardStepFooter from '@/components/travel/upsert/WizardStepFooter';
import { translate as i18nT } from '@/i18n'


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
    isSaveInFlight?: boolean;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    onStepSelect?: (step: number) => void;
    onPreview?: () => void;
    onOpenPublic?: () => void;
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
    isSaveInFlight,
    focusAnchorId,
    onAnchorHandled,
    onStepSelect,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

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

    // Stable field change handler
    const handleFieldChange = React.useCallback((field: keyof TravelFormData, value: any) => {
        if (typeof setFormData === 'function') {
            (setFormData as any)((prev: TravelFormData) => ({ ...prev, [field]: value }));
        }
    }, [setFormData]);

    // ✅ УЛУЧШЕНИЕ: Подсчет заполненных полей
    const groupsFilledCounts = useMemo(() => {
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

        // Категории показываем отдельным обязательным блоком выше, поэтому
        // счетчик группы считает только дополнительные параметры.
        const allFields = [
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
                behavior={WIZARD_KEYBOARD_BEHAVIOR}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? i18nT('travel:components.travel.TravelWizardStepExtras.defaultTitle')}
                    subtitle={stepMeta?.subtitle ?? i18nT('travel:common.stepProgress', { value1: currentStep, value2: totalSteps })}
                    progressPercent={progressPercent}
                    errorCount={validation.errors.length}
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    isSaveInFlight={isSaveInFlight}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? i18nT('travel:components.travel.TravelWizardStepExtras.defaultNext')}
                    onSave={onManualSave}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />
                {validation.warnings.length > 0 && (
                    <View style={styles.validationSummaryWrapper}>
                        {isMobile ? (
                            <CollapsibleValidationSummary
                                errorCount={validation.errors.length}
                                warningCount={validation.warnings.length}
                                errorMessages={validation.errors.map(e => e.message)}
                                warningMessages={validation.warnings.map(w => w.message)}
                            />
                        ) : (
                            <ValidationSummary
                                errorCount={validation.errors.length}
                                warningCount={validation.warnings.length}
                                errorMessages={validation.errors.map(e => e.message)}
                                warningMessages={validation.warnings.map(w => w.message)}
                            />
                        )}
                    </View>
                )}
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: DESIGN_TOKENS.spacing.xl }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <View ref={categoriesAnchorRef} nativeID="travelwizard-extras-categories" />

                        <View style={styles.requiredCard}>
                            <Text style={styles.requiredTitle}>{i18nT('travel:components.travel.TravelWizardStepExtras.obyazatelno_dlya_publikatsii_be1f0d43')}</Text>
                            <Text style={styles.requiredHint}>
                                {i18nT('travel:components.travel.TravelWizardStepExtras.vyberite_hotya_by_odnu_kategoriyu_bez_etogo__4fe1f249')}</Text>
                            <FiltersUpsertComponent
                                filters={filters}
                                formData={formData}
                                setFormData={setFormData}
                                onFieldChange={handleFieldChange}
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
                        </View>

                        {/* Группа 1: Категории и транспорт */}
                        <GroupedFiltersSection
                            group={{
                                id: 'main',
                                title: i18nT('travel:components.travel.TravelWizardStepExtras.dopolnitelnye_parametry_f23550b2'),
                                iconName: 'sliders',
                                description: i18nT('travel:components.travel.TravelWizardStepExtras.kategorii_transport_slozhnost_vremya_puteshe_2ede47d3'),
                                defaultExpanded: true,
                            }}
                            filledCount={groupsFilledCounts.main}
                            totalCount={10}
                        >
                            <FiltersUpsertComponent
                                filters={filters}
                                formData={formData}
                                setFormData={setFormData}
                                onFieldChange={handleFieldChange}
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
                    </View>
                </ScrollView>
                <WizardStepFooter
                    onBack={onBack}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? i18nT('travel:components.travel.TravelWizardStepExtras.defaultNext')}
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
    requiredCard: {
        marginBottom: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.warningLight,
        backgroundColor: colors.warningSoft,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    requiredTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    requiredHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        lineHeight: 20,
        color: colors.textMuted,
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
});

export default React.memo(TravelWizardStepExtras);
