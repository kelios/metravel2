import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { useThemedColors } from '@/hooks/useTheme';
import {
  activatePushRegistrationSession,
  getPushRegistrationResult,
  requestAndRegisterPushNotifications,
  retryPendingPushRegistration,
  subscribePushRegistration,
  syncPushRegistration,
  type PushRegistrationResult,
} from '@/services/pushRegistration.native';
import { openSystemSettings } from '@/utils/externalLinks';
import { globalFocusStyles } from '@/styles/globalFocus';

type Styles = ReturnType<typeof createSettingsStyles>;
type Colors = ReturnType<typeof useThemedColors>;

interface NotificationSettingsSectionProps {
  styles: Styles;
  colors: Colors;
}

export default function NotificationSettingsSection({
  styles,
  colors,
}: NotificationSettingsSectionProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<PushRegistrationResult>(getPushRegistrationResult);

  useEffect(() => {
    // SettingsScreen renders this section only for a restored authenticated
    // session, so it is a safe second activation point if effect order differs
    // from the root native runtime hook.
    activatePushRegistrationSession();
    const unsubscribe = subscribePushRegistration(setResult);
    void syncPushRegistration().then(setResult);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncPushRegistration().then(setResult);
    });
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const handleAction = useCallback(async () => {
    if (result.status === 'denied') {
      await openSystemSettings();
      return;
    }
    const next = result.status === 'notDetermined'
      ? await requestAndRegisterPushNotifications()
      : await retryPendingPushRegistration();
    setResult(next);
  }, [result.status]);

  const copy = {
    enabled: {
      title: t('profile:components.settings.NotificationSettingsSection.enabledTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.enabledMeta'),
    },
    provisional: {
      title: t('profile:components.settings.NotificationSettingsSection.provisionalTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.provisionalMeta'),
    },
    notDetermined: {
      title: t('profile:components.settings.NotificationSettingsSection.notDeterminedTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.notDeterminedMeta'),
    },
    denied: {
      title: t('profile:components.settings.NotificationSettingsSection.deniedTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.deniedMeta'),
    },
    unavailable: {
      title: t('profile:components.settings.NotificationSettingsSection.unavailableTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.unavailableMeta'),
    },
    syncing: {
      title: t('profile:components.settings.NotificationSettingsSection.syncingTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.syncingMeta'),
    },
    offline: {
      title: t('profile:components.settings.NotificationSettingsSection.offlineTitle'),
      meta: t('profile:components.settings.NotificationSettingsSection.offlineMeta'),
    },
  }[result.status];

  const actionLabel = result.status === 'notDetermined'
    ? t('profile:components.settings.NotificationSettingsSection.enableAction')
    : result.status === 'denied'
      ? t('profile:components.settings.NotificationSettingsSection.openSettingsAction')
      : result.status === 'offline' || result.status === 'unavailable'
        ? t('profile:components.settings.NotificationSettingsSection.retryAction')
        : null;

  return (
    <>
      <Text style={styles.sectionTitle}>
        {t('profile:components.settings.NotificationSettingsSection.sectionTitle')}
      </Text>
      <View style={styles.card} testID="notification-settings-section">
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <Feather name="bell" size={18} color={colors.primaryDark} />
          </View>
          <View style={styles.cardText} accessibilityLiveRegion="polite">
            <Text style={styles.cardTitle}>{copy.title}</Text>
            <Text style={styles.cardMeta}>{copy.meta}</Text>
          </View>
          {result.status === 'syncing' ? (
            <ActivityIndicator
              color={colors.primaryDark}
              accessibilityLabel={t('profile:components.settings.NotificationSettingsSection.syncingA11y')}
            />
          ) : null}
        </View>

        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={handleAction}
            style={({ pressed }) => [
              localStyles.action,
              { borderColor: colors.border, backgroundColor: colors.surface },
              globalFocusStyles.focusable,
              pressed ? localStyles.pressed : null,
            ]}
          >
            <Text style={[localStyles.actionText, { color: colors.primaryText }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  action: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
});
