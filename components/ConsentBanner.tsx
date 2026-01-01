import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

const CONSENT_KEY = 'metravel_consent_v1';

interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  date: string;
}

const isWeb = Platform.OS === 'web';

function readConsent(): ConsentState | null {
  if (!isWeb || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.necessary) return null;
    return {
      necessary: !!parsed.necessary,
      analytics: !!parsed.analytics,
      date: parsed.date || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeConsent(consent: ConsentState) {
  if (!isWeb || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // ignore
  }
}

export default function ConsentBanner() {
  const colors = useThemedColors();
  const [visible, setVisible] = useState(false);
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const insets = useSafeAreaInsets();
  const bottomOffset = useMemo(() => {
    if (!isMobile) return 0;
    // On mobile we keep it above the bottom tab bar and respect safe-area.
    return (insets?.bottom || 0) + LAYOUT.tabBarHeight + 8;
  }, [insets?.bottom, isMobile]);

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const existing = readConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent: ConsentState = {
      necessary: true,
      analytics: true,
      date: new Date().toISOString(),
    };
    writeConsent(consent);
    if (isWeb && typeof window !== 'undefined' && (window as any).metravelLoadAnalytics) {
      try {
        (window as any).metravelLoadAnalytics();
      } catch {
        // ignore
      }
    }
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    const consent: ConsentState = {
      necessary: true,
      analytics: false,
      date: new Date().toISOString(),
    };
    writeConsent(consent);
    setVisible(false);
  };

  if (!visible || !isWeb) return null;

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: bottomOffset },
        { pointerEvents: 'box-none' } as any,
      ]}
    >
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.text }]}>Мы ценим вашу приватность</Text>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            Мы используем технические файлы и, с вашего согласия, аналитические инструменты (Яндекс.Метрика,
            Google Analytics) для улучшения сервиса. Вы можете выбрать только необходимые или принять всё.
          </Text>
          <Text style={[styles.linkHint, { color: colors.textMuted }]}>
            Подробнее читайте в нашей Политике конфиденциальности и на странице настроек cookies.
          </Text>
        </View>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={[styles.button, styles.secondary, { borderColor: colors.border }]} onPress={handleNecessaryOnly}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>Только необходимые</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.primary, { backgroundColor: colors.primary }]} onPress={handleAcceptAll}>
            <Text style={[styles.primaryText, { color: colors.textOnPrimary }]}>Принять всё</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isWeb && (
        <View style={styles.bottomLinkRow}>
          <Link href="/cookies" style={styles.manageLink}>
            <Text style={[styles.manageLinkText, { color: colors.textMuted }]}>Изменить настройки cookies</Text>
          </Link>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'fixed' as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  bottomLinkRow: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  manageLink: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  manageLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  container: {
    maxWidth: 920,
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.modal,
      },
      ios: {
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  textBlock: {
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkHint: {
    marginTop: 4,
    fontSize: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8 as any,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    minWidth: 140,
    alignItems: 'center',
    marginTop: 4,
  },
  primary: {
    // backgroundColor перемещен в inline стили
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    // borderColor перемещен в inline стили
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
