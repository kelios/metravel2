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
      paddingVertical: isMobile ? 28 : 72,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      alignItems: 'center',
      gap: isMobile ? 10 : 14,
      marginBottom: isMobile ? 24 : 52,
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
      paddingVertical: 6,
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 22 : 40,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 18,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 20 : 26,
      maxWidth: 480,
    },
    stepsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'flex-start',
      justifyContent: 'center',
      gap: isMobile ? 12 : 0,
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
      padding: isMobile ? 18 : 28,
      gap: isMobile ? 10 : 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'all 0.25s ease',
        },
      }),
    },
    stepHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-5px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
          borderColor: colors.primaryAlpha30,
        },
      }),
    },
    stepBgNumber: {
      position: 'absolute' as const,
      top: -8,
      right: 8,
      fontSize: 80,
      fontWeight: '900',
      color: colors.primaryAlpha30,
      lineHeight: 88,
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
    stepNumber: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textOnPrimary,
    },
    iconOuter: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconInner: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepTitle: {
      fontSize: isMobile ? 17 : 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    stepDescription: {
      fontSize: isMobile ? 13 : 14,
      lineHeight: isMobile ? 18 : 21,
      color: colors.textMuted,
    },
    stepAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
    },
    stepActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    connector: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingTop: 32,
      width: 40,
      flexShrink: 0,
    },
    connectorLine: {
      width: 24,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.primaryAlpha30,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-how-it-works" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Feather name="layers" size={12} color={colors.primaryText} />
            <Text style={styles.eyebrowText}>Как это работает</Text>
          </View>
          <Text style={styles.title}>Три шага до вашей книги</Text>
          <Text style={styles.subtitle}>
            Просто выберите маршрут, сохраните поездку и получите красивый PDF
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.number}>
              <View style={styles.stepWrapper}>
                <Pressable
                  onPress={() => handleStepPress(step.path)}
                  style={({ pressed, hovered }) => [
                    styles.step,
                    (pressed || hovered) && styles.stepHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.number}. ${step.title}`}
                  accessibilityHint={step.description}
                >
                  {Platform.OS === 'web' && (
                    <Text style={styles.stepBgNumber} aria-hidden>{step.number}</Text>
                  )}
                  <View style={styles.stepHeader}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{step.number}</Text>
                    </View>
                    <View style={styles.iconOuter}>
                      <View style={styles.iconInner}>
                        <Feather name={step.icon as any} size={20} color={colors.primary} />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <View style={styles.stepAction}>
                    <Text style={styles.stepActionText}>{step.actionLabel}</Text>
                    <Feather name="arrow-right" size={13} color={colors.primary} />
                  </View>
                </Pressable>
              </View>

              {index < STEPS.length - 1 && showConnectors && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Feather name="chevron-right" size={18} color={colors.primaryAlpha30} />
                  <View style={styles.connectorLine} />
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
