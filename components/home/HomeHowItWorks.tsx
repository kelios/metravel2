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
  },
  {
    number: 2,
    title: 'Сохрани поездку',
    description: 'Добавь фото, заметки и точки маршрута',
    icon: 'bookmark',
    path: '/search',
  },
  {
    number: 3,
    title: 'Поделись книгой',
    description: 'Скачай PDF или отправь ссылку',
    icon: 'share-2',
    path: '/export',
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
      paddingVertical: isMobile ? 48 : 72,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      alignItems: 'center',
      gap: 12,
      marginBottom: isMobile ? 32 : 48,
    },
    title: {
      fontSize: isMobile ? 28 : 40,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: isMobile ? 15 : 18,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 22 : 26,
      maxWidth: 480,
    },
    stepsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'flex-start',
      justifyContent: 'center',
      gap: isMobile ? 16 : 24,
    },
    stepWrapper: {
      flex: isMobile ? undefined : 1,
      maxWidth: isMobile ? undefined : 320,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    step: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.xl,
      padding: isMobile ? 24 : 28,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
          transform: 'translateY(-4px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
          borderColor: colors.primaryAlpha30,
        },
      }),
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepTitle: {
      fontSize: isMobile ? 18 : 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    stepDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    connector: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingTop: 40,
      opacity: 0.3,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-how-it-works" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <Text style={styles.title}>Как это работает</Text>
          <Text style={styles.subtitle}>
            Три простых шага до личной книги путешествий
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <View key={step.number} style={styles.stepWrapper}>
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
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.number}</Text>
                  </View>
                  <View style={styles.iconContainer}>
                    <Feather name={step.icon as any} size={22} color={colors.primary} />
                  </View>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </Pressable>

              {index < STEPS.length - 1 && showConnectors && (
                <View style={styles.connector}>
                  <Feather name="chevron-right" size={24} color={colors.border} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeHowItWorks);
