import React, { useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import {
  initFilters,
  normalizeCategoryTravelAddress,
  normalizeTravelCategories,
  useTravelFilters,
} from '@/hooks/useTravelFilters';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { useTravelWizard } from '@/hooks/useTravelWizard';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема

export { initFilters, normalizeCategoryTravelAddress, normalizeTravelCategories };

export default function UpsertTravel() {
  const { id } = useLocalSearchParams();
  const { userId, isAuthenticated, isSuperuser, authReady } = useAuth();
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const isSuperAdmin = isSuperuser;
  const isNew = !id;

  const {
    formData,
    setFormData,
    markers,
    setMarkers,
    travelDataOld,
    isInitialLoading,
    hasAccess,
    autosave,
    handleManualSave,
    handleCountrySelect,
    handleCountryDeselect,
  } = useTravelFormData({
    travelId: id as string | null,
    isNew,
    userId,
    isSuperAdmin,
    isAuthenticated,
    authReady,
  });

  const wizard = useTravelWizard({
    totalSteps: 6,
    hasUnsavedChanges: autosave.hasUnsavedChanges,
    canSave: autosave.canSave,
    onSave: handleManualSave,
  });

  const { filters, isLoading: isFiltersLoading } = useTravelFilters({
    loadOnMount: true,
    currentStep: wizard.currentStep,
  });

  const autosaveBadge = useMemo(() => {
    if (autosave.status === 'saving') return 'Сохранение...';
    if (autosave.status === 'saved') return 'Сохранено';
    if (autosave.status === 'error') return 'Ошибка сохранения';
    if (autosave.status === 'debouncing') return 'Ожидание...';
    return undefined;
  }, [autosave.status]);

  const progress = useMemo(() => {
    return wizard.currentStep / wizard.totalSteps;
  }, [wizard.currentStep, wizard.totalSteps]);

  const currentStepMeta = useMemo(() => {
    return wizard.stepConfig.find(s => s.id === wizard.currentStep);
  }, [wizard.currentStep, wizard.stepConfig]);

  // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasAccess && !isNew) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Нет доступа к редактированию</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated && isNew) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Войдите, чтобы создать путешествие</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {wizard.currentStep === 1 && (
        <TravelWizardStepBasic
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          formData={formData}
          setFormData={setFormData}
          onManualSave={handleManualSave}
          onGoNext={wizard.handleNext}
          snackbarVisible={autosave.status === 'error'}
          snackbarMessage={autosave.error?.message || ''}
          onDismissSnackbar={autosave.clearError}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
          stepErrors={wizard.step1SubmitErrors.map(e => e.message)}
          onStepSelect={wizard.handleStepSelect}
        />
      )}

      {wizard.currentStep === 2 && (
        <TravelWizardStepRoute
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          markers={markers}
          setMarkers={setMarkers}
          categoryTravelAddress={filters.categoryTravelAddress}
          countries={filters.countries}
          travelId={formData.id}
          selectedCountryIds={formData.countries || []}
          onCountrySelect={handleCountrySelect}
          onCountryDeselect={handleCountryDeselect}
          onBack={wizard.handleBack}
          onNext={wizard.handleNext}
          onManualSave={handleManualSave}
          isFiltersLoading={isFiltersLoading}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
          focusAnchorId={wizard.focusAnchorId}
          onAnchorHandled={wizard.handleAnchorHandled}
          onStepSelect={wizard.handleStepSelect}
        />
      )}

      {wizard.currentStep === 3 && (
        <TravelWizardStepMedia
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          formData={formData}
          setFormData={setFormData}
          travelDataOld={travelDataOld}
          onManualSave={handleManualSave}
          onBack={wizard.handleBack}
          onNext={wizard.handleNext}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
          focusAnchorId={wizard.focusAnchorId}
          onAnchorHandled={wizard.handleAnchorHandled}
          onStepSelect={wizard.handleStepSelect}
        />
      )}

      {wizard.currentStep === 4 && (
        <TravelWizardStepDetails
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          formData={formData}
          setFormData={setFormData}
          onManualSave={handleManualSave}
          onBack={wizard.handleBack}
          onNext={wizard.handleNext}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
          onStepSelect={wizard.handleStepSelect}
        />
      )}

      {wizard.currentStep === 5 && (
        <TravelWizardStepExtras
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          formData={formData}
          setFormData={setFormData}
          filters={filters}
          travelDataOld={travelDataOld}
          isSuperAdmin={isSuperAdmin}
          onManualSave={handleManualSave}
          onBack={wizard.handleBack}
          onNext={wizard.handleNext}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
          focusAnchorId={wizard.focusAnchorId}
          onAnchorHandled={wizard.handleAnchorHandled}
          onStepSelect={wizard.handleStepSelect}
        />
      )}

      {wizard.currentStep === 6 && (
        <TravelWizardStepPublish
          currentStep={wizard.currentStep}
          totalSteps={wizard.totalSteps}
          formData={formData}
          setFormData={setFormData}
          filters={filters}
          travelDataOld={travelDataOld}
          isSuperAdmin={isSuperAdmin}
          onManualSave={handleManualSave}
          onGoBack={wizard.handleBack}
          onFinish={wizard.handleFinishWizard}
          onNavigateToIssue={wizard.handleNavigateToIssue}
          onStepSelect={wizard.handleStepSelect}
          stepMeta={currentStepMeta}
          progress={progress}
          autosaveBadge={autosaveBadge}
        />
      )}
    </SafeAreaView>
  );
}

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
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
