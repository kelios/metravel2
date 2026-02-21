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
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

interface HomeHeroProps {
  travelsCount?: number;
}

const BOOK_IMAGES = [
  {
    source: require('../../assets/images/pdf.webp'),
    alt: 'Тропа ведьм — Германия',
    title: 'Тропа ведьм',
    subtitle: 'Хайкинг • Горный маршрут • Германия',
    href: 'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele',
  },
  {
    source: require('../../assets/images/cover_sorapiso.jpg'),
    alt: 'Озеро Сорапис — Доломиты',
    title: 'Озеро Сорапис',
    subtitle: 'Поход по Доломитам • Озеро • Италия',
    href: 'https://metravel.by/travels/ozero-sorapis-pokhod-po-marshrutam-215-i-217-v-dolomitakh',
  },
  {
    source: require('../../assets/images/cover_trecime.jpg'),
    alt: 'Tre Cime di Lavaredo — Доломиты',
    title: 'Tre Cime di Lavaredo',
    subtitle: 'Круговой маршрут 10 км • Горы • Италия',
    href: 'https://metravel.by/travels/tre-cime-di-lavaredo-krugovoi-marshrut-10-km-opisanie-i-vidy',
  },
  {
    source: require('../../assets/images/cover_bled.jpg'),
    alt: 'Озеро Блед — Словения',
    title: 'Озеро Блед',
    subtitle: 'Что посмотреть за 1 день • Озеро • Словения',
    href: 'https://metravel.by/travels/vintgarskoe-ushchele-i-ozero-bled-chto-posmotret-v-slovenii-za-1-den',
  },
];

export const BOOK_IMAGES_FOR_TEST = BOOK_IMAGES;

const MOOD_CARDS = [
  {
    title: 'У озера за выходные',
    meta: 'Природа • 2 дня • до 180 км',
    icon: 'sun',
    filterParams: 'categories=2,21&over_nights_stay=1&categoryTravelAddress=84',
  },
  {
    title: 'Город и кофе',
    meta: 'Город • 1 день • спокойный темп',
    icon: 'coffee',
    filterParams: 'categories=19,20',
  },
  {
    title: 'Активный выезд',
    meta: 'Треккинг • 2 дня • больше движения',
    icon: 'activity',
    filterParams: 'categories=22,2',
  },
] as const;

export const MOOD_CARDS_FOR_TEST = MOOD_CARDS;

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

  const handleQuickFilterPress = (label: string, filterParams?: string) => {
    queueAnalyticsEvent('HomeClick_QuickFilter', { label, source: 'home-hero' });
    const path = filterParams ? `/search?${filterParams}` : '/search';
    router.push(path as any);
  };

  const handleOpenArticles = (href?: string | null) => {
    if (href) {
      queueAnalyticsEvent('HomeClick_BookCover', { href });
      if (Platform.OS === 'web') {
        openExternalUrlInNewTab(href);
      } else {
        openExternalUrl(href);
      }
    } else {
      queueAnalyticsEvent('HomeClick_OpenSearch');
      router.push('/search' as any);
    }
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Создать книгу путешествий';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const shouldRenderImageSlot = isWeb && !isMobile;

  const handleMoodCardPress = (
    e: any,
    label: string,
    filterParams?: string,
  ) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    handleQuickFilterPress(label, filterParams);
  };

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
      paddingTop: isMobile ? 40 : 64,
      paddingBottom: isMobile ? 40 : 72,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 80% 60% at 75% 20%, ${colors.primarySoft} 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 10% 20%, ${colors.primaryLight} 0%, transparent 60%), linear-gradient(170deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    bandMobile: {
      paddingTop: 36,
      paddingBottom: 40,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 120% 50% at 50% 15%, ${colors.primarySoft} 0%, transparent 60%), linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
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
      gap: isMobile ? 16 : 24,
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
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    eyebrowText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    titleWrap: {
      gap: 0,
      maxWidth: isMobile ? '100%' as const : 640,
    },
    title: {
      color: colors.text,
      letterSpacing: -1.2,
      lineHeight: isMobile ? 42 : 62,
      fontSize: isMobile ? 36 : 52,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.textMuted,
      maxWidth: 540,
      fontSize: isMobile ? 16 : 18,
      lineHeight: isMobile ? 24 : 28,
      fontWeight: '400',
      marginTop: isMobile ? 12 : 16,
    },
    featurePills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      maxWidth: isMobile ? '100%' as const : 520,
    },
    featurePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'all 0.2s ease',
        },
      }),
    },
    featurePillText: {
      color: colors.textMuted,
      fontSize: 13,
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
      marginTop: 8,
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 24 : 36,
      paddingVertical: isMobile ? 16 : 18,
      minHeight: isMobile ? 54 : 58,
      borderRadius: DESIGN_TOKENS.radii.pill,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 8px 24px ${colors.primaryAlpha40}`,
        },
      }),
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: isMobile ? 16 : 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      paddingHorizontal: isMobile ? 24 : 32,
      paddingVertical: isMobile ? 16 : 18,
      minHeight: isMobile ? 54 : 58,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: isMobile ? 16 : 17,
      fontWeight: '600',
    },
    imageContainer: {
      flex: 1,
      minHeight: 480,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imageDecor: {
      position: 'absolute',
      width: 340,
      height: 470,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.primarySoft,
      opacity: 0.6,
      ...Platform.select({
        web: {
          transform: 'rotate(5deg) translate(24px, 12px)',
          filter: 'blur(1px)',
          transition: 'all 0.4s ease',
        } as any,
      }),
    },
    imageDecor2: {
      position: 'absolute',
      width: 310,
      height: 440,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      opacity: 0.8,
      ...Platform.select({
        web: {
          transform: 'rotate(-4deg) translate(-16px, 12px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
          transition: 'all 0.4s ease',
        } as any,
      }),
    },
    moodPanel: {
      position: 'absolute',
      left: -32,
      top: 32,
      width: 220,
      gap: 12,
      zIndex: 10,
    },
    moodCard: {
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.8)',
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...Platform.select({
        web: {
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    moodCardHover: {
      borderColor: colors.primaryAlpha40,
      backgroundColor: 'rgba(255,255,255,0.95)',
      ...Platform.select({
        web: {
          transform: 'translateX(6px) translateY(-2px)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
        },
      }),
    },
    moodCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    moodCardTitle: {
      color: '#1a1a1a', // Always dark for contrast on glass
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    moodCardMeta: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
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
    bookOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderBottomLeftRadius: DESIGN_TOKENS.radii.lg,
      borderBottomRightRadius: DESIGN_TOKENS.radii.lg,
      paddingHorizontal: 14,
      paddingTop: 32,
      paddingBottom: 14,
      gap: 3,
      ...Platform.select({
        web: {
          backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.72))',
        },
      }),
    },
    bookOverlayTitle: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      letterSpacing: -0.2,
      ...Platform.select({
        web: { textShadow: '0 1px 4px rgba(0,0,0,0.5)' },
      }),
    },
    bookOverlaySubtitle: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 15,
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

  const moodCardWebStyle = useMemo(() => {
    if (!isWeb) return undefined;
    const flat = StyleSheet.flatten(styles.moodCard) as any;
    return {
      ...(flat || {}),
      cursor: 'pointer',
    } as any;
  }, [isWeb, styles.moodCard]);

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
              onPress={() => handleOpenArticles(BOOK_IMAGES[bookImageIndex].href)}
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
                      <div
                        key={card.title}
                        role="button"
                        tabIndex={0}
                        data-card-action="true"
                        aria-label={`Идея поездки ${card.title}`}
                        onClick={(e: any) => handleMoodCardPress(e, card.meta, card.filterParams)}
                        onKeyDown={(e: any) => {
                          if (e?.key === 'Enter' || e?.key === ' ') {
                            handleMoodCardPress(e, card.meta, card.filterParams);
                          }
                        }}
                        style={moodCardWebStyle}
                      >
                        <View style={styles.moodCardHeader}>
                          <Feather name={card.icon as any} size={12} color={colors.primary} />
                          <Text style={styles.moodCardTitle}>{card.title}</Text>
                        </View>
                        <Text style={styles.moodCardMeta}>{card.meta}</Text>
                      </div>
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
                    {BOOK_IMAGES[bookImageIndex].title && (
                      <View style={styles.bookOverlay}>
                        <Text style={styles.bookOverlayTitle} numberOfLines={2}>
                          {BOOK_IMAGES[bookImageIndex].title}
                        </Text>
                        <Text style={styles.bookOverlaySubtitle} numberOfLines={1}>
                          {BOOK_IMAGES[bookImageIndex].subtitle}
                        </Text>
                      </View>
                    )}
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
