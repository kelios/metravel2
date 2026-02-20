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
    title: 'Найди маршрут',
    description: 'Фильтруй по расстоянию, формату и длительности — сразу видишь подходящие варианты',
    icon: 'compass',
    path: '/search',
  },
  {
    number: 2,
    title: 'Сохрани в коллекцию',
    description: 'Добавь поездку в книгу, оставь заметки и фото — всё будет под рукой',
    icon: 'bookmark',
    path: '/search',
  },
  {
    number: 3,
    title: 'Поделись книгой',
    description: 'Скачай PDF или отправь ссылку — книга готова за пару минут',
    icon: 'share-2',
    path: '/export',
  },
];

const USE_CASES = [
  {
    key: 'idea',
    tag: 'Сценарий 1',
    title: 'Нужна идея на выходные',
    icon: 'navigation',
    description: 'Укажи расстояние, формат и длительность — и сразу увидишь подходящие маршруты.',
    result: 'Готовый список вариантов за пару минут',
    bullets: ['До 100, 200 или 300+ км', 'Соло, парой или компанией', 'Природа, город или актив', '1 день или выходные'],
    cta: 'Найти маршрут',
    path: '/search',
  },
  {
    key: 'book',
    tag: 'Сценарий 2',
    title: 'Хочу сохранить лучшие поездки',
    icon: 'book-open',
    description: 'Собирай маршруты в личную книгу — чтобы возвращаться к ним и делиться с близкими.',
    result: 'Красивая книга путешествий в пару кликов',
    bullets: ['Готовый демо-пример', 'Фото, заметки и точки маршрута', 'План следующих выездов', 'Экспорт в PDF или ссылка'],
    cta: 'Начать собирать',
    path: '/search',
  },
] as const;

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
      paddingVertical: isMobile ? 36 : 56,
      backgroundColor: colors.background,
    },
    panel: {
      gap: isMobile ? 20 : 28,
    },
    header: {
      marginBottom: isMobile ? 20 : 30,
      alignItems: 'center',
      gap: 9,
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
      marginBottom: isMobile ? 24 : 34,
      alignItems: 'stretch',
    },
    useCaseCard: {
      flex: 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      padding: isMobile ? 18 : 24,
      gap: 13,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
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
          transform: 'translateY(-4px)',
          borderColor: colors.primary,
          boxShadow: DESIGN_TOKENS.shadows.hover,
        },
      }),
    },
    useCaseAccent: {
      height: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      marginBottom: 4,
      opacity: 0.9,
    },
    useCaseAccentIdea: {
      backgroundColor: colors.primary,
    },
    useCaseAccentBook: {
      backgroundColor: colors.textMuted,
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
    useCaseResult: {
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    useCaseResultText: {
      color: colors.primaryText,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
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
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          backgroundImage: `linear-gradient(165deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'pan-y',
        } as any,
      }),
    },
    stepNumber: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: isMobile ? 10 : 14,
    },
    stepHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px)',
          boxShadow: DESIGN_TOKENS.shadows.hover,
          borderColor: colors.primary,
        },
        default: {},
      }),
    },
    stepHeader: {
      marginBottom: isMobile ? 8 : 12,
    },
    iconContainer: {
      width: isMobile ? 48 : 56,
      height: isMobile ? 48 : 56,
      borderRadius: DESIGN_TOKENS.radii.md,
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
    numberBadge: {},
    numberText: {},
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
    sectionDivider: {
      height: 1,
      width: '100%',
      backgroundColor: colors.borderLight,
      marginBottom: isMobile ? 20 : 30,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-how-it-works" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.panel}>
          <View style={styles.header}>
            <ResponsiveText variant="h2" style={styles.title}>
              Как это работает
            </ResponsiveText>
            <Text style={styles.headerSubtitle}>
              Выбери сценарий под себя: найти маршрут на выходные или собрать личную книгу поездок.
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
                <View style={[styles.useCaseAccent, item.key === 'idea' ? styles.useCaseAccentIdea : styles.useCaseAccentBook]} />
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
                <View style={styles.useCaseResult}>
                  <Text style={styles.useCaseResultText}>{item.result}</Text>
                </View>

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

          <View style={styles.sectionDivider} />

          <View style={styles.header}>
            <ResponsiveText variant="h2" style={styles.title}>
              Три шага до готовой книги
            </ResponsiveText>
            <Text style={styles.headerSubtitle}>
              Нашёл → сохранил → поделился
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
                  <Text style={styles.stepNumber}>Шаг {step.number}</Text>
                  <View style={styles.stepHeader}>
                    <View style={styles.iconContainer}>
                      <Feather
                        name={step.icon as any}
                        size={26}
                        color={colors.primary}
                      />
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
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeHowItWorks);
