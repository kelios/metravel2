import { useMemo, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveText, ResponsiveStack } from '@/components/layout';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { buildLoginHref } from '@/utils/authNavigation';
import { queueAnalyticsEvent } from '@/utils/analytics';

interface HomeHeroProps {
  travelsCount?: number;
}

const QUICK_FILTER_BADGES = [
  { icon: 'navigation', label: 'Маршруты до 200 км' },
  { icon: 'map-pin', label: 'С готовыми точками на карте' },
  { icon: 'sun', label: 'Природа, город или актив' },
  { icon: 'clock', label: '1 день или уикенд' },
];

const MOOD_CARDS = [
  { title: 'У озера за выходные', meta: 'Природа • 2 дня • до 180 км', icon: 'sun' },
  { title: 'Город и кофе', meta: 'Город • 1 день • неспешный ритм', icon: 'coffee' },
  { title: 'Активный выезд', meta: 'Треккинг • 2 дня • больше движения', icon: 'activity' },
] as const;

const VALUE_STRIPS = [
  { icon: 'compass', label: 'Идея поездки за 2 минуты' },
  { icon: 'book-open', label: 'Личная книга поездок' },
  { icon: 'share-2', label: 'PDF или ссылка для друзей' },
] as const;

const HomeHero = memo(function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone } = useResponsive();

  const isWeb = Platform.OS === 'web';

  const handleCreateBook = () => {
    queueAnalyticsEvent('HomeClick_CreateBook');
    if (!isAuthenticated) {
      router.push(buildLoginHref({ redirect: '/', intent: 'create-book' }) as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  };

  const handleOpenSearch = () => {
    queueAnalyticsEvent('HomeClick_OpenSearch');
    router.push('/search' as any);
  };

  const handleQuickFilterPress = (label: string) => {
    queueAnalyticsEvent('HomeClick_QuickFilter', { label, source: 'home-hero' });
    router.push('/search' as any);
  };

  const handleOpenArticles = () => {
    queueAnalyticsEvent('HomeClick_OpenArticles');
    router.push('/articles' as any);
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Начать и создать книгу';
    if (travelsCount === 0) return 'Сохранить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const travelStatsValue = useMemo(() => {
    if (travelsCount <= 0) return 'Демо: 12 маршрутов';
    if (travelsCount === 1) return '1 поездка';
    if (travelsCount < 5) return `${travelsCount} поездки`;
    return `${travelsCount} поездок`;
  }, [travelsCount]);

  const travelStatsMeta = travelsCount > 0
    ? 'в вашей книге путешествий'
    : 'как может выглядеть ваша книга';

  const isMobile = isSmallPhone || isPhone;
  const shouldRenderImageSlot = isWeb && !isMobile;

  // Preload removed: the <img loading="eager"> already fetches the image.
  // A separate <link rel="preload"> caused "preloaded but not used" warnings,
  // especially on mobile where the image slot is CSS-hidden (<768px).

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 58,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 85% 60% at 74% 36%, ${colors.primarySoft} 0%, transparent 68%), radial-gradient(ellipse 70% 54% at 8% 18%, ${colors.primaryLight} 0%, transparent 72%), linear-gradient(120deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    bandMobile: {
      paddingVertical: 34,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 125% 52% at 50% 22%, ${colors.primarySoft} 0%, transparent 70%), linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    bandGrid: {
      position: 'absolute',
      inset: 0,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(0deg, transparent 24%, ${colors.primaryAlpha30} 25%, transparent 26%, transparent 74%, ${colors.primaryAlpha30} 75%, transparent 76%), linear-gradient(90deg, transparent 24%, ${colors.primaryAlpha30} 25%, transparent 26%, transparent 74%, ${colors.primaryAlpha30} 75%, transparent 76%)`,
          backgroundSize: '58px 58px',
          opacity: 0.12,
          pointerEvents: 'none',
        } as any,
      }),
    },
    decorOrb: {
      position: 'absolute',
      borderRadius: DESIGN_TOKENS.radii.full,
      ...Platform.select({
        web: {
          filter: 'blur(2px)',
        },
      }),
    },
    decorOrbTop: {
      width: 280,
      height: 280,
      top: -120,
      right: -70,
      backgroundColor: colors.primarySoft,
      opacity: 0.8,
    },
    decorOrbBottom: {
      width: 220,
      height: 220,
      bottom: -120,
      left: -70,
      backgroundColor: colors.primaryLight,
      opacity: 0.7,
    },
    heroFrame: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surfaceAlpha40,
      paddingHorizontal: isMobile ? 16 : 28,
      paddingVertical: isMobile ? 18 : 30,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
          backdropFilter: 'blur(14px)',
        } as any,
      }),
    },
    heroFrameMobile: {
      paddingHorizontal: 14,
      paddingVertical: 16,
    },
    content: {
      flex: 1,
      width: '100%',
      gap: isMobile ? 14 : 18,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    titleWrap: {
      gap: 8,
      maxWidth: 640,
    },
    positioning: {
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    positioningText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textMuted,
      maxWidth: 620,
      fontSize: isMobile ? 16 : 18,
      lineHeight: isMobile ? 24 : 27,
      fontWeight: '500',
    },
    flowText: {
      color: colors.text,
      fontSize: isMobile ? 13 : 15,
      lineHeight: isMobile ? 20 : 22,
      fontWeight: '600',
      maxWidth: 580,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    valueStrips: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    valueStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: 11,
      paddingVertical: 7,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    valueStripText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    contentLink: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 13,
      paddingVertical: 9,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    contentLinkHover: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    contentLinkText: {
      color: colors.primaryText,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    quickFilters: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
      marginTop: 4,
    },
    quickFilterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backdropFilter: 'blur(6px)',
          transition: 'all 0.2s ease',
        },
      }),
    },
    quickFilterItemHover: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    quickFilterText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    hint: {
      fontSize: isMobile ? 13 : 15,
      color: colors.textMuted,
      lineHeight: isMobile ? 20 : 24,
      marginTop: 6,
      paddingLeft: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      maxWidth: 560,
    },
    buttonsContainer: {
      marginTop: isMobile ? 14 : 22,
      width: '100%',
    },
    primaryButton: {
      paddingHorizontal: 28,
      paddingVertical: 16,
      minHeight: 58,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          flex: 1,
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 0 0 0 ${colors.primarySoft}`,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 0 24px ${colors.primaryAlpha30}`,
          transform: 'translateY(-2px)',
        },
      }),
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 24,
      paddingVertical: 14,
      gap: 8,
      minHeight: 58,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          flex: 1,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(8px)',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transform: 'translateY(-1px)',
        },
      }),
    },
    secondaryButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    imageContainer: {
      flex: 1,
      minHeight: 440,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imageDecor: {
      position: 'absolute',
      width: 388,
      height: 470,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.primarySoft,
      opacity: 0.75,
      ...Platform.select({
        web: {
          transform: 'rotate(4deg) translate(16px, 14px)',
        },
      }),
    },
    moodPanel: {
      position: 'absolute',
      left: -58,
      top: 18,
      width: 222,
      gap: 10,
    },
    moodPanelMobileHidden: {
      display: 'none',
    },
    moodCard: {
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 11,
      paddingVertical: 9,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.25s ease',
        },
      }),
    },
    moodCardHover: {
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateX(5px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    moodCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    moodCardTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    moodCardMeta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    travelStats: {
      position: 'absolute',
      right: -30,
      top: 28,
      width: 232,
      minHeight: 102,
      maxHeight: 116,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: 13,
      paddingVertical: 11,
      gap: 3,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          backdropFilter: 'blur(10px)',
        },
      }),
    },
    travelStatsTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    travelStatsValue: {
      color: colors.primaryText,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
    },
    travelStatsMeta: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    imagePlaceholder: {
      width: 320,
      height: 400,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.lg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
        },
      }),
    },
    imagePlaceholderText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    bookImage: {
      width: 267,
      height: 400,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          boxShadow: `${DESIGN_TOKENS.shadows.modal}, 0 10px 36px ${colors.primaryAlpha30}`,
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s ease',
          transform: 'rotate(-1.5deg)',
        },
      }),
    },
    bookImageHover: {
      ...Platform.select({
        web: {
          transform: 'rotate(0deg) scale(1.03)',
          boxShadow: `${DESIGN_TOKENS.shadows.modal}, 0 12px 40px ${colors.primaryAlpha40}`,
        },
      }),
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-hero" style={[styles.band, isMobile && styles.bandMobile]}>
      <View style={styles.bandGrid} />
      <View style={[styles.decorOrb, styles.decorOrbTop]} />
      <View style={[styles.decorOrb, styles.decorOrbBottom]} />
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={[styles.heroFrame, isMobile && styles.heroFrameMobile]}>
          <ResponsiveStack testID="home-hero-stack" direction="responsive" gap={isMobile ? 24 : 52} align="center">
            <View style={styles.content}>
            <View style={styles.positioning}>
              <Text style={styles.positioningText}>Маршрут за 2 минуты</Text>
            </View>

            <View style={styles.titleWrap}>
              <ResponsiveText variant="h1" style={styles.title}>
                Поездки на выходные + личная книга путешествий
              </ResponsiveText>
            </View>

            <ResponsiveText variant="h2" style={styles.subtitle}>
              Выбирай готовые маршруты по расстоянию и формату отдыха. Сохраняй поездки с фото и заметками и собирай красивую книгу, которой хочется делиться.
            </ResponsiveText>

            <Text style={styles.flowText}>
              1. Выбери маршрут {'->'} 2. Сохрани поездку {'->'} 3. Получи книгу в PDF.
            </Text>

            <View style={styles.valueStrips}>
              {VALUE_STRIPS.map((item) => (
                <View key={item.label} style={styles.valueStrip}>
                  <Feather name={item.icon as any} size={12} color={colors.primary} />
                  <Text style={styles.valueStripText}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleOpenArticles}
              style={({ pressed, hovered }) => [
                styles.contentLink,
                (pressed || hovered) && styles.contentLinkHover,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Открыть статьи и реальные маршруты"
            >
              <Feather name="book" size={14} color={colors.primary} />
              <Text style={styles.contentLinkText}>Открыть статьи и реальные маршруты</Text>
              <Feather name="arrow-right" size={14} color={colors.primaryText} />
            </Pressable>

            <View style={styles.quickFilters}>
              {QUICK_FILTER_BADGES.map((badge) => (
                <Pressable
                  key={badge.label}
                  onPress={() => handleQuickFilterPress(badge.label)}
                  style={({ pressed, hovered }) => [
                    styles.quickFilterItem,
                    (pressed || hovered) && styles.quickFilterItemHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Быстрый фильтр ${badge.label}`}
                >
                  <Feather name={badge.icon as any} size={14} color={colors.primary} />
                  <Text style={styles.quickFilterText}>{badge.label}</Text>
                </Pressable>
              ))}
            </View>

            {travelsCount === 0 && isAuthenticated && (
              <Text style={styles.hint}>
                Добавь первую поездку и сразу получишь основу для личной книги путешествий.
              </Text>
            )}

              <ResponsiveStack
                direction={isMobile ? 'vertical' : 'horizontal'}
                gap={isMobile ? 12 : 16}
                style={styles.buttonsContainer}
              >
              <Button
                onPress={handleOpenSearch}
                label="Подобрать маршрут"
                variant="primary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                icon={<Feather name="compass" size={18} color={colors.textOnPrimary} />}
                style={styles.primaryButton}
                labelStyle={styles.primaryButtonText}
                hoverStyle={styles.primaryButtonHover}
                pressedStyle={styles.primaryButtonHover}
                accessibilityLabel="Подобрать маршрут"
              />

              <Button
                onPress={handleCreateBook}
                label={primaryButtonLabel}
                variant="secondary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                hoverStyle={styles.secondaryButtonHover}
                pressedStyle={styles.secondaryButtonHover}
              />
              </ResponsiveStack>
            </View>

            {shouldRenderImageSlot && (
              <Pressable
                testID="home-hero-image-slot"
                onPress={handleOpenArticles}
                accessibilityRole="button"
                accessibilityLabel="Открыть раздел статей и маршрутов"
                style={[
                  styles.imageContainer,
                  isWeb && ({ cursor: 'pointer' } as any),
                ]}
              >
                {({ hovered }) => (
                  <>
                    <View style={styles.imageDecor} />
                    <View style={[styles.moodPanel, isMobile && styles.moodPanelMobileHidden]}>
                      {MOOD_CARDS.map((card) => (
                        <Pressable
                          key={card.title}
                          onPress={() => handleQuickFilterPress(card.meta)}
                          style={({ pressed, hovered }) => [
                            styles.moodCard,
                            (pressed || hovered) && styles.moodCardHover,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Идея поездки ${card.title}`}
                        >
                          <View style={styles.moodCardHeader}>
                            <Feather name={card.icon as any} size={13} color={colors.primary} />
                            <Text style={styles.moodCardTitle}>{card.title}</Text>
                          </View>
                          <Text style={styles.moodCardMeta}>{card.meta}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <ImageCardMedia
                      source={require('../../assets/images/pdf.webp')}
                      width={267}
                      height={400}
                      borderRadius={DESIGN_TOKENS.radii.lg}
                      fit="cover"
                      quality={90}
                      alt="Пример книги путешествий"
                      loading={Platform.OS === 'web' ? 'eager' : 'lazy'}
                      priority={Platform.OS === 'web' ? 'high' : 'normal'}
                      transition={300}
                      style={[styles.bookImage, hovered && styles.bookImageHover]}
                    />
                    <View style={styles.travelStats}>
                      <Text style={styles.travelStatsTitle}>Книга путешествий</Text>
                      <Text style={styles.travelStatsValue}>{travelStatsValue}</Text>
                      <Text style={styles.travelStatsMeta}>{travelStatsMeta}</Text>
                    </View>
                  </>
                )}
              </Pressable>
            )}
          </ResponsiveStack>
        </View>
      </ResponsiveContainer>
    </View>
  );
});


export default HomeHero;
