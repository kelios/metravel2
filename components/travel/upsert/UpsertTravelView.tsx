import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { getErrorStatus } from '@/api/parsers/apiResponseParser';
import DraftRecoveryDialog from '@/components/travel/DraftRecoveryDialog';
import TravelPreviewModal from '@/components/travel/TravelPreviewModal';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import WizardExitDialog from '@/components/travel/upsert/WizardExitDialog';
import WizardSkeleton from '@/components/travel/upsert/WizardSkeleton';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import WizardStepRouter, {
  type CommonStepProps,
  type StepNavigationProps,
} from '@/components/travel/upsert/WizardStepRouter';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTravelPreview } from '@/hooks/useTravelPreview';
import { buildLoginHref } from '@/utils/authNavigation';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import {
  trackContentCreateAuthGateViewed,
  trackContentCreateCtaClicked,
  trackRouteCreateStarted,
} from '@/utils/growthFunnelAnalytics';
import { translate as i18nT } from '@/i18n'


type Colors = UpsertTravelController['colors'];
type Styles = ReturnType<typeof createStyles>;

interface UpsertTravelViewProps {
  controller: UpsertTravelController;
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
  variant?: 'default' | 'error';
}

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
        {i18nT('travel:components.travel.upsert.UpsertTravelView.net_soedineniya_izmeneniya_budut_sohraneny_p_8ccb9a42')}</Text>
    </Animated.View>
  );
};

const SafetyBanner = ({
  colors,
  icon,
  message,
  tone,
  action,
}: {
  colors: Colors;
  icon: React.ComponentProps<typeof Feather>['name'];
  message: string;
  tone: 'warning' | 'danger';
  action?: { label: string; onPress: () => void };
}) => {
  const isDanger = tone === 'danger';
  const foreground = isDanger ? colors.dangerDark : colors.warningDark;
  return (
    <View
      style={[
        stylesStatic.safetyBanner,
        {
          backgroundColor: isDanger ? colors.dangerSoft : colors.warningSoft,
          borderColor: isDanger ? colors.dangerLight : colors.warningLight,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Feather name={icon} size={18} color={foreground} />
      <Text style={[stylesStatic.safetyText, { color: foreground }]}>{message}</Text>
      {action ? (
        <Button
          label={action.label}
          accessibilityLabel={action.label}
          variant={isDanger ? 'danger-outline' : 'outline'}
          size="sm"
          onPress={action.onPress}
        />
      ) : null}
    </View>
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
  variant = 'default',
}: EmptyStateProps) => (
  <SafeAreaView style={styles.container} testID={testID} accessibilityLabel={accessibilityLabel}>
    <EmptyState
      icon={icon}
      iconSize={48}
      iconColor={iconColor}
      title={title}
      description={text}
      variant={variant}
      action={actions[0] ? {
        label: actions[0].label,
        accessibilityLabel: actions[0].accessibilityLabel,
        onPress: actions[0].onPress,
      } : undefined}
      secondaryAction={actions[1] ? {
        label: actions[1].label,
        accessibilityLabel: actions[1].accessibilityLabel,
        onPress: actions[1].onPress,
      } : undefined}
    />
  </SafeAreaView>
);

const LoadingState = ({ colors, styles }: Pick<WizardStateProps, 'colors' | 'styles'>) => (
  <SafeAreaView
    style={styles.container}
    testID="travel-upsert.loading"
    accessibilityLabel={i18nT('travel:components.travel.upsert.UpsertTravelView.zagruzka_formy_puteshestviya_be0c252f')}
    accessibilityRole="progressbar"
  >
    <WizardSkeleton colors={colors} />
  </SafeAreaView>
);

function getLoadErrorPresentation(status: number, message: string) {
  if (status === 0) {
    return {
      icon: 'wifi-off' as const,
      title: i18nT('travel:components.travel.upsert.UpsertTravelView.net_soedineniya_1863032c'),
      text: message || i18nT('travel:components.travel.upsert.UpsertTravelView.networkFallback'),
      iconTone: 'warning' as const,
    };
  }

  if (status === 401) {
    return {
      icon: 'user' as const,
      title: i18nT('travel:components.travel.upsert.UpsertTravelView.trebuetsya_vhod_ee20c335'),
      text: i18nT('travel:components.travel.upsert.UpsertTravelView.sessiya_istekla_voydite_v_akkaunt_chtoby_pro_00f92c37'),
      iconTone: 'danger' as const,
    };
  }

  if (status === 403) {
    return {
      icon: 'lock' as const,
      title: i18nT('travel:components.travel.upsert.UpsertTravelView.net_dostupa_bec84f1f'),
      text: i18nT('travel:components.travel.upsert.UpsertTravelView.u_vas_net_prav_dlya_prosmotra_ili_redaktirov_21f0ac91'),
      iconTone: 'danger' as const,
    };
  }

  if (status === 404) {
    return {
      icon: 'search' as const,
      title: i18nT('travel:components.travel.upsert.UpsertTravelView.puteshestvie_ne_naydeno_34012fc6'),
      text: i18nT('travel:components.travel.upsert.UpsertTravelView.vozmozhno_ono_bylo_udaleno_ili_ssylka_ukazan_744b13de'),
      iconTone: 'danger' as const,
    };
  }

  return {
    icon: 'alert-triangle' as const,
    title: i18nT('travel:components.travel.upsert.UpsertTravelView.oshibka_zagruzki_b06e01d2'),
    text: i18nT('travel:components.travel.upsert.UpsertTravelView.ne_udalos_zagruzit_puteshestvie_poprobuyte_e_b1a6e514'),
    iconTone: 'danger' as const,
  };
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

  const actions = useMemo<EmptyStateAction[]>(() => {
    const homeAction: EmptyStateAction = {
      label: i18nT('travel:components.travel.upsert.UpsertTravelView.na_glavnuyu_a74dd9c6'),
      accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.pereyti_na_glavnuyu_2b3a1289'),
      onPress: () => router.replace('/'),
      variant: 'secondary',
    };

    if (status === 401) {
      return [
        {
          label: i18nT('travel:components.travel.upsert.UpsertTravelView.voyti_c3df4ff8'),
          accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.voyti_v_akkaunt_3949bf3b'),
          onPress: () => router.push(buildLoginHref({ redirect: '/metravel' }) as any),
        },
        homeAction,
      ];
    }

    if (status === 403) {
      return [
        {
          label: i18nT('travel:components.travel.upsert.UpsertTravelView.moi_puteshestviya_0814f31a'),
          accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.pereyti_k_moim_puteshestviyam_dbf10167'),
          onPress: () => router.replace('/metravel'),
        },
        homeAction,
      ];
    }

    if (status === 404) {
      return [
        {
          label: i18nT('travel:components.travel.upsert.UpsertTravelView.moi_puteshestviya_0814f31a'),
          accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.pereyti_k_moim_puteshestviyam_dbf10167'),
          onPress: () => router.replace('/metravel'),
        },
        homeAction,
      ];
    }

    return [
      {
        label: i18nT('travel:components.travel.upsert.UpsertTravelView.povtorit_8b05356c'),
        accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.povtorit_zagruzku_00e4bf94'),
        onPress: () => {
          void controller.retryLoad();
        },
      },
      homeAction,
    ];
  }, [controller, router, status]);

  return (
    <EmptyStateScreen
      styles={styles}
      icon={presentation.icon}
      iconColor={iconColor}
      title={presentation.title}
      text={presentation.text}
      actions={actions}
      testID="travel-upsert.load-error"
      accessibilityLabel={i18nT('travel:components.travel.upsert.UpsertTravelView.oshibka_zagruzki_puteshestviya_a6e2e4bd')}
      variant={presentation.iconTone === 'danger' ? 'error' : 'default'}
    />
  );
};

const AccessDeniedState = ({ colors, styles, router }: WizardStateProps) => {
  const actions = useMemo<EmptyStateAction[]>(
    () => [
      {
        label: i18nT('travel:components.travel.upsert.UpsertTravelView.moi_puteshestviya_0814f31a'),
        accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.pereyti_k_moim_puteshestviyam_dbf10167'),
        onPress: () => router.replace('/metravel'),
      },
      {
        label: i18nT('travel:components.travel.upsert.UpsertTravelView.na_glavnuyu_a74dd9c6'),
        accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.pereyti_na_glavnuyu_2b3a1289'),
        onPress: () => router.replace('/'),
        variant: 'secondary',
      },
    ],
    [router],
  );

  return (
    <EmptyStateScreen
      styles={styles}
      icon="lock"
      iconColor={colors.danger}
      title={i18nT('travel:components.travel.upsert.UpsertTravelView.net_dostupa_bec84f1f')}
      text={i18nT('travel:components.travel.upsert.UpsertTravelView.u_vas_net_prav_dlya_redaktirovaniya_etogo_pu_3591beab')}
      actions={actions}
      testID="travel-upsert.no-access"
      accessibilityLabel={i18nT('travel:components.travel.upsert.UpsertTravelView.net_dostupa_k_redaktirovaniyu_736d7f48')}
      variant="error"
    />
  );
};

const AuthRequiredState = ({ colors, styles, router }: WizardStateProps) => {
  useEffect(() => {
    trackContentCreateAuthGateViewed({
      contentType: 'route',
      source: 'travel_new_auth_gate',
      intent: 'create-travel',
    });
  }, []);

  const handleLogin = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'travel_new_auth_gate',
      authState: 'guest',
      intent: 'create-travel',
      action: 'login',
    });
    router.push(buildLoginHref({ redirect: '/travel/new', intent: 'create-travel' }) as any);
  }, [router]);

  const handleRegister = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'travel_new_auth_gate',
      authState: 'guest',
      intent: 'create-travel',
      action: 'register',
    });
    router.push('/registration?redirect=%2Ftravel%2Fnew&intent=create-travel' as any);
  }, [router]);

  const actions = useMemo<EmptyStateAction[]>(
    () => [
      {
        label: i18nT('travel:components.travel.upsert.UpsertTravelView.voyti_c3df4ff8'),
        accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.voyti_i_vernutsya_k_sozdaniyu_puteshestviya_0d72d24e'),
        onPress: handleLogin,
      },
      {
        label: i18nT('travel:components.travel.upsert.UpsertTravelView.zaregistrirovatsya_f73884d3'),
        accessibilityLabel: i18nT('travel:components.travel.upsert.UpsertTravelView.zaregistrirovatsya_i_vernutsya_k_sozdaniyu_p_f69508ae'),
        onPress: handleRegister,
        variant: 'secondary',
      },
    ],
    [handleLogin, handleRegister],
  );

  return (
    <EmptyStateScreen
      styles={styles}
      icon="user"
      iconColor={colors.primary}
      title={i18nT('travel:components.travel.upsert.UpsertTravelView.voydite_v_akkaunt_1415b7c7')}
      text={i18nT('travel:components.travel.upsert.UpsertTravelView.chtoby_sozdat_puteshestvie_neobhodimo_avtori_53cdc1ec')}
      actions={actions}
      testID="travel-upsert.auth-required"
      accessibilityLabel={i18nT('travel:components.travel.upsert.UpsertTravelView.trebuetsya_avtorizatsiya_2dcb6c96')}
    />
  );
};

export default function UpsertTravelView({ controller }: UpsertTravelViewProps) {
  const router = useRouter();
  const previewState = useTravelPreview();
  const isOffline = !controller.autosave.isOnline;
  const { colors, wizard } = controller;
  const hasTrackedRouteCreateStartedRef = useRef(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (hasTrackedRouteCreateStartedRef.current) return;
    if (controller.isInitialLoading) return;
    if (!controller.isNew || !controller.isAuthenticated) return;

    hasTrackedRouteCreateStartedRef.current = true;
    trackRouteCreateStarted({
      source: 'travel_new',
      travelId: controller.formData?.id,
      step: wizard.currentStep,
    });
  }, [
    controller.formData?.id,
    controller.isAuthenticated,
    controller.isInitialLoading,
    controller.isNew,
    wizard.currentStep,
  ]);

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

  const handleSessionLogin = useCallback(async () => {
    const draftSaved = await controller.draftRecovery.flushDraft();
    if (!draftSaved) return;
    const id = controller.formData?.id;
    const redirect = id ? `/travel/${encodeURIComponent(String(id))}` : '/travel/new';
    router.push(buildLoginHref({ redirect, intent: 'edit-travel' }) as any);
  }, [controller.draftRecovery, controller.formData?.id, router]);

  const isSessionExpired = getErrorStatus(controller.autosave.error) === 401;

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
      isSaveInFlight: controller.isManualSaveInFlight,
      onExit: wizard.handleExit,
    }),
    [
      controller.autosaveBadge,
      controller.currentStepMeta,
      controller.formData,
      controller.handleManualSave,
      controller.isManualSaveInFlight,
      controller.progress,
      handleOpenPublic,
      previewState.showPreview,
      wizard.currentStep,
      wizard.handleStepSelect,
      wizard.handleExit,
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
    return <AccessDeniedState colors={colors} styles={styles} router={router} />;
  }

  if (!controller.isAuthenticated && controller.isNew) {
    return <AuthRequiredState colors={colors} styles={styles} router={router} />;
  }

  return (
    <View style={styles.container} testID="travel-upsert.root" accessibilityLabel={i18nT('travel:components.travel.upsert.UpsertTravelView.forma_sozdaniya_puteshestviya_9573fac8')}>
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

      <WizardExitDialog
        visible={!!wizard.exitPrompt}
        canSave={wizard.exitPrompt?.canSave ?? false}
        isSaving={wizard.isExitSaving}
        onStay={wizard.handleExitStay}
        onDiscard={wizard.handleExitDiscard}
        onSaveAndLeave={wizard.handleExitSaveAndLeave}
      />

      <OfflineBanner colors={colors} isVisible={isOffline} />
      {controller.draftRecovery.localSaveError ? (
        <SafetyBanner
          colors={colors}
          icon="hard-drive"
          tone="warning"
          message={i18nT('travel:components.travel.upsert.UpsertTravelView.localDraftSaveFailed')}
        />
      ) : null}
      {isSessionExpired ? (
        <SafetyBanner
          colors={colors}
          icon="log-in"
          tone="danger"
          message={i18nT('travel:components.travel.upsert.UpsertTravelView.sessiya_istekla_voydite_v_akkaunt_chtoby_pro_00f92c37')}
          action={{
            label: i18nT('travel:components.travel.upsert.UpsertTravelView.voyti_c3df4ff8'),
            onPress: handleSessionLogin,
          }}
        />
      ) : null}

      <WizardStepRouter
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
  safetyBanner: {
    minHeight: 48,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: 1,
  },
  safetyText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Экраны пустых/ошибочных состояний (LoadError/AccessDenied/AuthRequired) и
    // fallback WizardStepRouter. maxWidth 480 + alignSelf center корректны и на
    // мобильном (ширина всё равно < 480), поэтому responsive-параметр не нужен.
    centeredScreen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.xl,
      maxWidth: 480,
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
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.lg,
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
