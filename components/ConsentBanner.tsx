import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
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
  const [suspendForOverlay, setSuspendForOverlay] = useState(false);
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
      pointerEvents={suspendForOverlay ? 'none' : 'box-none'}
      style={[
        styles.wrapper,
        { bottom: bottomOffset },
        suspendForOverlay && styles.wrapperHidden,
      ]}
    >
      <View testID="consent-banner" pointerEvents="none" style={styles.inner}>
        <View pointerEvents="none" style={[styles.container, { backgroundColor: colors.surface }]}>
          <View pointerEvents="none" style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.text }]}>Мы ценим вашу приватность</Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>
              Мы используем технические файлы и, с вашего согласия, аналитические инструменты (Яндекс.Метрика,
              Google Analytics) для улучшения сервиса. Вы можете выбрать только необходимые или принять всё.
            </Text>
            <Text style={[styles.linkHint, { color: colors.textMuted }]}> 
              Подробнее читайте в нашей Политике конфиденциальности и на странице настроек cookies.
            </Text>
          </View>
          <View style={styles.actionsSpacer} />
        </View>
      </View>

      <View pointerEvents={suspendForOverlay ? 'none' : 'box-none'} style={styles.actionsOverlay}>
        <View pointerEvents="auto" style={styles.buttonsRow}>
          <Button
            label="Только необходимые"
            onPress={handleNecessaryOnly}
            variant="outline"
            size="sm"
            style={[styles.button, { borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' }]}
            accessibilityLabel="Только необходимые"
          />
          <Button
            label="Принять всё"
            onPress={handleAcceptAll}
            variant="primary"
            size="sm"
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityLabel="Принять всё"
          />
        </View>
        {isWeb && !isMobile && (
          <View pointerEvents="auto" style={styles.bottomLinkRow}>
            <Link href="/cookies" style={styles.manageLink}>
              <Text style={[styles.manageLinkText, { color: colors.textMuted }]}>Изменить настройки cookies</Text>
            </Link>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'fixed' as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  wrapperHidden: {
    opacity: 0,
    display: 'none',
  },
  inner: {
    width: '100%',
    maxWidth: 920,
    position: 'relative',
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
  actionsSpacer: {
    minHeight: 44,
  },
  actionsOverlay: {
    position: 'absolute' as any,
    right: 12,
    bottom: 12,
    alignItems: 'flex-end',
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
    borderRadius: 9999,
    minWidth: 140,
    marginTop: 4,
  },
});
