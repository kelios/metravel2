import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { readConsent, writeConsent, ConsentState } from '@/utils/consent';

const isWeb = Platform.OS === 'web';

function ConsentBanner() {
  const colors = useThemedColors();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [suspendForOverlay, setSuspendForOverlay] = useState(false);
  const { isMobile, width } = useResponsive();
  const isNarrowMobile = isMobile && width > 0 && width < 360;
  const insets = useSafeAreaInsets();
  const bottomOffset = useMemo(() => {
    if (!isMobile) return 12;
    // On mobile we keep it above the bottom tab bar and respect safe-area.
    return (insets?.bottom || 0) + (LAYOUT?.tabBarHeight ?? 56) + 8;
  }, [insets?.bottom, isMobile]);
  const isConsentSettingsRoute = pathname === '/cookies' || pathname === '/privacy';

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

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;

    const shouldExposeBanner = visible && !suspendForOverlay;
    if (shouldExposeBanner) {
      body.setAttribute('data-consent-banner-open', 'true');
    } else {
      body.removeAttribute('data-consent-banner-open');
    }

    return () => {
      body.removeAttribute('data-consent-banner-open');
    };
  }, [suspendForOverlay, visible]);

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

  if (!visible || !isWeb || isConsentSettingsRoute) return null;

  return (
    <View
      style={[
        styles.wrapper,
        styles.pointerEventsNone,
        isMobile && styles.wrapperMobile,
        !isMobile && styles.wrapperDesktop,
        { bottom: bottomOffset },
        suspendForOverlay && styles.wrapperHidden,
      ]}
    >
      <View
        testID="consent-banner"
        style={[
          styles.container,
          styles.pointerEventsAuto,
          { backgroundColor: colors.surface },
          isMobile && styles.containerMobile,
          isNarrowMobile && styles.containerNarrow,
          !isMobile && styles.containerDesktop,
        ]}
      >
        <View style={[styles.textBlock, !isMobile && styles.textBlockDesktop]}>
          <Text
            numberOfLines={isMobile ? 2 : undefined}
            style={[styles.text, isMobile && styles.textMobile, { color: colors.textMuted }]}
          >
            Используем аналитику для улучшения сервиса.{' '}
            <Link href="/cookies" style={{ color: colors.primaryText, textDecorationLine: 'underline', fontSize: 12 }}>
              Подробнее
            </Link>
          </Text>
        </View>
        <View style={[styles.buttonsRow, isNarrowMobile && styles.buttonsRowNarrow]}>
          <Button
            label="Отклонить"
            onPress={handleNecessaryOnly}
            variant="outline"
            size="sm"
            style={[
              styles.button,
              isNarrowMobile && styles.buttonNarrow,
              { borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' },
            ]}
            accessibilityLabel="Отклонить"
          />
          <Button
            label="Принять"
            onPress={handleAcceptAll}
            variant="primary"
            size="sm"
            style={[
              styles.button,
              isNarrowMobile && styles.buttonNarrow,
              { backgroundColor: colors.primary },
            ]}
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
  },
  wrapperMobile: {
    alignItems: 'stretch',
  },
  wrapperDesktop: {
    alignItems: 'center',
  },
  wrapperHidden: {
    opacity: 0,
    display: 'none',
  },
  pointerEventsNone: {
    pointerEvents: 'none',
  },
  pointerEventsAuto: {
    pointerEvents: 'auto',
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
  containerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8 as any,
  },
  containerNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    lineHeight: 16,
  },
  textMobile: {
    fontSize: 11,
    lineHeight: 15,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 6 as any,
    flexShrink: 0,
  },
  buttonsRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  buttonNarrow: {
    width: '100%',
  },
});

export default React.memo(ConsentBanner);
