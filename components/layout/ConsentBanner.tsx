import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';

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
    const analytics = typeof (parsed as any).analytics === 'boolean' ? (parsed as any).analytics : true;
    return {
      necessary: !!parsed.necessary,
      analytics: !!analytics,
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

function ConsentBanner() {
  const colors = useThemedColors();
  const [visible, setVisible] = useState(false);
  const [suspendForOverlay, setSuspendForOverlay] = useState(false);
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const insets = useSafeAreaInsets();
  const bottomOffset = useMemo(() => {
    if (!isMobile) return 12;
    // On mobile we keep it above the bottom tab bar and respect safe-area.
    return (insets?.bottom || 0) + (LAYOUT?.tabBarHeight ?? 56) + 8;
  }, [insets?.bottom, isMobile]);

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const existing = readConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const update = () => {
      setSuspendForOverlay(body.getAttribute('data-footer-more-open') === 'true');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(body, { attributes: true, attributeFilter: ['data-footer-more-open'] });
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (detail && typeof detail.open === 'boolean') {
        setSuspendForOverlay(detail.open);
      }
    };
    window.addEventListener('metravel:footer-more', handle);
    return () => {
      observer.disconnect();
      window.removeEventListener('metravel:footer-more', handle);
    };
  }, []);

  const handleAcceptAll = () => {
    const consent: ConsentState = {
      necessary: true,
      analytics: true,
      date: new Date().toISOString(),
    };
    writeConsent(consent);
    if (isWeb && typeof window !== 'undefined') {
      const gaId = (window as any).__metravelGaId;
      if (gaId) {
        try {
          (window as any)[`ga-disable-${String(gaId)}`] = false;
        } catch {
          // ignore
        }
      }
    }
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
    if (isWeb && typeof window !== 'undefined') {
      const gaId = (window as any).__metravelGaId;
      if (gaId) {
        try {
          (window as any)[`ga-disable-${String(gaId)}`] = true;
        } catch {
          // ignore
        }
      }
    }
    setVisible(false);
  };

  if (!visible || !isWeb) return null;

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: bottomOffset, pointerEvents: suspendForOverlay ? 'none' : 'box-none' },
        suspendForOverlay && styles.wrapperHidden,
      ]}
    >
      <View
        testID="consent-banner"
        style={[
          styles.container,
          { backgroundColor: colors.surface },
          !isMobile && styles.containerDesktop,
        ]}
      >
        <View style={[styles.textBlock, !isMobile && styles.textBlockDesktop]}>
          <Text style={[styles.text, { color: colors.textMuted }]}>
            Используем аналитику для улучшения сервиса.{' '}
            <Link href="/cookies" style={{ color: colors.primaryText, textDecorationLine: 'underline', fontSize: 12 }}>
              Подробнее
            </Link>
          </Text>
        </View>
        <View style={styles.buttonsRow}>
          <Button
            label="Отклонить"
            onPress={handleNecessaryOnly}
            variant="outline"
            size="sm"
            style={[styles.button, { borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' }]}
            accessibilityLabel="Отклонить"
          />
          <Button
            label="Принять"
            onPress={handleAcceptAll}
            variant="primary"
            size="sm"
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityLabel="Принять"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'fixed' as any,
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 900,
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
  wrapperHidden: {
    opacity: 0,
    display: 'none',
  },
  container: {
    flexDirection: 'column',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 480,
    width: '100%',
    gap: 8 as any,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        backdropFilter: 'blur(10px)',
      },
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  containerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 560,
  },
  textBlock: {
    flexShrink: 1,
  },
  textBlockDesktop: {
    flex: 1,
    marginRight: 12,
  },
  text: {
    fontSize: 12,
    lineHeight: 17,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 6 as any,
    flexShrink: 0,
  },
  button: {
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

export default React.memo(ConsentBanner);
