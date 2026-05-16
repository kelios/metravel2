import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import DraftRecoveryDialog from '@/components/travel/DraftRecoveryDialog';
import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import TravelPreviewModal from '@/components/travel/TravelPreviewModal';
import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useTravelPreview } from '@/hooks/useTravelPreview';
import { buildLoginHref } from '@/utils/authNavigation';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

type Colors = UpsertTravelController['colors'];
type Styles = ReturnType<typeof createStyles>;
type Wizard = UpsertTravelController['wizard'];
type StepMeta = UpsertTravelController['currentStepMeta'];

interface UpsertTravelViewProps {
  controller: UpsertTravelController;
}

interface ResponsiveFlags {
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
}

interface WizardStateProps {
  colors: Colors;
  styles: Styles;
  router: ReturnType<typeof useRouter>;
}

interface EmptyStateAction {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  styles: Styles;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconColor: string;
  title: string;
  text: string;
  actions?: EmptyStateAction[];
  testID: string;
  accessibilityLabel: string;
}

interface CommonStepProps {
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
}

interface StepNavigationProps {
  onBack: Wizard['handleBack'];
  onNext: Wizard['handleNext'];
  focusAnchorId: Wizard['focusAnchorId'];
  onAnchorHandled: Wizard['handleAnchorHandled'];
}

interface ActiveWizardStepProps {
  controller: UpsertTravelController;
  commonStepProps: CommonStepProps;
  navigationProps: StepNavigationProps;
  colors: Colors;
  styles: Styles;
}

const WizardSkeleton = ({ colors }: { colors: Colors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const skeletonStyle = useMemo(
    () => ({ opacity: pulseAnim, backgroundColor: colors.surfaceMuted }),
    [colors.surfaceMuted, pulseAnim],
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={stylesStatic.skeletonContainer}>
      <Animated.View style={[stylesStatic.skeletonHeader, skeletonStyle]} />
      <Animated.View style={[stylesStatic.skeletonProgress, skeletonStyle]} />
      <Animated.View style={[stylesStatic.skeletonInput, skeletonStyle]} />
      <Animated.View style={[stylesStatic.skeletonBody, skeletonStyle]} />
      <Animated.View style={[stylesStatic.skeletonInput, skeletonStyle]} />
    </View>
  );
};

const OfflineBanner = ({ colors, isVisible }: { colors: Colors; isVisible: boolean }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isVisible, opacity]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        stylesStatic.offlineBanner,
        {
          opacity,
          backgroundColor: colors.warning,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Feather name="wifi-off" size={16} color={colors.textOnPrimary} />
      <Text style={[stylesStatic.offlineText, { color: colors.textOnPrimary }]}>
        Нет соединения. Изменения будут сохранены при восстановлении сети.
      </Text>
    </Animated.View>
  );
};

const EmptyStateScreen = ({
  styles,
  icon,
  iconColor,
  title,
  text,
  actions = [],
  testID,
  accessibilityLabel,
}: EmptyStateProps) => (
  <SafeAreaView style={styles.container} testID={testID} accessibilityLabel={accessibilityLabel}>
    <View style={styles.centeredScreen}>
      <Feather name={icon} size={48} color={iconColor} style={styles.iconSpacing} />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorText}>{text}</Text>

      {actions.length > 0 && (
        <View style={styles.actionRow}>
          {actions.map((action) => {
            const isPrimary = action.variant !== 'secondary';
            return (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={isPrimary ? styles.actionPrimary : styles.actionSecondary}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
              >
                <Text style={isPrimary ? styles.actionPrimaryText : styles.actionSecondaryText}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  </SafeAreaView>
);

const LoadingState = ({ colors, styles }: Pick<WizardStateProps, 'colors' | 'styles'>) => (
  <SafeAreaView
    style={styles.container}
    testID="travel-upsert.loading"
    accessibilityLabel="Загрузка формы путешествия"
    accessibilityRole="progressbar"
  >
    <WizardSkeleton colors={colors} />
  </SafeAreaView>
);

function getLoadErrorPresentation(status: number, message: string) {
  if (status === 0) {
    return { icon: 'wifi-off' as const, title: 'Нет соединения', text: message, iconTone: 'warning' as const };
  }

  if (status === 401) {
    return { icon: 'alert-triangle' as const, title: 'Требуется вход', text: 'Не удалось загрузить путешествие. Попробуйте ещё раз.', iconTone: 'danger' as const };
  }

  if (status === 403) {
    return { icon: 'alert-triangle' as const, title: 'Нет доступа', text: 'Не удалось загрузить путешествие. Попробуйте ещё раз.', iconTone: 'danger' as const };
  }

  if (status === 404) {
    return { icon: 'search' as const, title: 'Путешествие не найдено', text: 'Не удалось загрузить путешествие. Попробуйте ещё раз.', iconTone: 'danger' as const };
  }

  return { icon: 'alert-triangle' as const, title: 'Ошибка загрузки', text: 'Не удалось загрузить путешествие. Попробуйте ещё раз.', iconTone: 'danger' as const };
}

const LoadErrorState = ({
  controller,
  colors,
  styles,
  router,
}: WizardStateProps & { controller: UpsertTravelController }) => {
  const { status, message } = controller.loadError ?? { status: 0, message: '' };
  const presentation = getLoadErrorPresentation(status, message);
  const iconColor = presentation.iconTone === 'warning' ? colors.warning : colors.danger;

  const actions = useMemo<EmptyStateAction[]>(
    () => [
      ...(status === 401
        ? []
        : [{
            label: 'Повторить',
            accessibilityLabel: 'Повторить загрузку',
            onPress: () => {
              void controller.retryLoad();
            },
          }]),
      {
        label: 'На главную',
        accessibilityLabel: 'На главную',
        onPress: () => router.replace('/'),
        variant: 'secondary',
      },
    ],
    [controller, router, status],
  );

  return (
    <EmptyStateScreen
      styles={styles}
      icon={presentation.icon}
      iconColor={iconColor}
      title={presentation.title}
      text={presentation.text}
      actions={actions}
      testID="travel-upsert.load-error"
      accessibilityLabel="Ошибка загрузки путешествия"
    />
  );
};

const AccessDeniedState = ({ colors, styles }: Pick<WizardStateProps, 'colors' | 'styles'>) => (
  <EmptyStateScreen
    styles={styles}
    icon="lock"
    iconColor={colors.danger}
    title="Нет доступа"
    text="У вас нет прав для редактирования этого путешествия"
    testID="travel-upsert.no-access"
    accessibilityLabel="Нет доступа к редактированию"
  />
);

const AuthRequiredState = ({ colors, styles, router }: WizardStateProps) => {
  const actions = useMemo<EmptyStateAction[]>(
    () => [
      {
        label: 'Войти',
        accessibilityLabel: 'Войти и вернуться к созданию путешествия',
        onPress: () => router.push(buildLoginHref({ redirect: '/travel/new', intent: 'create-travel' }) as any),
      },
      {
        label: 'Зарегистрироваться',
        accessibilityLabel: 'Зарегистрироваться и вернуться к созданию путешествия',
        onPress: () => router.push('/registration?redirect=%2Ftravel%2Fnew&intent=create-travel' as any),
        variant: 'secondary',
      },
    ],
    [router],
  );

  return (
    <EmptyStateScreen
      styles={styles}
      icon="user"
      iconColor={colors.primary}
      title="Войдите в аккаунт"
      text="Чтобы создать путешествие, необходимо авторизоваться"
      actions={actions}
      testID="travel-upsert.auth-required"
      accessibilityLabel="Требуется авторизация"
    />
  );
};

const StepErrorFallback = ({
  stepNumber,
  onBack,
  colors,
  styles,
}: {
  stepNumber: number;
  onBack?: () => void;
  colors: Colors;
  styles: Styles;
}) => {
  const actions = useMemo<EmptyStateAction[]>(
    () => onBack
      ? [{
          label: 'Вернуться назад',
          accessibilityLabel: 'Вернуться к предыдущему шагу',
          onPress: onBack,
        }]
      : [],
    [onBack],
  );

  return (
    <View style={styles.centeredScreen}>
      <Feather name="alert-triangle" size={48} color={colors.warning} style={styles.iconSpacing} />
      <Text style={styles.errorTitle}>Ошибка на шаге {stepNumber}</Text>
      <Text style={styles.errorText}>Произошла ошибка при отображении этого шага.</Text>
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

function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextIsOffline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline((current) => (current === nextIsOffline ? current : nextIsOffline));
    });

    return unsubscribe;
  }, []);

  return isOffline;
}

function useResponsiveFlags(): ResponsiveFlags {
  const { isDesktop, isTablet, isMobile } = useResponsive();
  return useMemo(
    () => ({ isDesktop, isTablet, isMobile }),
    [isDesktop, isMobile, isTablet],
  );
}

const ActiveWizardStep = React.memo(function ActiveWizardStep({
  controller,
  commonStepProps,
  navigationProps,
  colors,
  styles,
}: ActiveWizardStepProps) {
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

export default function UpsertTravelView({ controller }: UpsertTravelViewProps) {
  const router = useRouter();
  const previewState = useTravelPreview();
  const responsive = useResponsiveFlags();
  const isOffline = useOfflineStatus();
  const { colors, wizard } = controller;

  const styles = useMemo(
    () => createStyles(colors, responsive),
    [colors, responsive],
  );

  const handleOpenPublic = useCallback(() => {
    const id = controller.formData?.id;
    if (!id) return;

    const path = `/travels/${encodeURIComponent(String(id))}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void openExternalUrlInNewTab(path, { allowRelative: true, baseUrl: window.location.origin });
      return;
    }

    router.push(path as any);
  }, [controller.formData?.id, router]);

  const commonStepProps = useMemo<CommonStepProps>(
    () => ({
      currentStep: wizard.currentStep,
      totalSteps: wizard.totalSteps,
      formData: controller.formData,
      onManualSave: controller.handleManualSave,
      onPreview: previewState.showPreview,
      onOpenPublic: handleOpenPublic,
      onStepSelect: wizard.handleStepSelect,
      stepMeta: controller.currentStepMeta,
      progress: controller.progress,
      autosaveBadge: controller.autosaveBadge,
    }),
    [
      controller.autosaveBadge,
      controller.currentStepMeta,
      controller.formData,
      controller.handleManualSave,
      controller.progress,
      handleOpenPublic,
      previewState.showPreview,
      wizard.currentStep,
      wizard.handleStepSelect,
      wizard.totalSteps,
    ],
  );

  const navigationProps = useMemo<StepNavigationProps>(
    () => ({
      onBack: wizard.handleBack,
      onNext: wizard.handleNext,
      focusAnchorId: wizard.focusAnchorId,
      onAnchorHandled: wizard.handleAnchorHandled,
    }),
    [wizard.focusAnchorId, wizard.handleAnchorHandled, wizard.handleBack, wizard.handleNext],
  );

  if (controller.isInitialLoading) {
    return <LoadingState colors={colors} styles={styles} />;
  }

  if (controller.loadError && !controller.isNew) {
    return <LoadErrorState controller={controller} colors={colors} styles={styles} router={router} />;
  }

  if (!controller.hasAccess && !controller.isNew) {
    return <AccessDeniedState colors={colors} styles={styles} />;
  }

  if (!controller.isAuthenticated && controller.isNew) {
    return <AuthRequiredState colors={colors} styles={styles} router={router} />;
  }

  return (
    <View style={styles.container} testID="travel-upsert.root" accessibilityLabel="Форма создания путешествия">
      <TravelPreviewModal
        visible={previewState.isPreviewVisible}
        onClose={previewState.hidePreview}
        formData={controller.formData}
      />

      <DraftRecoveryDialog
        visible={controller.draftRecovery.hasPendingDraft}
        draftTimestamp={controller.draftRecovery.draftTimestamp}
        onRecover={controller.draftRecovery.recoverDraft}
        onDiscard={controller.draftRecovery.dismissDraft}
        isRecovering={controller.draftRecovery.isRecovering}
      />

      <OfflineBanner colors={colors} isVisible={isOffline} />

      <ActiveWizardStep
        controller={controller}
        commonStepProps={commonStepProps}
        navigationProps={navigationProps}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.lg,
  },
  skeletonHeader: {
    height: 60,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  skeletonProgress: {
    height: 8,
    borderRadius: 4,
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  skeletonInput: {
    height: 56,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  skeletonBody: {
    height: 120,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  offlineBanner: {
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  offlineText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '500',
  },
});

const createStyles = (colors: Colors, responsive: ResponsiveFlags) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centeredScreen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.xl,
      maxWidth: responsive.isDesktop ? 480 : '100%',
      alignSelf: 'center',
      width: '100%',
    },
    iconSpacing: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    errorTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xl,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    errorText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
    },
    actionRow: {
      flexDirection: responsive.isMobile ? 'column' : 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.lg,
      width: responsive.isMobile ? '100%' : undefined,
      justifyContent: 'center',
    },
    actionPrimary: {
      backgroundColor: colors.primary,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionPrimaryText: {
      color: colors.textOnPrimary,
      fontWeight: '600',
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    actionSecondary: {
      backgroundColor: colors.surface,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionSecondaryText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
  });
