import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import DraftRecoveryDialog from '@/components/travel/DraftRecoveryDialog';
import TravelPreviewModal from '@/components/travel/TravelPreviewModal';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import WizardSkeleton from '@/components/travel/upsert/WizardSkeleton';
import WizardStepRouter, {
  type CommonStepProps,
  type StepNavigationProps,
} from '@/components/travel/upsert/WizardStepRouter';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useTravelPreview } from '@/hooks/useTravelPreview';
import { buildLoginHref } from '@/utils/authNavigation';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

type Colors = UpsertTravelController['colors'];
type Styles = ReturnType<typeof createStyles>;

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
    return {
      icon: 'wifi-off' as const,
      title: 'Нет соединения',
      text: message || 'Проверьте интернет-соединение и попробуйте ещё раз.',
      iconTone: 'warning' as const,
    };
  }

  if (status === 401) {
    return {
      icon: 'user' as const,
      title: 'Требуется вход',
      text: 'Сессия истекла. Войдите в аккаунт, чтобы продолжить редактирование.',
      iconTone: 'danger' as const,
    };
  }

  if (status === 403) {
    return {
      icon: 'lock' as const,
      title: 'Нет доступа',
      text: 'У вас нет прав для просмотра или редактирования этого путешествия.',
      iconTone: 'danger' as const,
    };
  }

  if (status === 404) {
    return {
      icon: 'search' as const,
      title: 'Путешествие не найдено',
      text: 'Возможно, оно было удалено или ссылка указана неверно.',
      iconTone: 'danger' as const,
    };
  }

  return {
    icon: 'alert-triangle' as const,
    title: 'Ошибка загрузки',
    text: 'Не удалось загрузить путешествие. Попробуйте ещё раз.',
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
      label: 'На главную',
      accessibilityLabel: 'Перейти на главную',
      onPress: () => router.replace('/'),
      variant: 'secondary',
    };

    if (status === 401) {
      return [
        {
          label: 'Войти',
          accessibilityLabel: 'Войти в аккаунт',
          onPress: () => router.push(buildLoginHref({ redirect: '/metravel' }) as any),
        },
        homeAction,
      ];
    }

    if (status === 403) {
      return [
        {
          label: 'Мои путешествия',
          accessibilityLabel: 'Перейти к моим путешествиям',
          onPress: () => router.replace('/metravel'),
        },
        homeAction,
      ];
    }

    if (status === 404) {
      return [
        {
          label: 'Мои путешествия',
          accessibilityLabel: 'Перейти к моим путешествиям',
          onPress: () => router.replace('/metravel'),
        },
        homeAction,
      ];
    }

    return [
      {
        label: 'Повторить',
        accessibilityLabel: 'Повторить загрузку',
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
      accessibilityLabel="Ошибка загрузки путешествия"
    />
  );
};

const AccessDeniedState = ({ colors, styles, router }: WizardStateProps) => {
  const actions = useMemo<EmptyStateAction[]>(
    () => [
      {
        label: 'Мои путешествия',
        accessibilityLabel: 'Перейти к моим путешествиям',
        onPress: () => router.replace('/metravel'),
      },
      {
        label: 'На главную',
        accessibilityLabel: 'Перейти на главную',
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
      title="Нет доступа"
      text="У вас нет прав для редактирования этого путешествия"
      actions={actions}
      testID="travel-upsert.no-access"
      accessibilityLabel="Нет доступа к редактированию"
    />
  );
};

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

function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let active = true;
    const apply = (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => {
      if (!active) return;
      const nextIsOffline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline((current) => (current === nextIsOffline ? current : nextIsOffline));
    };

    // Первичный снимок: addEventListener на части платформ дёргает callback только при смене
    // состояния, поэтому без fetch() баннер не покажется, если форма открыта уже без сети.
    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);

    return () => {
      active = false;
      unsubscribe();
    };
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
    return <AccessDeniedState colors={colors} styles={styles} router={router} />;
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
