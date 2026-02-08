import React, { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Text, ScrollView, findNodeHandle, UIManager } from 'react-native';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

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

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

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
                    warningCount={validation.warnings.length}
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
                    onOpenPublic={onOpenPublic}
                />
                {!isMobile && validation.warnings.length > 0 && (
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
                            <Suspense fallback={<Text style={styles.sectionHint}>Загрузка редактора…</Text>}>
                                <ArticleEditor
                                    key={`plus-${idTravelStr ?? 'new'}`}
                                    label="Плюсы"
                                    content={formData.plus ?? ''}
                                    onChange={(val: string) => handleChange('plus', val as any)}
                                    idTravel={idTravelStr}
                                    variant="compact"
                                />
                            </Suspense>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>Минусы</Text>
                            <Suspense fallback={<Text style={styles.sectionHint}>Загрузка редактора…</Text>}>
                                <ArticleEditor
                                    key={`minus-${idTravelStr ?? 'new'}`}
                                    label="Минусы"
                                    content={formData.minus ?? ''}
                                    onChange={(val: string) => handleChange('minus', val as any)}
                                    idTravel={idTravelStr}
                                    variant="compact"
                                />
                            </Suspense>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.editorLabel}>Рекомендации и лайфхаки</Text>
                            <Suspense fallback={<Text style={styles.sectionHint}>Загрузка редактора…</Text>}>
                                <ArticleEditor
                                    key={`rec-${idTravelStr ?? 'new'}`}
                                    label="Рекомендации"
                                    content={formData.recommendation ?? ''}
                                    onChange={(val: string) => handleChange('recommendation', val as any)}
                                    idTravel={idTravelStr}
                                    variant="compact"
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
    progressCardLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
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
