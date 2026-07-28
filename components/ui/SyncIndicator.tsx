import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Platform, ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { translate as i18nT } from '@/i18n'


/**
 * AND-10: Компонент «Синхронизация данных...»
 *
 * Появляется при восстановлении связи после offline-периода.
 * Показывает spinner + текст на 3 секунды, затем скрывается.
 * На web не рендерится (web NetworkStatus уже показывает «Соединение восстановлено»).
 */
export function SyncIndicator() {
  // На web NetworkStatus.web.tsx уже обрабатывает восстановление — не дублируем
  if (Platform.OS === 'web') return null;

  return <SyncIndicatorNative />;
}

function SyncIndicatorNative() {
  const router = useRouter();
  const colors = useThemedColors();
  const { isConnected } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const wasOfflineRef = useRef(false);
  const translateY = useSharedValue(-60);

  useEffect((): (() => void) | void => {
    if (!isConnected) {
      wasOfflineRef.current = true;
      setVisible(true);
      translateY.value = withTiming(0, { duration: 200 });
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setVisible(true);
      translateY.value = withTiming(0, { duration: 300 });

      const timer = setTimeout(() => {
        translateY.value = withTiming(-60, { duration: 300 });
        setTimeout(() => setVisible(false), 350);
      }, 3000);

      return () => { clearTimeout(timer); };
    }
  }, [isConnected, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { backgroundColor: colors.info },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={isConnected
        ? i18nT('shared:components.ui.SyncIndicator.sinhronizatsiya_dannyh_b1e3ca28')
        : i18nT('offline:offlineBanner')}
    >
      <View style={styles.content}>
        {isConnected ? <ActivityIndicator size="small" color={colors.textInverse} /> : null}
        <Text style={[styles.text, { color: colors.textInverse }]}>
          {isConnected
            ? i18nT('shared:components.ui.SyncIndicator.sinhronizatsiya_dannyh_80179835')
            : i18nT('offline:offlineBanner')}
        </Text>
        {!isConnected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('offline:openSaved')}
            onPress={() => router.push('/offline')}
            style={[styles.action, { borderColor: colors.textInverse }]}
          >
            <Text style={[styles.actionText, { color: colors.textInverse }]}>{i18nT('offline:openSaved')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9998, // Чуть ниже NetworkStatus (9999)
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
