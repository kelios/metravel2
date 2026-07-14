import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Snackbar } from '@/ui/paper';

import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidatedTextInput } from '@/components/travel/ValidatedTextInput';
import { CollapsibleValidationSummary, ValidationSummary } from '@/components/travel/ValidationFeedback';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useStepTransition } from '@/hooks/useStepTransition';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelFormData } from '@/types/types';
import { getContextualTips } from '@/utils/contextualTips';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { showToastMessage } from '@/utils/toast';
import { validateStep } from '@/utils/travelWizardValidation';
import { buildQuickDraftRoute } from '@/utils/travelQuickDraftNavigation';

interface StepMeta {
  title?: string;
  subtitle?: string;
  tipTitle?: string;
  tipBody?: string;
  nextLabel?: string;
}

interface TravelWizardStepBasicProps {
  currentStep: number;
  totalSteps: number;
  formData: TravelFormData;
  setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
  onManualSave: () => Promise<TravelFormData | void>;
  snackbarVisible: boolean;
  snackbarMessage: string;
  onDismissSnackbar: () => void;
  onGoNext: () => void;
  stepErrors?: string[];
  firstErrorField?: string | null;
  autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  autosaveBadge?: string;
  isSaveInFlight?: boolean;
  focusAnchorId?: string | null;
  onAnchorHandled?: () => void;
  stepMeta?: StepMeta;
  progress?: number;
  onStepSelect?: (step: number) => void;
  redirectDelayMs?: number;
  onPreview?: () => void;
  onOpenPublic?: () => void;
  onExit?: () => void;
}

const EMPTY_ERRORS: string[] = [];
const MIN_DRAFT_NAME_LENGTH = 3;
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const DEFAULT_TITLE = 'О маршруте';
const DEFAULT_SUBTITLE = 'Укажите название и кратко опишите маршрут — это увидят в карточке и при публикации.';
const DEFAULT_NEXT_LABEL = 'Далее';

const getProgressPercent = (progress: number) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return Math.round(clampedProgress * 100);
};

const formatContextualTips = (formData: TravelFormData) => {
  const tips = getContextualTips(1, formData);
  if (tips.length === 0) return null;

  return tips.map((tip) => `${tip.title}: ${tip.message}`).join('\n\n');
};

function useFirstEditFlag() {
  const hasMarkedEditRef = useRef(false);
  const [hasEditedForm, setHasEditedForm] = useState(false);

  const markFormEdited = useCallback(() => {
    if (hasMarkedEditRef.current) return;
    hasMarkedEditRef.current = true;
    setHasEditedForm(true);
  }, []);

  return { hasEditedForm, markFormEdited };
}

function TravelWizardStepBasic({
  currentStep,
  totalSteps,
  formData,
  setFormData,
  onManualSave,
  snackbarVisible,
  snackbarMessage,
  onDismissSnackbar,
  onGoNext,
  stepErrors = EMPTY_ERRORS,
  firstErrorField,
  autosaveStatus,
  autosaveBadge,
  isSaveInFlight,
  focusAnchorId,
  onAnchorHandled,
  stepMeta,
  progress = currentStep / totalSteps,
  onStepSelect,
  redirectDelayMs = 250,
  onPreview,
  onOpenPublic,
  onExit,
}: TravelWizardStepBasicProps) {
  const colors = useThemedColors();
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const { hasEditedForm, markFormEdited } = useFirstEditFlag();
  const { animatedStyle: stepAnimatedStyle } = useStepTransition({
    duration: 350,
    fadeIn: true,
    slideIn: true,
  });

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCompactLayout = isPhone || isLargePhone;
  const progressPercent = getProgressPercent(progress);

  const validation = useMemo(() => validateStep(1, formData), [formData]);
  const validationMessages = useMemo(
    () => ({
      errorMessages: validation.errors.map((error) => error.message),
      warningMessages: validation.warnings.map((warning) => warning.message),
    }),
    [validation],
  );
  const contextualTipsBody = useMemo(() => formatContextualTips(formData), [formData]);

  const hasValidationErrors = validation.errors.length > 0;
  const hasSubmitAttemptErrors = stepErrors.length > 0;
  const shouldShowDesktopValidationSummary =
    !isCompactLayout && (hasSubmitAttemptErrors || (hasEditedForm && hasValidationErrors));
  const shouldShowMobileValidationSummary =
    isCompactLayout && hasSubmitAttemptErrors && hasValidationErrors;

  const setEditedFormData = useCallback<React.Dispatch<React.SetStateAction<TravelFormData>>>(
    (nextFormData) => {
      markFormEdited();
      setFormData(nextFormData);
    },
    [markFormEdited, setFormData],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      setEditedFormData((previousFormData) => ({ ...previousFormData, name }));
    },
    [setEditedFormData],
  );

  const handleQuickDraft = useCallback(async () => {
    const name = String(formData.name ?? '').trim();
    if (name.length < MIN_DRAFT_NAME_LENGTH) {
      void showToastMessage({
        type: 'error',
        text1: 'Заполните название',
        text2: 'Минимум 3 символа для сохранения черновика',
      });
      return;
    }

    try {
      const savedTravel = await onManualSave();
      void showToastMessage({
        type: 'success',
        text1: 'Черновик сохранен',
        text2: 'Вы можете вернуться к нему позже',
      });

      setTimeout(() => {
        router.push(buildQuickDraftRoute(savedTravel ?? null));
      }, redirectDelayMs);
    } catch (error) {
      if (!hasToastBeenShown(error)) {
        void showToastMessage({
          type: 'error',
          text1: 'Ошибка сохранения',
          text2: 'Попробуйте еще раз',
        });
      }
    }
  }, [formData.name, onManualSave, redirectDelayMs, router]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={0}
      >
        <TravelWizardHeader
          canGoBack={!!onExit}
          onBack={onExit}
          title={stepMeta?.title ?? DEFAULT_TITLE}
          subtitle={stepMeta?.subtitle ?? DEFAULT_SUBTITLE}
          progressPercent={progressPercent}
          errorCount={validation.errors.length}
          warningCount={validation.warnings.length}
          autosaveBadge={autosaveBadge}
          isSaveInFlight={isSaveInFlight}
          onPrimary={onGoNext}
          primaryLabel={stepMeta?.nextLabel ?? DEFAULT_NEXT_LABEL}
          onSave={onManualSave}
          onQuickDraft={handleQuickDraft}
          quickDraftLabel="Быстрый черновик"
          tipTitle={contextualTipsBody ? 'Советы' : stepMeta?.tipTitle}
          tipBody={contextualTipsBody ?? stepMeta?.tipBody}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onStepSelect={onStepSelect}
          onPreview={onPreview}
          onOpenPublic={onOpenPublic}
        />

        {(shouldShowDesktopValidationSummary || shouldShowMobileValidationSummary) && (
          <View
            style={styles.validationSummaryWrapper}
            accessibilityLiveRegion="polite"
            {...(Platform.OS === 'web' ? ({ 'aria-live': 'polite' } as any) : null)}
          >
            {shouldShowMobileValidationSummary ? (
              <CollapsibleValidationSummary
                errorCount={validation.errors.length}
                warningCount={validation.warnings.length}
                errorMessages={validationMessages.errorMessages}
                warningMessages={validationMessages.warningMessages}
              />
            ) : (
              <ValidationSummary
                errorCount={validation.errors.length}
                warningCount={validation.warnings.length}
                errorMessages={validationMessages.errorMessages}
                warningMessages={validationMessages.warningMessages}
              />
            )}
          </View>
        )}

        <View style={[styles.mainWrapper, isCompactLayout && styles.mainWrapperCompact]}>
          <ScrollView
            style={styles.contentColumn}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.contentInner, stepAnimatedStyle]}>
              <ValidatedTextInput
                label="Название путешествия"
                value={formData.name || ''}
                onChange={handleNameChange}
                fieldName="name"
                step={1}
                required
                placeholder="Например: Неделя в Грузии"
                hint="Краткое и понятное название, которое отражает суть маршрута"
                nativeID="field-name"
              />

              <ContentUpsertSection
                formData={formData}
                setFormData={setEditedFormData}
                onManualSave={onManualSave}
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
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  mainWrapperCompact: {
    flexDirection: 'column',
  },
  contentColumn: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
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
});

export default React.memo(TravelWizardStepBasic);
