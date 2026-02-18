import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveText, ResponsiveStack } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';

const STEPS = [
  {
    number: 1,
    title: 'Расскажи историю',
    description: 'Опиши свой маршрут, добавь фото и впечатления о путешествии',
    icon: 'edit-3',
    path: '/travel/new',
  },
  {
    number: 2,
    title: 'Собери в книгу',
    description: 'Выбери истории, настрой стиль и создай свою книгу путешествий',
    icon: 'book-open',
    path: '/export',
  },
  {
    number: 3,
    title: 'Поделись или сохрани',
    description: 'Покажи друзьям или сохрани в PDF на память',
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
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

  const handleStepPress = useCallback(
    (path: string) => {
      const target = path.startsWith('/') ? path : `/${path}`;
      if (!isAuthenticated) {
        const redirect = encodeURIComponent(target);
        router.push(buildLoginHref({ redirect, intent: 'create-book' }) as any);
        return;
      }
      router.push(target as any);
    },
    [isAuthenticated, router],
  );

  const pressableProps = useMemo(
    () =>
      Platform.select({
        web: { cursor: 'pointer' },
        default: {},
      }),
    [],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: isMobile ? 36 : 52,
      backgroundColor: colors.background,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 50%, ${colors.background} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    header: {
      marginBottom: isMobile ? 24 : 32,
      alignItems: 'center',
      gap: 8,
    },
    title: {
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: isMobile ? 14 : 16,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 20 : 24,
      maxWidth: 480,
    },
    stepWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    step: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: isMobile ? 20 : 28,
      gap: isMobile ? 10 : 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'pan-y',
        } as any,
      }),
    },
    stepHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px)',
          boxShadow: DESIGN_TOKENS.shadows.hover,
          borderColor: colors.primaryAlpha30,
        },
        default: {},
      }),
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: isMobile ? 4 : 12,
    },
    iconContainer: {
      width: isMobile ? 44 : 56,
      height: isMobile ? 44 : 56,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(135deg, ${colors.primarySoft} 0%, ${colors.primaryLight} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    numberBadge: {
      width: 32,
      height: 32,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: {
          boxShadow: `0 2px 8px ${colors.primaryAlpha30}`,
        },
      }),
    },
    numberText: {
      color: colors.textOnPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    stepTitle: {
      color: colors.text,
      fontSize: isMobile ? 17 : 20,
      letterSpacing: -0.2,
      fontWeight: '700',
    },
    stepDescription: {
      color: colors.textMuted,
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 20 : 22,
    },
    connector: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      opacity: 0.4,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-how-it-works" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <ResponsiveText variant="h2" style={styles.title}>
            Как это работает
          </ResponsiveText>
          <Text style={styles.headerSubtitle}>
            Три простых шага от идеи до книги
          </Text>
        </View>

        <ResponsiveStack
          direction={isMobile ? 'vertical' : 'horizontal'}
          gap={isMobile ? 20 : 24}
          justify="space-between"
        >
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
                {...pressableProps}
              >
                <View style={styles.stepHeader}>
                  <View style={styles.iconContainer}>
                    <Feather
                      name={step.icon as any}
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberText}>{step.number}</Text>
                  </View>
                </View>

                <ResponsiveText variant="h3" style={styles.stepTitle}>
                  {step.title}
                </ResponsiveText>
                <ResponsiveText variant="body" style={styles.stepDescription}>
                  {step.description}
                </ResponsiveText>
              </Pressable>

              {index < STEPS.length - 1 && showConnectors && (
                <View style={styles.connector}>
                  <Feather name="arrow-right" size={20} color={colors.border} />
                </View>
              )}
            </View>
          ))}
        </ResponsiveStack>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeHowItWorks);
