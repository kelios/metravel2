import React, { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Text, ScrollView, findNodeHandle, UIManager } from 'react-native';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { CollapsibleValidationSummary, ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { translate as i18nT } from '@/i18n'


const ArticleEditor = lazy(() => import('@/components/article/ArticleEditor'));

interface TravelWizardStepDetailsProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    onBack: () => void;
    onNext: () => void;
    onManualSave?: () => Promise<TravelFormData | void>;
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

const TravelWizardStepDetails: React.FC<TravelWizardStepDetailsProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    onBack,
    onNext,
    onManualSave,
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
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const scrollRef = useRef<ScrollView | null>(null);
    const plusAnchorRef = useRef<View | null>(null);

    useEffect(() => {
        if (!focusAnchorId) return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = plusAnchorRef.current;
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

    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    // Optimized handler to prevent unnecessary re-renders of ArticleEditor
    const handleChange = React.useCallback((name: keyof TravelFormData, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }, [setFormData]);

    // Стабильные обработчики, чтобы тяжёлый lazy ArticleEditor не пере-рендерился из-за новой ссылки onChange.
    const handlePlusChange = React.useCallback((value: string) => handleChange('plus', value), [handleChange]);
    const handleMinusChange = React.useCallback((value: string) => handleChange('minus', value), [handleChange]);
    const handleRecommendationChange = React.useCallback(
        (value: string) => handleChange('recommendation', value),
        [handleChange],
    );

    const recommendationFieldsFilled = useMemo(() => {
        const keys: (keyof TravelFormData)[] = ['plus', 'minus', 'recommendation'];
        let filled = 0;
        keys.forEach(key => {
            const value = (formData as any)[key];
            if (Array.isArray(value)) {
                if (value.length > 0) filled += 1;
                return;
            }
            if (value && String(value).trim().length > 0) filled += 1;
        });
        return { filled, total: keys.length };
    }, [formData]);

    // Валидация шага 4 (опциональный, показываем только warnings)
    const validation = useMemo(() => {
        return validateStep(4, formData);
    }, [formData]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? i18nT('travel:components.travel.TravelWizardStepDetails.defaultTitle')}
                    subtitle={stepMeta?.subtitle ?? i18nT('travel:common.stepProgress', { value1: currentStep, value2: totalSteps })}
                    progressPercent={progressPercent}
                    errorCount={validation.errors.length}
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    isSaveInFlight={isSaveInFlight}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? i18nT('travel:components.travel.TravelWizardStepDetails.defaultNext')}
                    onSave={onManualSave}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />
                {(validation.warnings.length > 0 || validation.errors.length > 0) && (
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
                        <View style={styles.card}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.sectionTitle}>{i18nT('travel:components.travel.TravelWizardStepDetails.dlya_kogo_eto_puteshestvie_c1ebae55')}</Text>
                                <Text style={styles.progressValue}>
                                    {recommendationFieldsFilled.filled} {i18nT('travel:components.travel.TravelWizardStepDetails.iz_c59b2d5a')}{recommendationFieldsFilled.total}
                                </Text>
                            </View>
                            <Text style={styles.sectionHint}>
                                {i18nT('travel:components.travel.TravelWizardStepDetails.opishite_plyusy_i_minusy_marshruta_vashi_rek_6bb57742')}</Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>{i18nT('travel:components.travel.TravelWizardStepDetails.plyusy_bed5f443')}</Text>
                            <Suspense fallback={<Text style={styles.sectionHint}>{i18nT('travel:components.travel.TravelWizardStepDetails.zagruzka_redaktora_f3828df7')}</Text>}>
                                <ArticleEditor
                                    key={`plus-${idTravelStr ?? 'new'}`}
                                    label={i18nT('travel:components.travel.TravelWizardStepDetails.plyusy_bed5f443')}
                                    content={formData.plus ?? ''}
                                    onChange={handlePlusChange}
                                    idTravel={idTravelStr}
                                    variant="compact"
                                    chrome={isMobile ? 'mobile' : 'default'}
                                />
                            </Suspense>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>{i18nT('travel:components.travel.TravelWizardStepDetails.minusy_df05ea35')}</Text>
                            <Suspense fallback={<Text style={styles.sectionHint}>{i18nT('travel:components.travel.TravelWizardStepDetails.zagruzka_redaktora_f3828df7')}</Text>}>
                                <ArticleEditor
                                    key={`minus-${idTravelStr ?? 'new'}`}
                                    label={i18nT('travel:components.travel.TravelWizardStepDetails.minusy_df05ea35')}
                                    content={formData.minus ?? ''}
                                    onChange={handleMinusChange}
                                    idTravel={idTravelStr}
                                    variant="compact"
                                    chrome={isMobile ? 'mobile' : 'default'}
                                />
                            </Suspense>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>{i18nT('travel:components.travel.TravelWizardStepDetails.rekomendatsii_i_layfhaki_252b62ee')}</Text>
                            <Suspense fallback={<Text style={styles.sectionHint}>{i18nT('travel:components.travel.TravelWizardStepDetails.zagruzka_redaktora_f3828df7')}</Text>}>
                                <ArticleEditor
                                    key={`rec-${idTravelStr ?? 'new'}`}
                                    label={i18nT('travel:components.travel.TravelWizardStepDetails.rekomendatsii_4bf6a00a')}
                                    content={formData.recommendation ?? ''}
                                    onChange={handleRecommendationChange}
                                    idTravel={idTravelStr}
                                    variant="compact"
                                    chrome={isMobile ? 'mobile' : 'default'}
                                />
                            </Suspense>
                        </View>

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
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.primaryText,
        fontWeight: '700',
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
        overflow: 'hidden',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    editorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
});

export default React.memo(TravelWizardStepDetails);
