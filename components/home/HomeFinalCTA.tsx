import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { ResponsiveContainer } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { buildLoginHref } from '@/utils/authNavigation';

interface HomeFinalCTAProps {
  travelsCount?: number;
}

function HomeFinalCTA({ travelsCount = 0 }: HomeFinalCTAProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const colors = useThemedColors();

  const handleAction = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA');
    if (!isAuthenticated) {
      router.push(buildLoginHref({ redirect: '/', intent: 'create-book' }) as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  };

  const buttonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Рассказать о путешествии';
    if (travelsCount === 0) return 'Написать первую историю';
    return 'Собрать книгу из историй';
  }, [isAuthenticated, travelsCount]);

  // Button style kept as a plain object so RNW inlines it via the style
  // attribute. StyleSheet.create classes injected at runtime by lazy-loaded
  // components can be overridden by the postprocessed external CSS base reset
  // (padding: 0px shorthand wins over longhand padding-top/bottom/left/right).
  const buttonStyle = useMemo(() => ({
    paddingHorizontal: isMobile ? 24 : 40,
    paddingVertical: isMobile ? 16 : 20,
    minHeight: isMobile ? 52 : 60,
    minWidth: isMobile ? undefined : 300,
    width: isMobile ? '100%' as const : undefined,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginTop: 8,
    ...Platform.select({
      web: {
        boxShadow: `${DESIGN_TOKENS.shadows.medium}, 0 0 0 0 ${colors.primarySoft}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  }), [colors, isMobile]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 0,
      paddingVertical: isMobile ? 48 : 72,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 80% 80% at 50% 50%, ${colors.primarySoft} 0%, ${colors.backgroundSecondary} 70%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    containerMobile: {
      paddingHorizontal: 0,
      paddingVertical: 48,
    },
    content: {
      alignItems: 'center',
      gap: isMobile ? 20 : 28,
      width: '100%',
    },
    title: {
      fontSize: isMobile ? 26 : 40,
      fontWeight: '800',
      color: colors.text,
      lineHeight: isMobile ? 34 : 48,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    titleMobile: {
      fontSize: 26,
      lineHeight: 34,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: isMobile ? 15 : 18,
      color: colors.textMuted,
      lineHeight: isMobile ? 22 : 28,
      textAlign: 'center',
      maxWidth: 520,
    },
    subtitleMobile: {
      fontSize: 15,
      lineHeight: 22,
    },
    buttonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 0 32px ${colors.primaryAlpha40}`,
          transform: 'translateY(-3px)',
        },
      }),
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontSize: isMobile ? 16 : 18,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  }), [colors, isMobile]);

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.content}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            Начни писать свою историю
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            Расскажи о своих путешествиях, вдохнови других — и собери всё в красивую книгу на память.
          </Text>

          <Button
            onPress={handleAction}
            label={buttonLabel}
            variant="primary"
            size={isMobile ? 'md' : 'lg'}
            style={buttonStyle}
            labelStyle={styles.buttonText}
            hoverStyle={styles.buttonHover}
            pressedStyle={styles.buttonHover}
            accessibilityLabel={buttonLabel}
          />
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFinalCTA);
