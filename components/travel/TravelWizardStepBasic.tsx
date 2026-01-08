import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';

import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import { TravelFormData } from '@/src/types/types';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidatedTextInput } from '@/components/travel/ValidatedTextInput';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { getContextualTips } from '@/utils/contextualTips';
import { useStepTransition } from '@/hooks/useStepTransition';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/src/utils/toast';

async function showToastMessage(payload: any) {
    await showToast(payload);
}

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const isMobileDefault = windowWidth <= METRICS.breakpoints.tablet;
const FILTERS_SCROLL_MAX_HEIGHT = windowHeight * 0.8;

interface TravelWizardStepBasicProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    isMobile?: boolean;
    onManualSave: () => Promise<TravelFormData | void>;
    snackbarVisible: boolean;
    snackbarMessage: string;
    onDismissSnackbar: () => void;
    onGoNext: () => void;
    stepErrors?: string[];
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    onStepSelect?: (step: number) => void;
    redirectDelayMs?: number;
    onPreview?: () => void;
}

const TravelWizardStepBasic: React.FC<TravelWizardStepBasicProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    isMobile = isMobileDefault,
    onManualSave,
    snackbarVisible,
    snackbarMessage,
    onDismissSnackbar,
    onGoNext,
    stepErrors: _stepErrors,
    firstErrorField,
    autosaveStatus,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
    stepMeta,
    progress = currentStep / totalSteps,
    onStepSelect,
    redirectDelayMs = 500,
    onPreview,
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const [hasUserEdited, setHasUserEdited] = useState(false);

    // ✅ ФАЗА 2: Анимация переходов
    const { animatedStyle: stepAnimatedStyle } = useStepTransition({
        duration: 350,
        fadeIn: true,
        slideIn: true,
    });

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

    // Валидация шага 1
    const validation = useMemo(() => {
        return validateStep(1, formData);
    }, [formData]);

    const shouldShowValidationSummary = (_stepErrors?.length ?? 0) > 0 || (hasUserEdited && validation.errors.length > 0);

    // ✅ ФАЗА 2: Контекстные подсказки
    const contextualTips = useMemo(() => {
        return getContextualTips(1, formData);
    }, [formData]);

    const contextualTipsBody = useMemo(() => {
        if (contextualTips.length === 0) return null;
        return contextualTips
            .map((tip) => `${tip.title}: ${tip.message}`)
            .join('\n\n');
    }, [contextualTips]);

    const handleFieldChange = useCallback((field: keyof TravelFormData, value: any) => {
        if (!hasUserEdited) {
            setHasUserEdited(true);
        }
        setFormData(prev => ({ ...prev, [field]: value }));
    }, [hasUserEdited, setFormData]);

    // ✅ НОВОЕ: Handler для быстрого черновика
    const handleQuickDraft = useCallback(async () => {
        // Проверяем минимальную валидацию (только название)
        const hasName = formData.name && formData.name.trim().length >= 3;

        if (!hasName) {
            void showToastMessage({
                type: 'error',
                text1: 'Заполните название',
                text2: 'Минимум 3 символа для сохранения черновика',
            });
            return;
        }

        try {
            // Сохраняем черновик
            await onManualSave();

            void showToastMessage({
                type: 'success',
                text1: 'Черновик сохранен',
                text2: 'Вы можете вернуться к нему позже',
            });

            // Переходим в список путешествий (с небольшой задержкой, как в тестах)
            setTimeout(() => {
                router.push('/metravel');
            }, redirectDelayMs);
        } catch (_error) {
            void showToastMessage({
                type: 'error',
                text1: 'Ошибка сохранения',
                text2: 'Попробуйте еще раз',
            });
        }
    }, [formData, onManualSave, redirectDelayMs, router]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    title={stepMeta?.title ?? 'О маршруте'}
                    subtitle={stepMeta?.subtitle ?? 'Укажите название и кратко опишите маршрут — это увидят в карточке и при публикации.'}
                    progressPercent={progressPercent}
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    onPrimary={onGoNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'Далее'}
                    onSave={onManualSave}
                    onQuickDraft={handleQuickDraft}
                    quickDraftLabel="Быстрый черновик"
                    tipTitle={contextualTipsBody ? 'Советы' : stepMeta?.tipTitle}
                    tipBody={contextualTipsBody ?? stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                />
                {shouldShowValidationSummary && !isMobile && (
                    <View style={styles.validationSummaryWrapper}>
                        <ValidationSummary
                            errorCount={validation.errors.length}
                            warningCount={validation.warnings.length}
                        />
                    </View>
                )}
                <View style={[styles.mainWrapper, isMobile && styles.mainWrapperMobile]}>
                    <ScrollView
                        style={styles.contentColumn}
                        contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Animated.View style={[styles.contentInner, stepAnimatedStyle]}>
                            <ValidatedTextInput
                                label="Название путешествия"
                                value={formData.name || ''}
                                onChange={(value) => handleFieldChange('name', value)}
                                fieldName="name"
                                step={1}
                                required
                                placeholder="Например: Неделя в Грузии"
                                hint="Краткое и понятное название, которое отражает суть маршрута"
                                nativeID="field-name"
                            />
                            
                            <ContentUpsertSection
                                formData={formData}
                                setFormData={setFormData}
                                firstErrorField={firstErrorField}
                                autosaveStatus={autosaveStatus}
                                focusAnchorId={focusAnchorId}
                                onAnchorHandled={onAnchorHandled}
                                visibleFields={['description']}
                                showProgress={false}
                            />
                        </Animated.View>
                    </ScrollView>
                </View>
                <Snackbar visible={snackbarVisible} onDismiss={onDismissSnackbar}>
                    {snackbarMessage}
                </Snackbar>

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
    mainWrapper: {
        flex: 1,
        flexDirection: 'row'
    },
    mainWrapperMobile: {
        flexDirection: 'column'
    },
    contentColumn: {
        flex: 1
    },
    filtersScroll: {
        maxHeight: FILTERS_SCROLL_MAX_HEIGHT
    },
    mobileFiltersWrapper: {
        padding: DESIGN_TOKENS.spacing.md
    },
    contentContainer: {
        paddingHorizontal: 8,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    validationSummaryWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    tipsContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
});

export default React.memo(TravelWizardStepBasic);
