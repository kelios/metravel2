import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Animated, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import type { TravelFormData } from '@/src/types/types';

interface UpsertTravelViewProps {
  controller: UpsertTravelController;
}

// Skeleton component for loading state
const WizardSkeleton = ({ colors }: { colors: UpsertTravelController['colors'] }) => {
  const pulseAnim = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const skeletonStyle = {
    opacity: pulseAnim,
    backgroundColor: colors.surfaceMuted,
  };

  return (
    <View style={{ flex: 1, padding: DESIGN_TOKENS.spacing.lg }}>
      {/* Header skeleton */}
      <Animated.View style={[{ height: 60, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.lg }, skeletonStyle]} />
      {/* Progress bar skeleton */}
      <Animated.View style={[{ height: 8, borderRadius: 4, marginBottom: DESIGN_TOKENS.spacing.xl }, skeletonStyle]} />
      {/* Content skeleton */}
      <Animated.View style={[{ height: 56, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.md }, skeletonStyle]} />
      <Animated.View style={[{ height: 120, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.md }, skeletonStyle]} />
      <Animated.View style={[{ height: 56, borderRadius: DESIGN_TOKENS.radii.md }, skeletonStyle]} />
    </View>
  );
};

// Offline indicator banner
const OfflineBanner = ({ colors, isVisible }: { colors: UpsertTravelController['colors']; isVisible: boolean }) => {
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, opacity]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: colors.warning,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Feather name="wifi-off" size={16} color={colors.textOnPrimary} />
      <Text style={{ color: colors.textOnPrimary, fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '500' }}>
        Нет соединения. Изменения будут сохранены при восстановлении сети.
      </Text>
    </Animated.View>
  );
};

// Step error fallback component
const StepErrorFallback = ({
  stepNumber,
  onGoBack,
  colors
}: {
  stepNumber: number;
  onGoBack?: () => void;
  colors: UpsertTravelController['colors'];
}) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: DESIGN_TOKENS.spacing.xl }}>
    <Feather name="alert-triangle" size={48} color={colors.warning} style={{ marginBottom: DESIGN_TOKENS.spacing.md }} />
    <Text style={{ fontSize: DESIGN_TOKENS.typography.sizes.lg, fontWeight: '600', color: colors.text, marginBottom: DESIGN_TOKENS.spacing.sm, textAlign: 'center' }}>
      Ошибка на шаге {stepNumber}
    </Text>
    <Text style={{ fontSize: DESIGN_TOKENS.typography.sizes.md, color: colors.textMuted, textAlign: 'center', marginBottom: DESIGN_TOKENS.spacing.lg }}>
      Произошла ошибка при отображении этого шага.
    </Text>
    {onGoBack && (
      <Pressable
        onPress={onGoBack}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
          borderRadius: DESIGN_TOKENS.radii.md,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel="Вернуться к предыдущему шагу"
      >
        <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
          Вернуться назад
        </Text>
      </Pressable>
    )}
  </View>
);

export default function UpsertTravelView({ controller }: UpsertTravelViewProps) {
  const { colors } = controller;
  const { setFormData } = controller;
  const { isDesktop, isTablet, isMobile } = useResponsive();

  // Offline detection
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const styles = useMemo(() => createStyles(colors, { isDesktop, isTablet, isMobile }), [colors, isDesktop, isTablet, isMobile]);

  const setFormDataDirect = useCallback(
    (next: TravelFormData) => {
      setFormData(next);
    },
    [setFormData]
  );

  // Handle step error - go to previous step
  const handleStepError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`Step ${controller.wizard.currentStep} error:`, error, errorInfo);
  }, [controller.wizard.currentStep]);

  if (controller.isInitialLoading) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.loading"
        accessibilityLabel="Загрузка формы путешествия"
        accessibilityRole="progressbar"
      >
        <WizardSkeleton colors={colors} />
      </SafeAreaView>
    );
  }

  if (!controller.hasAccess && !controller.isNew) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.no-access"
        accessibilityLabel="Нет доступа к редактированию"
      >
        <View style={styles.errorContainer}>
          <Feather name="lock" size={48} color={colors.danger} style={{ marginBottom: DESIGN_TOKENS.spacing.md }} />
          <Text style={styles.errorTitle}>Нет доступа</Text>
          <Text style={styles.errorText}>У вас нет прав для редактирования этого путешествия</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.isAuthenticated && controller.isNew) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.auth-required"
        accessibilityLabel="Требуется авторизация"
      >
        <View style={styles.errorContainer}>
          <Feather name="user" size={48} color={colors.primary} style={{ marginBottom: DESIGN_TOKENS.spacing.md }} />
          <Text style={styles.errorTitle}>Войдите в аккаунт</Text>
          <Text style={styles.errorText}>Чтобы создать путешествие, необходимо авторизоваться</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      testID="travel-upsert.root"
      accessibilityLabel="travel-upsert.root"
    >
      {controller.wizard.currentStep === 1 ? (
        <TravelWizardStepBasic
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          formData={controller.formData}
          setFormData={controller.setFormData}
          onManualSave={controller.handleManualSave}
          onGoNext={controller.wizard.handleNext}
          snackbarVisible={controller.autosave.status === 'error'}
          snackbarMessage={controller.autosave.error?.message || ''}
          onDismissSnackbar={controller.autosave.clearError}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
          stepErrors={controller.wizard.step1SubmitErrors.map(e => e.message)}
          onStepSelect={controller.wizard.handleStepSelect}
        />
      ) : null}

      {controller.wizard.currentStep === 2 ? (
        <TravelWizardStepRoute
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          markers={controller.markers}
          setMarkers={controller.setMarkers}
          categoryTravelAddress={controller.filters.categoryTravelAddress}
          countries={controller.filters.countries}
          travelId={controller.formData.id}
          selectedCountryIds={controller.formData.countries || []}
          onCountrySelect={controller.handleCountrySelect}
          onCountryDeselect={controller.handleCountryDeselect}
          onBack={controller.wizard.handleBack}
          onNext={controller.wizard.handleNext}
          onManualSave={controller.handleManualSave}
          isFiltersLoading={controller.isFiltersLoading}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
          focusAnchorId={controller.wizard.focusAnchorId}
          onAnchorHandled={controller.wizard.handleAnchorHandled}
          onStepSelect={controller.wizard.handleStepSelect}
        />
      ) : null}

      {controller.wizard.currentStep === 3 ? (
        <TravelWizardStepMedia
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          formData={controller.formData}
          setFormData={controller.setFormData}
          travelDataOld={controller.travelDataOld}
          onManualSave={controller.handleManualSave}
          onBack={controller.wizard.handleBack}
          onNext={controller.wizard.handleNext}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
          focusAnchorId={controller.wizard.focusAnchorId}
          onAnchorHandled={controller.wizard.handleAnchorHandled}
          onStepSelect={controller.wizard.handleStepSelect}
        />
      ) : null}

      {controller.wizard.currentStep === 4 ? (
        <TravelWizardStepDetails
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          formData={controller.formData}
          setFormData={controller.setFormData}
          onManualSave={controller.handleManualSave}
          onBack={controller.wizard.handleBack}
          onNext={controller.wizard.handleNext}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
          onStepSelect={controller.wizard.handleStepSelect}
        />
      ) : null}

      {controller.wizard.currentStep === 5 ? (
        <TravelWizardStepExtras
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          formData={controller.formData}
          setFormData={setFormDataDirect}
          filters={controller.filters}
          travelDataOld={controller.travelDataOld}
          isSuperAdmin={controller.isSuperAdmin}
          onManualSave={controller.handleManualSave}
          onBack={controller.wizard.handleBack}
          onNext={controller.wizard.handleNext}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
          focusAnchorId={controller.wizard.focusAnchorId}
          onAnchorHandled={controller.wizard.handleAnchorHandled}
          onStepSelect={controller.wizard.handleStepSelect}
        />
      ) : null}

      {controller.wizard.currentStep === 6 ? (
        <TravelWizardStepPublish
          currentStep={controller.wizard.currentStep}
          totalSteps={controller.wizard.totalSteps}
          formData={controller.formData}
          setFormData={setFormDataDirect}
          isSuperAdmin={controller.isSuperAdmin}
          onManualSave={controller.handleManualSave}
          onGoBack={controller.wizard.handleBack}
          onFinish={controller.wizard.handleFinishWizard}
          onNavigateToIssue={controller.wizard.handleNavigateToIssue}
          onStepSelect={controller.wizard.handleStepSelect}
          stepMeta={controller.currentStepMeta}
          progress={controller.progress}
          autosaveBadge={controller.autosaveBadge}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: UpsertTravelController['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.xl,
    },
    loadingText: {
      marginTop: DESIGN_TOKENS.spacing.md,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textMuted,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.xl,
    },
    errorText: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      color: colors.danger,
      textAlign: 'center',
    },
  });
