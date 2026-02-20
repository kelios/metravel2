import { useMemo, memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveStack } from '@/components/layout';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { buildLoginHref } from '@/utils/authNavigation';
import { queueAnalyticsEvent } from '@/utils/analytics';

interface HomeHeroProps {
  travelsCount?: number;
}

const BOOK_IMAGES = [
  {
    source: require('../../assets/images/pdf.webp'),
    alt: 'Пример книги путешествий',
  },
  {
    source: require('../../assets/images/pdf2.png'),
    alt: 'Книга путешествий — Озеро Карецца',
  },
] as const;

const MOOD_CARDS = [
  { title: 'У озера за выходные', meta: 'Природа • 2 дня • до 180 км', icon: 'sun' },
  { title: 'Город и кофе', meta: 'Город • 1 день • спокойный темп', icon: 'coffee' },
  { title: 'Активный выезд', meta: 'Треккинг • 2 дня • больше движения', icon: 'activity' },
] as const;

const FEATURE_PILLS = [
  { icon: 'map-pin', label: 'Готовые точки на карте' },
  { icon: 'clock', label: '1 день или выходные' },
  { icon: 'navigation', label: 'До 200 км от дома' },
  { icon: 'book-open', label: 'Личная книга поездок' },
] as const;

const STATS = [
  { value: '200+', label: 'маршрутов' },
  { value: '0 ₽', label: 'бесплатно' },
  { value: '2 мин', label: 'до идеи' },
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
    queueAnalyticsEvent('HomeClick_OpenSearch');
    router.push('/search' as any);
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Создать книгу путешествий';
    if (travelsCount === 0) return 'Добавить первую поездку';
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

  const [bookImageIndex, setBookImageIndex] = useState(0);

  useEffect(() => {
    if (!shouldRenderImageSlot) return;
    const timer = setInterval(() => {
      setBookImageIndex((prev) => (prev + 1) % BOOK_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [shouldRenderImageSlot]);

  // Preload removed: the <img loading="eager"> already fetches the image.
  // A separate <link rel="preload"> caused "preloaded but not used" warnings,
  // especially on mobile where the image slot is CSS-hidden (<768px).

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingTop: isMobile ? 32 : 52,
      paddingBottom: isMobile ? 32 : 56,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 90% 70% at 68% 30%, ${colors.primarySoft} 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 5% 10%, ${colors.primaryLight} 0%, transparent 65%), linear-gradient(160deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    bandMobile: {
      paddingTop: 32,
      paddingBottom: 32,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 130% 55% at 50% 18%, ${colors.primarySoft} 0%, transparent 65%), linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    decorOrb: {
      position: 'absolute',
      borderRadius: DESIGN_TOKENS.radii.full,
      ...Platform.select({
        web: {
          filter: 'blur(60px)',
          pointerEvents: 'none',
        } as any,
      }),
    },
    decorOrbTop: {
      width: 400,
      height: 400,
      top: -180,
      right: -100,
      backgroundColor: colors.primarySoft,
      opacity: 0.5,
    },
    decorOrbBottom: {
      width: 300,
      height: 300,
      bottom: -160,
      left: -80,
      backgroundColor: colors.primaryLight,
      opacity: 0.4,
    },
    content: {
      flex: 1,
      width: '100%',
      gap: isMobile ? 14 : 20,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    titleWrap: {
      gap: 0,
      maxWidth: isMobile ? '100%' as const : 580,
    },
    title: {
      color: colors.text,
      letterSpacing: -1,
      lineHeight: isMobile ? 40 : 56,
      fontSize: isMobile ? 32 : 46,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      maxWidth: 500,
      fontSize: isMobile ? 15 : 17,
      lineHeight: isMobile ? 23 : 26,
      fontWeight: '400',
      marginTop: isMobile ? 10 : 14,
    },
    featurePills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      maxWidth: isMobile ? '100%' as const : 480,
    },
    featurePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    featurePillText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? 16 : 24,
    },
    statItem: {
      gap: 2,
      alignItems: 'flex-start',
    },
    statItemFirst: {},
    statValue: {
      color: colors.text,
      fontSize: isMobile ? 20 : 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      lineHeight: isMobile ? 26 : 30,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
    },
    statWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? 16 : 24,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },
    hint: {
      fontSize: isMobile ? 13 : 14,
      color: colors.textMuted,
      lineHeight: isMobile ? 20 : 22,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
      maxWidth: 520,
    },
    buttonsContainer: {
      width: '100%',
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 24 : 32,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: isMobile ? 50 : 54,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          transition: 'all 0.2s ease',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 0 28px ${colors.primaryAlpha30}`,
        },
      }),
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: isMobile ? 15 : 16,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: isMobile ? 20 : 28,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: isMobile ? 50 : 54,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: isMobile ? 15 : 16,
      fontWeight: '500',
    },
    imageContainer: {
      flex: 1,
      minHeight: 460,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imageDecor: {
      position: 'absolute',
      width: 320,
      height: 450,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.primaryLight,
      opacity: 0.55,
      ...Platform.select({
        web: {
          transform: 'rotate(6deg) translate(22px, 8px)',
          filter: 'blur(2px)',
        } as any,
      }),
    },
    imageDecor2: {
      position: 'absolute',
      width: 290,
      height: 420,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.7,
      ...Platform.select({
        web: {
          transform: 'rotate(-3deg) translate(-12px, 16px)',
        } as any,
      }),
    },
    moodPanel: {
      position: 'absolute',
      left: -52,
      top: 24,
      width: 200,
      gap: 8,
    },
    moodCard: {
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s ease',
        },
      }),
    },
    moodCardHover: {
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateX(4px)',
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
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    moodCardMeta: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    travelStats: {
      position: 'absolute',
      right: -20,
      bottom: 44,
      width: 196,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
          backdropFilter: 'blur(12px)',
        },
      }),
    },
    travelStatsLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    travelStatsTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '500',
      lineHeight: 15,
    },
    travelStatsValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
      letterSpacing: -0.3,
    },
    travelStatsMeta: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    bookImage: {
      width: 260,
      height: 390,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          boxShadow: `${DESIGN_TOKENS.shadows.modal}, 0 12px 40px ${colors.primaryAlpha30}`,
          transition: 'transform 0.35s ease, box-shadow 0.35s ease',
          transform: 'rotate(-1deg)',
        },
      }),
    },
    bookImageHover: {
      ...Platform.select({
        web: {
          transform: 'rotate(0deg) scale(1.02)',
          boxShadow: `${DESIGN_TOKENS.shadows.modal}, 0 16px 48px ${colors.primaryAlpha40}`,
        },
      }),
    },
    bookImageWrap: {
      position: 'relative',
    },
    bookDots: {
      position: 'absolute',
      bottom: -20,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    bookDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      ...Platform.select({
        web: { transition: 'all 0.3s ease' },
      }),
    },
    bookDotActive: {
      width: 18,
      backgroundColor: colors.primary,
    },
  }), [colors, isMobile]);

  return (
    <View testID="home-hero" style={[styles.band, isMobile && styles.bandMobile]}>
      <View style={[styles.decorOrb, styles.decorOrbTop]} />
      <View style={[styles.decorOrb, styles.decorOrbBottom]} />
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack testID="home-hero-stack" direction="responsive" gap={isMobile ? 32 : 64} align="center">
          <View style={styles.content}>
            <View style={styles.eyebrow}>
              <Feather name="zap" size={11} color={colors.primary} />
              <Text style={styles.eyebrowText}>Бесплатно • Без регистрации</Text>
            </View>

            <View style={styles.titleWrap}>
              <Text style={styles.title}>
                Выходные с умом — и книга поездок в подарок
              </Text>
              <Text style={styles.subtitle}>
                Выбирай маршруты по расстоянию и формату. Сохраняй поездки с фото и заметками. Собирай книгу, которой хочется делиться.
              </Text>
            </View>

            <View style={styles.featurePills}>
              {FEATURE_PILLS.map((pill) => (
                <View key={pill.label} style={styles.featurePill}>
                  <Feather name={pill.icon as any} size={13} color={colors.primary} />
                  <Text style={styles.featurePillText}>{pill.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.statsRow}>
              {STATS.map((stat, idx) => (
                <View key={stat.value} style={styles.statWrapper}>
                  {idx > 0 && <View style={styles.statDivider} />}
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                </View>
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
                onPress={handleCreateBook}
                label={primaryButtonLabel}
                variant="primary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                style={styles.primaryButton}
                labelStyle={styles.primaryButtonText}
                hoverStyle={styles.primaryButtonHover}
                pressedStyle={styles.primaryButtonHover}
                accessibilityLabel={primaryButtonLabel}
              />

              <Button
                onPress={handleOpenSearch}
                label="Смотреть маршруты"
                variant="secondary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                icon={<Feather name="compass" size={16} color={colors.text} />}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                hoverStyle={styles.secondaryButtonHover}
                pressedStyle={styles.secondaryButtonHover}
                accessibilityLabel="Смотреть маршруты"
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
                  <View style={styles.imageDecor2} />
                  <View style={styles.moodPanel}>
                    {MOOD_CARDS.map((card) => (
                      <Pressable
                        key={card.title}
                        onPress={() => handleQuickFilterPress(card.meta)}
                        style={({ pressed, hovered: h }) => [
                          styles.moodCard,
                          (pressed || h) && styles.moodCardHover,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Идея поездки ${card.title}`}
                      >
                        <View style={styles.moodCardHeader}>
                          <Feather name={card.icon as any} size={12} color={colors.primary} />
                          <Text style={styles.moodCardTitle}>{card.title}</Text>
                        </View>
                        <Text style={styles.moodCardMeta}>{card.meta}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.bookImageWrap}>
                    <ImageCardMedia
                      source={BOOK_IMAGES[bookImageIndex].source}
                      width={260}
                      height={390}
                      borderRadius={DESIGN_TOKENS.radii.lg}
                      fit="cover"
                      quality={90}
                      alt={BOOK_IMAGES[bookImageIndex].alt}
                      loading={Platform.OS === 'web' ? 'eager' : 'lazy'}
                      priority={Platform.OS === 'web' ? 'high' : 'normal'}
                      transition={300}
                      style={[styles.bookImage, hovered && styles.bookImageHover]}
                    />
                    <View style={styles.bookDots}>
                      {BOOK_IMAGES.map((_, i) => (
                        <View
                          key={i}
                          style={[styles.bookDot, i === bookImageIndex && styles.bookDotActive]}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}
            </Pressable>
          )}
        </ResponsiveStack>
      </ResponsiveContainer>
    </View>
  );
});


export default HomeHero;
