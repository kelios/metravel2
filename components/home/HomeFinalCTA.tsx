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
      paddingTop: isMobile ? 24 : 56,
      paddingBottom: isMobile ? 44 : 88,
      // SEC-04: fallback backgroundColor для браузеров без поддержки radial-gradient
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      ...Platform.select({
        web: {
          backgroundImage: [
            `radial-gradient(ellipse 55% 45% at 15% 50%, ${colors.primaryAlpha30} 0%, transparent 60%)`,
            `radial-gradient(ellipse 55% 45% at 85% 50%, ${colors.brandAlpha30 ?? colors.primaryAlpha30} 0%, transparent 60%)`,
            `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
          ].join(', '),
        },
      }),
    },
    content: {
      width: '100%',
      alignSelf: 'center',
      alignItems: 'center',
      gap: isMobile ? 18 : 32,
      maxWidth: 680,
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 20 : 56,
      paddingVertical: isMobile ? 28 : 56,
      ...Platform.select({
        web: {
          boxShadow: '0 8px 48px rgba(0,0,0,0.08), 0 2px 12px rgba(0,0,0,0.05)',
          backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.primarySoft}88 55%, ${colors.backgroundSecondary} 100%)`,
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
      paddingHorizontal: 16,
      paddingVertical: 7,
      alignSelf: 'center',
      ...Platform.select({
        web: { boxShadow: `0 1px 8px ${colors.primary}14` },
      }),
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      // TYPO-04: capitalize вместо uppercase — лучше читаемость на кириллице
      textTransform: 'capitalize',
    },
    iconWrap: {
      width: isMobile ? 64 : 76,
      height: isMobile ? 64 : 76,
      borderRadius: isMobile ? 32 : 38,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      ...Platform.select({
        web: {
          boxShadow: `0 8px 28px ${colors.primaryAlpha30}, 0 2px 8px ${colors.primaryAlpha30}`,
        },
      }),
    },
    titleRow: {
      alignItems: 'center',
      gap: 2,
    },
    title: {
      fontSize: isMobile ? 28 : 48,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -1.4,
      lineHeight: isMobile ? 34 : 58,
    },
    titleAccent: {
      fontSize: isMobile ? 28 : 48,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
      letterSpacing: -1.4,
      lineHeight: isMobile ? 34 : 58,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 17,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 22 : 27,
      maxWidth: 460,
      fontWeight: '400',
      letterSpacing: 0.1,
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
      paddingHorizontal: isMobile ? 28 : 56,
      paddingVertical: isMobile ? 16 : 20,
      minHeight: isMobile ? 52 : 62,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: isMobile ? '100%' : undefined,
      flex: isMobile ? undefined : 1.4,
      ...Platform.select({
        web: {
          boxShadow: `0 4px 20px ${colors.primaryAlpha30}, 0 1px 4px ${colors.primaryAlpha30}`,
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-3px)',
          boxShadow: `0 12px 36px ${colors.primaryAlpha30}, 0 2px 8px ${colors.primaryAlpha30}`,
        },
      }),
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 22 : 36,
      paddingVertical: isMobile ? 15 : 19,
      minHeight: isMobile ? 50 : 60,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      width: isMobile ? '100%' : undefined,
      // HERO-03: secondary CTA уже primary
      flex: isMobile ? undefined : 1,
      ...Platform.select({
        web: {
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.07)',
        },
      }),
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    trustBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? 16 : 24,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trustBadgeText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      letterSpacing: 0.1,
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
