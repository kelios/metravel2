import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { LAYOUT } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { readConsent, writeConsent, ConsentState } from '@/utils/consent';
import { translate as i18nT } from '@/i18n'


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
    if (!isMobile) return 56;
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

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const root = document.documentElement;
    const shouldExpose = visible && !suspendForOverlay && !isConsentSettingsRoute;
    if (!shouldExpose) {
      root.style.removeProperty('--mt-consent-h');
      return;
    }
    // Reserve enough vertical space so scroll containers (RightColumn etc.) don't hide
    // the last row of cards behind the floating cookie banner. bottomOffset already
    // accounts for the bottom dock + safe-area; the banner itself is ~96px on mobile,
    // ~64px on desktop. The +8 keeps an additional breathing gap below the last card.
    const bannerH = isMobile ? 104 : 64;
    root.style.setProperty('--mt-consent-h', `${bottomOffset + bannerH + 8}px`);
    return () => {
      root.style.removeProperty('--mt-consent-h');
    };
  }, [bottomOffset, isConsentSettingsRoute, isMobile, suspendForOverlay, visible]);

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
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
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
            {i18nT('navigation:components.layout.ConsentBanner.ispolzuem_analitiku_dlya_uluchsheniya_servis_dae68d24')}</Text>
        </View>
        <View
          style={[
            styles.buttonsRow,
            isMobile && !isNarrowMobile && styles.buttonsRowMobile,
            isNarrowMobile && styles.buttonsRowNarrow,
          ]}
        >
          <Link href="/cookies" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={i18nT('navigation:components.layout.ConsentBanner.podrobnee_o_cookies_caf7ecdc')}
              style={({ pressed }) => [
                styles.detailsLink,
                { borderColor: colors.border },
                pressed && styles.detailsLinkPressed,
              ]}
            >
              <Text style={[styles.detailsLinkText, { color: colors.primaryText }]}>
                {i18nT('navigation:components.layout.ConsentBanner.podrobnee_1db70e5c')}</Text>
            </Pressable>
          </Link>
          <Button
            label={i18nT('navigation:components.layout.ConsentBanner.otklonit_054e0823')}
            onPress={handleNecessaryOnly}
            variant="outline"
            size="sm"
            style={[
              styles.button,
              isNarrowMobile && styles.buttonNarrow,
              { borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' },
            ]}
            accessibilityLabel={i18nT('navigation:components.layout.ConsentBanner.otklonit_054e0823')}
          />
          <Button
            label={i18nT('navigation:components.layout.ConsentBanner.prinyat_007a0122')}
            onPress={handleAcceptAll}
            variant="primary"
            size="sm"
            style={[
              styles.button,
              isNarrowMobile && styles.buttonNarrow,
              { backgroundColor: colors.primary },
            ]}
            accessibilityLabel={i18nT('navigation:components.layout.ConsentBanner.prinyat_007a0122')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'fixed' as any,
    left: DESIGN_TOKENS.spacing.md,
    right: DESIGN_TOKENS.spacing.md,
    bottom: DESIGN_TOKENS.spacing.md,
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
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    maxWidth: 520,
    width: '100%',
    gap: DESIGN_TOKENS.spacing.sm as any,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.modal,
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
    maxWidth: 820,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.md as any,
    // Живой backdrop-filter только на десктопе: на мобильном fixed-баннере он
    // жжёт GPU без эффекта (фон и так непрозрачный colors.surface). См. правило
    // backdrop-blur в CLAUDE.md (BottomDock/TravelStickyActions).
    ...Platform.select({ web: { backdropFilter: 'blur(10px)' as any } }),
  },
  containerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6 as any,
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
    minWidth: 260,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  textMobile: {
    fontSize: 11,
    lineHeight: 15,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs as any,
    flexShrink: 0,
  },
  buttonsRowMobile: {
    justifyContent: 'flex-end',
  },
  buttonsRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingVertical: 5,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    // D-010 / WCAG 2.5.5: the consent buttons use Button size="sm" (minHeight 36);
    // bump only these two to a ≥44px tap target without touching the shared sm variant.
    minHeight: 44,
  },
  buttonNarrow: {
    width: '100%',
  },
  detailsLink: {
    minHeight: 44,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  detailsLinkPressed: {
    opacity: 0.78,
  },
  detailsLinkText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default React.memo(ConsentBanner);
