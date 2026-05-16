import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import DraftRecoveryDialog from '@/components/travel/DraftRecoveryDialog';
import TravelPreviewModal from '@/components/travel/TravelPreviewModal';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useTravelPreview } from '@/hooks/useTravelPreview';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { buildLoginHref } from '@/utils/authNavigation';

type Colors = UpsertTravelController['colors'];
type Styles = ReturnType<typeof createStyles>;

interface UpsertTravelViewProps {
  controller: UpsertTravelController;
}

const WizardSkeleton = ({ colors }: { colors: Colors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

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

  const skeletonStyle = { opacity: pulseAnim, backgroundColor: colors.surfaceMuted };

  return (
    <View style={{ flex: 1, padding: DESIGN_TOKENS.spacing.lg }}>
      <Animated.View style={[{ height: 60, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.lg }, skeletonStyle]} />
      <Animated.View style={[{ height: 8, borderRadius: 4, marginBottom: DESIGN_TOKENS.spacing.xl }, skeletonStyle]} />
      <Animated.View style={[{ height: 56, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.md }, skeletonStyle]} />
      <Animated.View style={[{ height: 120, borderRadius: DESIGN_TOKENS.radii.md, marginBottom: DESIGN_TOKENS.spacing.md }, skeletonStyle]} />
      <Animated.View style={[{ height: 56, borderRadius: DESIGN_TOKENS.radii.md }, skeletonStyle]} />
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

const StepErrorFallback = ({
  stepNumber,
  onGoBack,
  colors,
  styles,
}: {
  stepNumber: number;
  onGoBack?: () => void;
  colors: Colors;
  styles: Styles;
}) => (
  <View style={styles.centeredScreen}>
    <Feather name="alert-triangle" size={48} color={colors.warning} style={styles.iconSpacing} />
    <Text style={styles.errorTitle}>Ошибка на шаге {stepNumber}</Text>
    <Text style={styles.errorText}>Произошла ошибка при отображении этого шага.</Text>
    {onGoBack && (
      <Pressable
        onPress={onGoBack}
        style={[styles.actionPrimary, { marginTop: DESIGN_TOKENS.spacing.lg }]}
        accessibilityRole="button"
        accessibilityLabel="Вернуться к предыдущему шагу"
      >
        <Text style={styles.actionPrimaryText}>Вернуться назад</Text>
      </Pressable>
    )}
  </View>
);

// Презентация ошибки загрузки по HTTP-статусу.
function getLoadErrorPresentation(status: number, message: string) {
  const icon: React.ComponentProps<typeof Feather>['name'] =
    status === 0 ? 'wifi-off' : status === 404 ? 'search' : 'alert-triangle';
  const title =
    status === 401 ? 'Требуется вход'
      : status === 403 ? 'Нет доступа'
        : status === 404 ? 'Путешествие не найдено'
          : status === 0 ? 'Нет соединения'
            : 'Ошибка загрузки';
  const text = status === 0 ? message : 'Не удалось загрузить путешествие. Попробуйте ещё раз.';
  return { icon, title, text };
}

export default function UpsertTravelView({ controller }: UpsertTravelViewProps) {
  const { colors, setFormData } = controller;
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const previewState = useTravelPreview();
  const router = useRouter();

  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isConnected` / `isInternetReachable` могут быть null при первом событии.
      // Считаем "неизвестно" онлайном, чтобы баннер не мигал на маунте.
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    return () => unsubscribe();
  }, []);

  const styles = useMemo(
    () => createStyles(colors, { isDesktop, isTablet, isMobile }),
    [colors, isDesktop, isTablet, isMobile],
  );

  const handleStepError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      console.error(`Step ${controller.wizard.currentStep} error:`, error, errorInfo);
    },
    [controller.wizard.currentStep],
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

  if (controller.loadError && !controller.isNew) {
    const { status, message } = controller.loadError;
    const { icon, title, text } = getLoadErrorPresentation(status, message);

    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.load-error"
        accessibilityLabel="Ошибка загрузки путешествия"
      >
        <View style={styles.centeredScreen}>
          <Feather
            name={icon}
            size={48}
            color={status === 0 ? colors.warning : colors.danger}
            style={styles.iconSpacing}
          />
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorText}>{text}</Text>

          <View style={styles.actionRow}>
            {status !== 401 && (
              <Pressable
                onPress={() => controller.retryLoad()}
                style={styles.actionPrimary}
                accessibilityRole="button"
                accessibilityLabel="Повторить загрузку"
              >
                <Text style={styles.actionPrimaryText}>Повторить</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.replace('/')}
              style={styles.actionSecondary}
              accessibilityRole="button"
              accessibilityLabel="На главную"
            >
              <Text style={styles.actionSecondaryText}>На главную</Text>
            </Pressable>
          </View>
        </View>
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
        <View style={styles.centeredScreen}>
          <Feather name="lock" size={48} color={colors.danger} style={styles.iconSpacing} />
          <Text style={styles.errorTitle}>Нет доступа</Text>
          <Text style={styles.errorText}>У вас нет прав для редактирования этого путешествия</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.isAuthenticated && controller.isNew) {
    const loginHref = buildLoginHref({ redirect: '/travel/new', intent: 'create-travel' });
    const registrationHref = '/registration?redirect=%2Ftravel%2Fnew&intent=create-travel';

    return (
      <SafeAreaView
        style={styles.container}
        testID="travel-upsert.auth-required"
        accessibilityLabel="Требуется авторизация"
      >
        <View style={styles.centeredScreen}>
          <Feather name="user" size={48} color={colors.primary} style={styles.iconSpacing} />
          <Text style={styles.errorTitle}>Войдите в аккаунт</Text>
          <Text style={styles.errorText}>Чтобы создать путешествие, необходимо авторизоваться</Text>
          <View style={styles.authActions}>
            <Pressable
              onPress={() => router.push(loginHref as any)}
              style={styles.authPrimaryButton}
              accessibilityRole="button"
              accessibilityLabel="Войти и вернуться к созданию путешествия"
            >
              <Text style={styles.authPrimaryButtonText}>Войти</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(registrationHref as any)}
              style={styles.authSecondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Зарегистрироваться и вернуться к созданию путешествия"
            >
              <Text style={styles.authSecondaryButtonText}>Зарегистрироваться</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { wizard } = controller;

  // Пропсы, общие для всех шагов.
  const commonStepProps = {
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
  };

  // Навигация назад/вперёд + якорь фокуса (шаги 2–5).
  const stepNavProps = {
    onBack: wizard.handleBack,
    onNext: wizard.handleNext,
    focusAnchorId: wizard.focusAnchorId,
    onAnchorHandled: wizard.handleAnchorHandled,
  };

  const renderStep = (stepNumber: number, node: React.ReactNode, canGoBack: boolean) => (
    <TravelFormErrorBoundary
      onError={handleStepError}
      fallback={
        <StepErrorFallback
          stepNumber={stepNumber}
          onGoBack={canGoBack ? wizard.handleBack : undefined}
          colors={colors}
          styles={styles}
        />
      }
    >
      {node}
    </TravelFormErrorBoundary>
  );

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

      {wizard.currentStep === 1 &&
        renderStep(
          1,
          <TravelWizardStepBasic
            {...commonStepProps}
            setFormData={setFormData}
            onGoNext={wizard.handleNext}
            snackbarVisible={controller.autosave.status === 'error'}
            snackbarMessage={controller.autosave.error?.message || ''}
            onDismissSnackbar={controller.autosave.clearError}
            stepErrors={wizard.step1SubmitErrors.map((e) => e.message)}
            focusAnchorId={wizard.focusAnchorId}
            onAnchorHandled={wizard.handleAnchorHandled}
          />,
          false,
        )}

      {wizard.currentStep === 2 &&
        renderStep(
          2,
          <TravelWizardStepRoute
            {...commonStepProps}
            {...stepNavProps}
            markers={controller.markers}
            setMarkers={controller.setMarkers}
            categoryTravelAddress={controller.filters.categoryTravelAddress}
            countries={controller.filters.countries}
            travelId={controller.formData.id}
            selectedCountryIds={controller.formData.countries || []}
            onCountrySelect={controller.handleCountrySelect}
            onCountryDeselect={controller.handleCountryDeselect}
            isFiltersLoading={controller.isFiltersLoading}
          />,
          true,
        )}

      {wizard.currentStep === 3 &&
        renderStep(
          3,
          <TravelWizardStepMedia
            {...commonStepProps}
            {...stepNavProps}
            setFormData={setFormData}
            travelDataOld={controller.travelDataOld}
          />,
          true,
        )}

      {wizard.currentStep === 4 &&
        renderStep(
          4,
          <TravelWizardStepDetails
            {...commonStepProps}
            {...stepNavProps}
            setFormData={setFormData}
          />,
          true,
        )}

      {wizard.currentStep === 5 &&
        renderStep(
          5,
          <TravelWizardStepExtras
            {...commonStepProps}
            {...stepNavProps}
            setFormData={setFormData}
            filters={controller.filters}
            travelDataOld={controller.travelDataOld}
            isSuperAdmin={controller.isSuperAdmin}
          />,
          true,
        )}

      {wizard.currentStep === 6 &&
        renderStep(
          6,
          <TravelWizardStepPublish
            {...commonStepProps}
            setFormData={setFormData}
            countries={controller.filters.countries}
            isSuperAdmin={controller.isSuperAdmin}
            onGoBack={wizard.handleBack}
            onFinish={wizard.handleFinishWizard}
            onNavigateToIssue={wizard.handleNavigateToIssue}
          />,
          true,
        )}
    </View>
  );
}

const createStyles = (
  colors: Colors,
  responsive?: { isDesktop: boolean; isTablet: boolean; isMobile: boolean },
) =>
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
      maxWidth: responsive?.isDesktop ? 480 : '100%',
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
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.lg,
    },
    actionPrimary: {
      backgroundColor: colors.primary,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      justifyContent: 'center',
    },
    actionPrimaryText: {
      color: colors.textOnPrimary,
      fontWeight: '600',
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
    },
    actionSecondaryText: {
      color: colors.text,
      fontWeight: '600',
    },
    authActions: {
      flexDirection: responsive?.isMobile ? 'column' : 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.lg,
      width: '100%',
      justifyContent: 'center',
    },
    authPrimaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    authPrimaryButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '600',
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    authSecondaryButton: {
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
    authSecondaryButtonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
  });
