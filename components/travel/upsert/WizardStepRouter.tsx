import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import Feather from '@expo/vector-icons/Feather';
import { translate as i18nT } from '@/i18n'


type Colors = UpsertTravelController['colors'];
type Wizard = UpsertTravelController['wizard'];
type StepMeta = UpsertTravelController['currentStepMeta'];

export interface CommonStepProps {
  currentStep: number;
  totalSteps: number;
  formData: UpsertTravelController['formData'];
  onManualSave: UpsertTravelController['handleManualSave'];
  onPreview: () => void;
  onOpenPublic: () => void;
  onStepSelect: Wizard['handleStepSelect'];
  stepMeta: StepMeta;
  progress: number;
  autosaveBadge?: string;
  isSaveInFlight?: boolean;
  onExit: Wizard['handleExit'];
}

export interface StepNavigationProps {
  onBack: Wizard['handleBack'];
  onNext: Wizard['handleNext'];
  focusAnchorId: Wizard['focusAnchorId'];
  onAnchorHandled: Wizard['handleAnchorHandled'];
}

interface WizardStepRouterStyles {
  centeredScreen: StyleProp<ViewStyle>;
  iconSpacing: StyleProp<TextStyle>;
  errorTitle: StyleProp<TextStyle>;
  errorText: StyleProp<TextStyle>;
  actionRow: StyleProp<ViewStyle>;
  actionPrimary: StyleProp<ViewStyle>;
  actionPrimaryText: StyleProp<TextStyle>;
}

interface WizardStepRouterProps {
  controller: UpsertTravelController;
  commonStepProps: CommonStepProps;
  navigationProps: StepNavigationProps;
  colors: Colors;
  styles: WizardStepRouterStyles;
}

const StepErrorFallback = ({
  stepNumber,
  onBack,
  colors,
  styles,
}: {
  stepNumber: number;
  onBack?: () => void;
  colors: Colors;
  styles: WizardStepRouterStyles;
}) => {
  const actions = useMemo(
    () => onBack
      ? [{
          label: i18nT('travel:components.travel.upsert.WizardStepRouter.vernutsya_nazad_c7c25e40'),
          accessibilityLabel: i18nT('travel:components.travel.upsert.WizardStepRouter.vernutsya_k_predyduschemu_shagu_b49b6460'),
          onPress: onBack,
        }]
      : [],
    [onBack],
  );

  return (
    <View style={styles.centeredScreen}>
      <Feather name="alert-triangle" size={48} color={colors.warning} style={styles.iconSpacing} />
      <Text style={styles.errorTitle}>{i18nT('travel:components.travel.upsert.WizardStepRouter.oshibka_na_shage_1f45926b')}{stepNumber}</Text>
      <Text style={styles.errorText}>{i18nT('travel:components.travel.upsert.WizardStepRouter.proizoshla_oshibka_pri_otobrazhenii_etogo_sh_fa95b77d')}</Text>
      {actions.length > 0 && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={actions[0].onPress}
            style={styles.actionPrimary}
            accessibilityRole="button"
            accessibilityLabel={actions[0].accessibilityLabel}
          >
            <Text style={styles.actionPrimaryText}>{actions[0].label}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const WizardStepRouter = React.memo(function WizardStepRouter({
  controller,
  commonStepProps,
  navigationProps,
  colors,
  styles,
}: WizardStepRouterProps) {
  const { wizard } = controller;

  const handleStepError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      console.error(`Step ${wizard.currentStep} error:`, error, errorInfo);
    },
    [wizard.currentStep],
  );

  const activeStep = useMemo(() => {
    switch (wizard.currentStep) {
      case 1:
        return (
          <TravelWizardStepBasic
            {...commonStepProps}
            setFormData={controller.setFormData}
            onGoNext={wizard.handleNext}
            snackbarVisible={controller.autosave.status === 'error'}
            snackbarMessage={controller.autosave.error?.message || ''}
            onDismissSnackbar={controller.autosave.clearError}
            stepErrors={wizard.step1SubmitErrors.map((error) => error.message)}
            focusAnchorId={wizard.focusAnchorId}
            onAnchorHandled={wizard.handleAnchorHandled}
          />
        );
      case 2:
        return (
          <TravelWizardStepRoute
            {...commonStepProps}
            {...navigationProps}
            markers={controller.markers}
            setMarkers={controller.setMarkers}
            categoryTravelAddress={controller.filters.categoryTravelAddress}
            countries={controller.filters.countries}
            travelId={controller.formData.id}
            selectedCountryIds={controller.formData.countries || []}
            onCountrySelect={controller.handleCountrySelect}
            onCountryDeselect={controller.handleCountryDeselect}
            isFiltersLoading={controller.isFiltersLoading}
          />
        );
      case 3:
        return (
          <TravelWizardStepMedia
            {...commonStepProps}
            {...navigationProps}
            setFormData={controller.setFormData}
            travelDataOld={controller.travelDataOld}
          />
        );
      case 4:
        return (
          <TravelWizardStepDetails
            {...commonStepProps}
            {...navigationProps}
            setFormData={controller.setFormData}
          />
        );
      case 5:
        return (
          <TravelWizardStepExtras
            {...commonStepProps}
            {...navigationProps}
            setFormData={controller.setFormData}
            filters={controller.filters}
            travelDataOld={controller.travelDataOld}
            isSuperAdmin={controller.isSuperAdmin}
          />
        );
      case 6:
        return (
          <TravelWizardStepPublish
            {...commonStepProps}
            setFormData={controller.setFormData}
            countries={controller.filters.countries}
            isSuperAdmin={controller.isSuperAdmin}
            onGoBack={wizard.handleBack}
            onFinish={wizard.handleFinishWizard}
            onNavigateToIssue={wizard.handleNavigateToIssue}
          />
        );
      default:
        return null;
    }
  }, [commonStepProps, controller, navigationProps, wizard]);

  if (!activeStep) return null;

  return (
    <TravelFormErrorBoundary
      onError={handleStepError}
      fallback={
        <StepErrorFallback
          stepNumber={wizard.currentStep}
          onBack={wizard.currentStep > 1 ? wizard.handleBack : undefined}
          colors={colors}
          styles={styles}
        />
      }
    >
      {activeStep}
    </TravelFormErrorBoundary>
  );
});

export default WizardStepRouter;
