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
    title: 'Выбери поездку',
    description: 'Подбери идею по расстоянию, бюджету и формату отдыха на 1-2 дня',
    icon: 'compass',
    path: '/search',
  },
  {
    number: 2,
    title: 'Сохрани маршрут',
    description: 'Добавь понравившийся маршрут в личную коллекцию и дополни своими заметками',
    icon: 'bookmark',
    path: '/search',
  },
  {
    number: 3,
    title: 'Получи книгу путешествий',
    description: 'Собери поездки в красивую travel-книгу: для памяти, планирования и share с друзьями',
    icon: 'share-2',
    path: '/export',
  },
];

const USE_CASES = [
  {
    key: 'idea',
    tag: 'Сценарий A',
    title: 'Не знаю куда поехать',
    icon: 'navigation',
    description: 'Подберём поездку на выходные за пару минут.',
    bullets: ['Расстояние', 'Бюджет', 'Природа / город / активность', '1 день / 2 дня'],
    cta: 'Подобрать поездку',
    path: '/search',
  },
  {
    key: 'book',
    tag: 'Сценарий B',
    title: 'Хочу свою книгу путешествий',
    icon: 'book-open',
    description: 'Сохраняй маршруты и собирай личную travel-историю.',
    bullets: ['Демо-пример книги', 'Память о поездках', 'Планирование новых выездов', 'Можно поделиться с друзьями'],
    cta: 'Открыть книгу путешествий',
    path: '/export',
  },
] as const;

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
      const guestAllowedTargets = ['/search', '/travelsby', '/map', '/roulette'];

      if (!isAuthenticated && !guestAllowedTargets.includes(target)) {
        router.push(buildLoginHref({ redirect: target, intent: 'create-book' }) as any);
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
      maxWidth: 640,
    },
    useCases: {
      marginBottom: isMobile ? 20 : 28,
      alignItems: 'stretch',
    },
    useCaseCard: {
      flex: 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: isMobile ? 18 : 24,
      gap: 12,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
          transition: 'all 0.3s ease',
        } as any,
      }),
    },
    useCaseCardIdea: {
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(155deg, ${colors.primarySoft} 0%, ${colors.surface} 45%)`,
          backgroundRepeat: 'no-repeat',
        },
      }),
    },
    useCaseCardBook: {
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(155deg, ${colors.backgroundSecondary} 0%, ${colors.surface} 38%)`,
          backgroundRepeat: 'no-repeat',
        },
      }),
    },
    useCaseCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-3px)',
          borderColor: colors.primaryAlpha30,
          boxShadow: DESIGN_TOKENS.shadows.hover,
        },
      }),
    },
    useCaseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    useCaseTag: {
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    useCaseTagText: {
      color: colors.primaryText,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    useCaseIconWrap: {
      width: 36,
      height: 36,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    useCaseTitle: {
      color: colors.text,
      fontSize: isMobile ? 18 : 20,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    useCaseDescription: {
      color: colors.textMuted,
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 20 : 22,
    },
    useCaseBullets: {
      gap: 8,
      marginTop: 2,
    },
    useCaseBullet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    useCaseBulletText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    useCaseCta: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    useCaseCtaText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '700',
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
            Два сценария, которые закрывает MeTravel
          </ResponsiveText>
          <Text style={styles.headerSubtitle}>
            1) Не знаешь куда поехать на выходных. 2) Хочешь вести личную книгу путешествий.
          </Text>
        </View>

        <ResponsiveStack direction={isMobile ? 'vertical' : 'horizontal'} gap={isMobile ? 16 : 20} style={styles.useCases}>
          {USE_CASES.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => handleStepPress(item.path)}
              style={({ pressed, hovered }) => [
                styles.useCaseCard,
                item.key === 'idea' ? styles.useCaseCardIdea : styles.useCaseCardBook,
                (pressed || hovered) && styles.useCaseCardHover,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityHint={item.description}
              {...pressableProps}
            >
              <View style={styles.useCaseTag}>
                <Text style={styles.useCaseTagText}>{item.tag}</Text>
              </View>

              <View style={styles.useCaseHeader}>
                <View style={styles.useCaseIconWrap}>
                  <Feather name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={styles.useCaseTitle}>{item.title}</Text>
              </View>

              <Text style={styles.useCaseDescription}>{item.description}</Text>

              <View style={styles.useCaseBullets}>
                {item.bullets.map((bullet) => (
                  <View key={bullet} style={styles.useCaseBullet}>
                    <Feather name="check-circle" size={14} color={colors.primary} />
                    <Text style={styles.useCaseBulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.useCaseCta}>
                <Text style={styles.useCaseCtaText}>{item.cta}</Text>
                <Feather name="arrow-right" size={14} color={colors.primaryText} />
              </View>
            </Pressable>
          ))}
        </ResponsiveStack>

        <View style={styles.header}>
          <ResponsiveText variant="h2" style={styles.title}>
            Мини-onboarding за 3 шага
          </ResponsiveText>
          <Text style={styles.headerSubtitle}>
            Выбери поездку {'->'} сохрани {'->'} получи личную книгу путешествий
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
