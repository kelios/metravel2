import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
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

const CTA_BENEFITS = [
  { icon: 'bookmark', label: 'Маршрут + фото + заметки' },
  { icon: 'calendar', label: 'План на следующие выходные' },
  { icon: 'share-2', label: 'PDF или ссылка за минуту' },
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

  const handlePickTrip = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA_PickTrip');
    router.push('/search' as any);
  };

  const handleBenefitPress = (label: string) => {
    sendAnalyticsEvent('HomeClick_FinalCTA_Benefit', { label });
    router.push('/search' as any);
  };

  const buttonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Начать и создать книгу';
    if (travelsCount === 0) return 'Сохранить первую поездку';
    return 'Открыть мою книгу';
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
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    eyebrowText: {
      color: colors.primaryText,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
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
    benefitsRow: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
    },
    benefitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    benefitChipHover: {
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    benefitChipText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    actionsRow: {
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      maxWidth: isMobile ? undefined : 740,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minHeight: isMobile ? 52 : 60,
      width: isMobile ? '100%' as const : undefined,
      paddingHorizontal: isMobile ? 24 : 30,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          transition: 'all 0.25s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: isMobile ? 15 : 16,
      fontWeight: '700',
      letterSpacing: 0.1,
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
          <View style={styles.eyebrow}>
            <Feather name="flag" size={12} color={colors.primary} />
            <Text style={styles.eyebrowText}>Готовы начать?</Text>
          </View>

          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            Запланируйте следующую поездку уже сегодня
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            Выберите маршрут, сохраните его в коллекцию и соберите книгу путешествий, которой удобно делиться.
          </Text>

          <View style={styles.benefitsRow}>
            {CTA_BENEFITS.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => handleBenefitPress(item.label)}
                style={({ pressed, hovered }) => [
                  styles.benefitChip,
                  (pressed || hovered) && styles.benefitChipHover,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Преимущество ${item.label}`}
              >
                <Feather name={item.icon as any} size={13} color={colors.primary} />
                <Text style={styles.benefitChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionsRow}>
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

            <Button
              onPress={handlePickTrip}
              label="Подобрать маршрут сначала"
              variant="secondary"
              size={isMobile ? 'md' : 'lg'}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              hoverStyle={styles.secondaryButtonHover}
              pressedStyle={styles.secondaryButtonHover}
              icon={<Feather name="compass" size={16} color={colors.text} />}
              accessibilityLabel="Подобрать маршрут сначала"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFinalCTA);
