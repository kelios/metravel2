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
  { icon: 'bookmark', label: 'Маршрут, фото и заметки в одном месте' },
  { icon: 'calendar', label: 'Готовый план на выходные' },
  { icon: 'share-2', label: 'PDF или ссылка — за пару минут' },
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
    if (!isAuthenticated) return 'Создать книгу путешествий';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  // Button style kept as a plain object so RNW inlines it via the style
  // attribute. StyleSheet.create classes injected at runtime by lazy-loaded
  // components can be overridden by the postprocessed external CSS base reset
  // (padding: 0px shorthand wins over longhand padding-top/bottom/left/right).
  const buttonStyle = useMemo(() => ({
    paddingHorizontal: isMobile ? 32 : 48,
    paddingVertical: isMobile ? 18 : 22,
    minHeight: isMobile ? 56 : 64,
    minWidth: isMobile ? undefined : 320,
    width: isMobile ? '100%' as const : undefined,
    borderRadius: DESIGN_TOKENS.radii.pill,
    marginTop: 12,
    ...Platform.select({
      web: {
        boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 0 0 0 ${colors.primarySoft}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  }), [colors, isMobile]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 0,
      paddingVertical: isMobile ? 64 : 96,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 70% 70% at 50% 120%, ${colors.primarySoft} 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 50% -10%, ${colors.primaryLight} 0%, transparent 60%), linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
          borderTopWidth: 1,
          borderColor: colors.borderLight,
        },
      }),
    },
    containerMobile: {
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
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    eyebrowText: {
      color: colors.primaryText,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 32 : 48,
      fontWeight: '900',
      color: colors.text,
      lineHeight: isMobile ? 40 : 56,
      textAlign: 'center',
      letterSpacing: -0.8,
    },
    titleMobile: {
      fontSize: 28,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: isMobile ? 16 : 20,
      color: colors.textMuted,
      lineHeight: isMobile ? 24 : 30,
      textAlign: 'center',
      maxWidth: 600,
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
      gap: 12,
      marginTop: 4,
    },
    benefitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'all 0.25s ease',
        },
      }),
    },
    benefitChipHover: {
      borderColor: colors.primaryAlpha40,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    benefitChipText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    actionsRow: {
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginTop: 8,
      maxWidth: isMobile ? undefined : 740,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      minHeight: isMobile ? 56 : 64,
      width: isMobile ? '100%' as const : undefined,
      paddingHorizontal: isMobile ? 32 : 40,
      borderRadius: DESIGN_TOKENS.radii.pill,
      marginTop: isMobile ? 0 : 12,
      ...Platform.select({
        web: {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          transform: 'translateY(-2px)',
        },
      }),
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: isMobile ? 16 : 17,
      fontWeight: '700',
    },
    buttonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 8px 32px ${colors.primaryAlpha40}`,
          transform: 'translateY(-3px)',
        },
      }),
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontSize: isMobile ? 16 : 18,
      fontWeight: '800',
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
            Начни собирать свою книгу путешествий
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            Найди маршрут, сохрани с фото и заметками — и собери книгу, которой хочется делиться.
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
              label="Смотреть маршруты"
              variant="secondary"
              size={isMobile ? 'md' : 'lg'}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              hoverStyle={styles.secondaryButtonHover}
              pressedStyle={styles.secondaryButtonHover}
              icon={<Feather name="compass" size={16} color={colors.text} />}
              accessibilityLabel="Смотреть маршруты"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFinalCTA);
