import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Text, ScrollView, LayoutChangeEvent } from 'react-native';

import ArticleEditor from '@/components/ArticleEditor';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
    onStepSelect?: (step: number) => void;
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
    onStepSelect,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 180;
    }, [footerHeight]);

    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    const handleChange = <T extends keyof TravelFormData>(name: T, value: TravelFormData[T]) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? 'Детали маршрута'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
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
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <View style={styles.card}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressCardLabel}>Рекомендационные поля</Text>
                                <Text style={styles.progressValue}>
                                    {recommendationFieldsFilled.filled} из {recommendationFieldsFilled.total} заполнено
                                </Text>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Для кого это путешествие</Text>
                            <Text style={styles.sectionHint}>
                                Опишите плюсы и минусы маршрута, ваши рекомендации и лайфхаки. Это повышает ценность путешествия для читателей.
                            </Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>Плюсы</Text>
                            <ArticleEditor
                                key={`plus-${idTravelStr ?? 'new'}`}
                                label="Плюсы"
                                content={formData.plus ?? ''}
                                onChange={val => handleChange('plus', val as any)}
                                idTravel={idTravelStr}
                                variant="compact"
                            />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>Минусы</Text>
                            <ArticleEditor
                                key={`minus-${idTravelStr ?? 'new'}`}
                                label="Минусы"
                                content={formData.minus ?? ''}
                                onChange={val => handleChange('minus', val as any)}
                                idTravel={idTravelStr}
                                variant="compact"
                            />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>Рекомендации и лайфхаки</Text>
                            <ArticleEditor
                                key={`rec-${idTravelStr ?? 'new'}`}
                                label="Рекомендации"
                                content={formData.recommendation ?? ''}
                                onChange={val => handleChange('recommendation', val as any)}
                                idTravel={idTravelStr}
                                variant="compact"
                            />
                        </View>

                    </View>
                </ScrollView>

                <TravelWizardFooter
                    canGoBack={true}
                    onBack={onBack}
                    onPrimary={onNext}
                    onSave={onManualSave}
                    saveLabel="Сохранить"
                    primaryLabel="К публикации"
                    onLayout={handleFooterLayout}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
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
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressCardLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    progressValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.primaryDark,
        fontWeight: '700',
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
        overflow: 'hidden',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    editorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 8,
    },
});

export default React.memo(TravelWizardStepDetails);
