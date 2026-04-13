import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';

const STEPS = [
  {
    number: 1,
    title: 'Выбери маршрут',
    description: 'Фильтруй по расстоянию, формату и длительности',
    icon: 'compass',
    path: '/search',
    actionLabel: 'Открыть каталог',
  },
  {
    number: 2,
    title: 'Сохрани поездку',
    description: 'Добавь фото, заметки и точки маршрута',
    icon: 'bookmark',
    path: '/search',
    actionLabel: 'Добавить поездку',
  },
  {
    number: 3,
    title: 'Поделись книгой',
    description: 'Скачай PDF или отправь ссылку',
    icon: 'share-2',
    path: '/export',
    actionLabel: 'Создать книгу',
  },
];

const VALUE_PILLS = [
  'Без сложной подготовки',
  'PDF за пару кликов',
  'Подходит для спонтанных выездов',
] as const;

function StepCard({
  colors,
  onPress,
  showBackgroundNumber,
  step,
  styles,
}: {
  colors: ReturnType<typeof useThemedColors>
  onPress: () => void
  showBackgroundNumber: boolean
  step: (typeof STEPS)[number]
  styles: ReturnType<typeof StyleSheet.create>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.step,
        (pressed || hovered) && styles.stepHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${step.number}. ${step.title}`}
      accessibilityHint={step.description}
    >
      {showBackgroundNumber ? (
        <Text style={styles.stepBgNumber} aria-hidden>
          {step.number}
        </Text>
      ) : null}
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{step.number}</Text>
        </View>
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Feather name={step.icon as any} size={20} color={colors.primary} />
          </View>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepKicker}>Шаг {step.number}</Text>
        </View>
      </View>
      <Text style={styles.stepDescription}>{step.description}</Text>
      <View style={styles.stepFooter}>
        <View style={styles.stepAction}>
          <Text style={styles.stepActionText}>{step.actionLabel}</Text>
          <Feather name="arrow-right" size={13} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  )
}

function HomeHowItWorks() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isSmallPhone, isPhone, isTablet, isDesktop } = useResponsive();
  const isMobile = isSmallPhone || isPhone;
  const showConnectors = isTablet || isDesktop;
  const colors = useThemedColors();

  const handleStepPress = useCallback(
    (path: string) => {
      const target = path.startsWith('/') ? path : `/${path}`;
      const guestAllowedTargets = ['/search', '/travelsby', '/map', '/roulette'];

      if (!isAuthenticated && !guestAllowedTargets.includes(target)) {
        router.push(buildLoginHref({ redirect: target, intent: 'create-book' }) as any);
        return;
      }
      router.push(target as any);
    },
    [isAuthenticated, router],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: isMobile ? 48 : 96,
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 30%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    header: {
      alignItems: 'center',
      gap: isMobile ? 12 : 20,
      marginBottom: isMobile ? 36 : 64,
    },
    eyebrow: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light as any,
        },
      }),
    },
    eyebrowText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    title: {
      fontSize: isMobile ? 28 : 46,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: isMobile ? -0.7 : -1.4,
      lineHeight: isMobile ? 34 : 56,
    },
    subtitle: {
      fontSize: isMobile ? 15 : 18,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 23 : 28,
      maxWidth: 520,
      letterSpacing: 0.2,
    },
    valuePills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      maxWidth: 760,
    },
    valuePill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    valuePillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.1,
    },
    stepsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'flex-start',
      justifyContent: 'center',
      gap: isMobile ? 14 : 0,
    },
    stepWrapper: {
      flex: isMobile ? undefined : 1,
      maxWidth: isMobile ? undefined : 320,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    step: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.xl,
      padding: isMobile ? 24 : 36,
      gap: isMobile ? 14 : 18,
      borderWidth: 1,
      borderColor: colors.borderLight,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      minHeight: isMobile ? 220 : 260,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card as any,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundImage: `linear-gradient(145deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    stepHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-6px)',
          boxShadow: DESIGN_TOKENS.shadows.heavy as any,
          borderColor: colors.primary,
        },
      }),
    },
    stepBgNumber: {
      position: 'absolute' as const,
      top: -12,
      right: 10,
      fontSize: 96,
      fontWeight: '900',
      color: colors.primaryAlpha30,
      lineHeight: 100,
      opacity: 0.6,
      ...Platform.select({
        web: {} as any,
        default: { display: 'none' as any },
      }),
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    stepHeaderText: {
      flex: 1,
      gap: 4,
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: { boxShadow: `0 3px 10px ${colors.primaryAlpha30}` },
      }),
    },
    stepNumberText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textOnPrimary,
      letterSpacing: -0.2,
    },
    iconOuter: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: { boxShadow: `0 2px 8px ${colors.primaryAlpha30}` },
      }),
    },
    iconInner: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepTitle: {
      fontSize: isMobile ? 18 : 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
      lineHeight: isMobile ? 24 : 29,
    },
    stepKicker: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textSubtle,
    },
    stepDescription: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 21 : 23,
      color: colors.textMuted,
      letterSpacing: 0.15,
      flexGrow: 1,
    },
    stepFooter: {
      marginTop: 'auto',
      paddingTop: 4,
    },
    stepAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
    },
    stepActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    connector: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingTop: 36,
      width: 36,
      flexShrink: 0,
    },
    connectorLine: {
      width: 20,
      height: 1.5,
      borderRadius: 1,
      backgroundColor: colors.primaryAlpha30,
      opacity: 0.7,
    },
    // SEC-02: вертикальная связь шагов на мобайле
    connectorMobile: {
      alignItems: 'center',
      paddingVertical: 2,
      gap: 2,
    },
    connectorMobileVLine: {
      width: 1.5,
      height: 10,
      borderRadius: 1,
      backgroundColor: colors.primaryAlpha30,
      opacity: 0.6,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-how-it-works" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Feather name="book-open" size={14} color={colors.primary} />
            <Text style={styles.eyebrowText}>Как это работает</Text>
          </View>
          <Text style={styles.title}>Три шага до вашей книги</Text>
          <Text style={styles.subtitle}>
            Просто выберите маршрут, сохраните поездку и получите красивый PDF
          </Text>
          <View style={styles.valuePills}>
            {VALUE_PILLS.map((pill) => (
              <View key={pill} style={styles.valuePill}>
                <Text style={styles.valuePillText}>{pill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.number}>
              <View style={styles.stepWrapper}>
                <StepCard
                  colors={colors}
                  onPress={() => handleStepPress(step.path)}
                  showBackgroundNumber={Platform.OS === 'web'}
                  step={step}
                  styles={styles}
                />
              </View>

              {index < STEPS.length - 1 && showConnectors && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Feather name="chevron-right" size={18} color={colors.primaryAlpha30} />
                  <View style={styles.connectorLine} />
                </View>
              )}
              {/* SEC-02: вертикальная связь шагов на мобайле */}
              {index < STEPS.length - 1 && isMobile && (
                <View style={styles.connectorMobile}>
                  <View style={styles.connectorMobileVLine} />
                  <Feather name="chevron-down" size={16} color={colors.primaryAlpha30} />
                  <View style={styles.connectorMobileVLine} />
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeHowItWorks);
