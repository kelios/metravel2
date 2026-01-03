import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import type { TravelFormData } from '@/src/types/types';

interface UpsertTravelViewProps {
  controller: UpsertTravelController;
}

export default function UpsertTravelView({ controller }: UpsertTravelViewProps) {
  const { colors } = controller;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const setFormDataDirect = useCallback(
    (next: TravelFormData) => {
      controller.setFormData(next);
    },
    [controller.setFormData]
  );

  if (controller.isInitialLoading) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.loading"
        accessibilityLabel="travel-upsert.loading"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.hasAccess && !controller.isNew) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.no-access"
        accessibilityLabel="travel-upsert.no-access"
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Нет доступа к редактированию</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.isAuthenticated && controller.isNew) {
    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.auth-required"
        accessibilityLabel="travel-upsert.auth-required"
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Войдите, чтобы создать путешествие</Text>
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
