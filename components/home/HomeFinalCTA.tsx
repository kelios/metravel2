import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
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

const TRUST_BADGES = [
  { icon: 'check-circle', label: 'Бесплатно' },
  { icon: 'shield', label: 'Без карты' },
  { icon: 'zap', label: 'Мгновенно' },
] as const;

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

  const handleOpenSearch = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA_Search');
    router.push('/search' as any);
  };

  const buttonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Начать бесплатно';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingTop: isMobile ? 20 : 48,
      paddingBottom: isMobile ? 40 : 80,
      // SEC-04: fallback backgroundColor для браузеров без поддержки radial-gradient
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      ...Platform.select({
        web: {
          backgroundImage: [
            `radial-gradient(ellipse 60% 50% at 20% 50%, ${colors.primaryAlpha30} 0%, transparent 65%)`,
            `radial-gradient(ellipse 60% 50% at 80% 50%, ${colors.primaryAlpha30} 0%, transparent 65%)`,
            `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
          ].join(', '),
        },
      }),
    },
    content: {
      width: '100%',
      alignSelf: 'center',
      alignItems: 'center',
      gap: isMobile ? 16 : 28,
      maxWidth: 720,
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 16 : 48,
      paddingVertical: isMobile ? 24 : 48,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          backgroundImage: `linear-gradient(165deg, ${colors.surface} 0%, ${colors.primarySoft} 100%)`,
        },
      }),
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 14,
      paddingVertical: 7,
      alignSelf: 'center',
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
      letterSpacing: 1,
      // TYPO-04: capitalize вместо uppercase — лучше читаемость на кириллице
      textTransform: 'capitalize',
    },
    iconWrap: {
      width: isMobile ? 60 : 72,
      height: isMobile ? 60 : 72,
      borderRadius: isMobile ? 30 : 36,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      ...Platform.select({
        web: {
          boxShadow: `0 8px 24px ${colors.primaryAlpha30}`,
        },
      }),
    },
    titleRow: {
      alignItems: 'center',
      gap: 4,
    },
    title: {
      fontSize: isMobile ? 26 : 48,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -1.2,
      lineHeight: isMobile ? 32 : 56,
    },
    titleAccent: {
      fontSize: isMobile ? 26 : 48,
      fontWeight: '900',
      color: colors.primary,
      textAlign: 'center',
      letterSpacing: -1.2,
      lineHeight: isMobile ? 32 : 56,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 18,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 21 : 28,
      maxWidth: 480,
      fontWeight: '400',
    },
    buttonsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      gap: isMobile ? 10 : 14,
      width: isMobile ? '100%' : undefined,
      marginTop: 4,
    },
    primaryButton: {
      // HERO-03: primary CTA шире secondary для визуальной иерархии
      paddingHorizontal: isMobile ? 24 : 52,
      paddingVertical: isMobile ? 15 : 20,
      minHeight: isMobile ? 50 : 62,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: isMobile ? '100%' : undefined,
      flex: isMobile ? undefined : 1.4,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          transition: 'all 0.25s ease',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-3px)',
          boxShadow: `0 12px 32px ${colors.primaryAlpha30}`,
        },
      }),
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 20 : 36,
      paddingVertical: isMobile ? 14 : 19,
      minHeight: isMobile ? 48 : 60,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      width: isMobile ? '100%' : undefined,
      // HERO-03: secondary CTA уже primary
      flex: isMobile ? undefined : 1,
      ...Platform.select({
        web: {
          transition: 'all 0.25s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
        },
      }),
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    trustBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? 12 : 20,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    trustBadgeText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth="lg" padding>
        <View style={styles.content}>
          <View style={styles.eyebrow}>
            <Feather name="star" size={12} color={colors.primaryText} />
            <Text style={styles.eyebrowText}>Ваш travel-дневник</Text>
          </View>

          <View style={styles.iconWrap}>
            <Feather name="book-open" size={isMobile ? 28 : 32} color={colors.textOnPrimary} />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>Начните собирать</Text>
            <Text style={styles.titleAccent}>книгу путешествий</Text>
          </View>

          <Text style={styles.subtitle}>
            Сохраняйте маршруты с фото и заметками, экспортируйте в красивый PDF — бесплатно и без лишнего
          </Text>

          <View style={styles.buttonsContainer}>
            <Button
              onPress={handleAction}
              label={buttonLabel}
              variant="primary"
              size="lg"
              fullWidth={isMobile}
              icon={<Feather name="arrow-right" size={18} color={colors.textOnPrimary} />}
              iconPosition="right"
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonText}
              hoverStyle={styles.primaryButtonHover}
              pressedStyle={styles.primaryButtonHover}
              accessibilityLabel={buttonLabel}
            />
            <Button
              onPress={handleOpenSearch}
              label="Смотреть маршруты"
              variant="secondary"
              size="lg"
              fullWidth={isMobile}
              icon={<Feather name="compass" size={18} color={colors.text} />}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              hoverStyle={styles.secondaryButtonHover}
              pressedStyle={styles.secondaryButtonHover}
              accessibilityLabel="Смотреть маршруты"
            />
          </View>

          <View style={styles.trustBadgesRow}>
            {TRUST_BADGES.map((badge) => (
              <View key={badge.label} style={styles.trustBadge}>
                <Feather name={badge.icon as any} size={13} color={colors.success ?? colors.primary} />
                <Text style={styles.trustBadgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFinalCTA);
