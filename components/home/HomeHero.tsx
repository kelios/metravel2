import { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer } from '@/components/layout';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { buildLoginHref } from '@/utils/authNavigation';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

interface HomeHeroProps {
  travelsCount?: number;
}

type QuickFilterValue = string | number | Array<string | number>;
type QuickFilterParams = Record<string, QuickFilterValue | undefined>;

const normalizeQuickFilterValue = (value: QuickFilterValue | undefined): string | null => {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
    if (!cleaned.length) return null;
    return cleaned.join(',');
  }
  const scalar = String(value).trim();
  return scalar.length > 0 ? scalar : null;
};

const buildFilterPath = (base: string, params?: QuickFilterParams) => {
  if (!params) return base;
  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value);
      if (!normalized) return null;
      return `${key}=${normalized}`;
    })
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .join('&');
  return query.length > 0 ? `${base}?${query}` : base;
};

const BOOK_IMAGES = [
  {
    source: require('../../assets/images/pdf.webp'),
    alt: 'Тропа ведьм — Германия',
    title: 'Тропа ведьм',
    subtitle: 'Хайкинг • Горный маршрут • Германия',
    href: 'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
    },
    alt: 'Озеро Сорапис — Доломиты',
    title: 'Озеро Сорапис',
    subtitle: 'Поход по Доломитам • Озеро • Италия',
    href: 'https://metravel.by/travels/ozero-sorapis-pokhod-po-marshrutam-215-i-217-v-dolomitakh',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/536/conversions/b254498810ab43fcb7749c3a51ecf3ee.JPG',
    },
    alt: 'Tre Cime di Lavaredo — Доломиты',
    title: 'Tre Cime di Lavaredo',
    subtitle: 'Круговой маршрут 10 км • Горы • Италия',
    href: 'https://metravel.by/travels/tre-cime-di-lavaredo-krugovoi-marshrut-10-km-opisanie-i-vidy',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/532/gallery/ce0f0221a2ac42e08bc274c0f059dfc9.JPG',
    },
    alt: 'Озеро Блед — Словения',
    title: 'Озеро Блед',
    subtitle: 'Что посмотреть за 1 день • Озеро • Словения',
    href: 'https://metravel.by/travels/vintgarskoe-ushchele-i-ozero-bled-chto-posmotret-v-slovenii-za-1-den',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/362/conversions/28160874221349509d697c8016c48464.webp',
    },
    alt: 'Морское око в мае — Польша',
    title: 'Морское око в мае',
    subtitle: 'Поход • Озеро • Польша',
    href: 'https://metravel.by/travels/morskoe-oko-v-mae',
  },
];

export const BOOK_IMAGES_FOR_TEST = BOOK_IMAGES;

const MOOD_CARDS = [
  {
    title: 'У воды',
    meta: 'Природа',
    icon: 'sun',
    filters: { categoryTravelAddress: [84, 110, 113, 193] },
    route: '/search',
  },
  {
    title: 'Дворцы и замки',
    meta: 'Город • 1 день',
    icon: 'coffee',
    filters: { categoryTravelAddress: [33, 43] },
    route: '/search',
  },
  {
    title: 'Руины',
    meta: 'История',
    icon: 'columns',
    filters: { categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] },
    route: '/search',
  },
  {
    title: 'Активный выезд',
    meta: 'Треккинг • Хайкинг',
    icon: 'activity',
    filters: { categories: [21, 22, 2] },
    route: '/search',
  },
  {
    title: 'Карта до 60 км',
    meta: 'Рядом с вами',
    icon: 'map-pin',
    filters: { radius: 60 },
    route: '/map',
  },
] as const;

const HERO_HIGHLIGHTS = [
  { icon: 'clock', title: 'За 2 минуты', subtitle: 'подборка под ваш ритм' },
  { icon: 'book-open', title: 'Личная книга', subtitle: 'фото, заметки и PDF' },
  { icon: 'map-pin', title: 'Маршруты рядом', subtitle: 'фильтры по дистанции и формату' },
] as const;

export const MOOD_CARDS_FOR_TEST = MOOD_CARDS;

const HomeHero = memo(function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone, isLargePhone, isTablet, isLargeTablet, isDesktop, width } = useResponsive();

  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const isWeb = Platform.OS === 'web';
  const isNarrowLayout = isMobile || (isWeb && width <= 860);
  const showSideSlider = isWeb && (isDesktop || isLargeTablet || isTablet);
  const sliderHeight = isDesktop ? 500 : 430;
  const sliderMediaWidth = isDesktop ? 500 : 380;

  // Slider state
  const [activeSlide, setActiveSlide] = useState(0);
  const totalSlides = BOOK_IMAGES.length;

  // Auto-advance slider
  useEffect(() => {
    if (!showSideSlider) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, [showSideSlider, totalSlides]);

  const handlePrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const handleNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const handleCreateBook = useCallback(() => {
    queueAnalyticsEvent('HomeClick_CreateBook');
    if (!isAuthenticated) {
      router.push(buildLoginHref({ redirect: '/', intent: 'create-book' }) as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  }, [isAuthenticated, travelsCount, router]);

  const handleOpenSearch = useCallback(() => {
    queueAnalyticsEvent('HomeClick_OpenSearch');
    router.push('/search' as any);
  }, [router]);

  const handleQuickFilterPress = useCallback((label: string, filters?: QuickFilterParams, route: string = '/search') => {
    queueAnalyticsEvent('HomeClick_QuickFilter', { label, source: 'home-hero' });
    const path = buildFilterPath(route, filters);
    router.push(path as any);
  }, [router]);

  const handleOpenArticles = useCallback((href?: string | null) => {
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
  }, [router]);

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Добавить первую поездку';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingTop: isMobile ? 20 : 36,
      paddingBottom: isMobile ? 36 : 56,
      backgroundColor: colors.background,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 90% 70% at 50% -10%, ${colors.primarySoft} 0%, transparent 65%)`,
          backgroundRepeat: 'no-repeat',
        },
      }),
    },
    heroShell: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 14 : 26,
      paddingVertical: isMobile ? 14 : 24,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    heroRow: {
      flexDirection: showSideSlider ? 'row' : 'column',
      alignItems: showSideSlider ? 'stretch' : 'stretch',
      justifyContent: showSideSlider ? 'space-between' : 'flex-start',
      gap: showSideSlider ? 30 : 16,
      width: '100%',
    },
    heroSection: {
      alignItems: isMobile ? 'stretch' : 'flex-start',
      gap: isMobile ? 16 : 20,
      width: showSideSlider ? '47%' : '100%',
      maxWidth: showSideSlider ? 540 : (isMobile ? '100%' : 720),
      flexShrink: 0,
      paddingHorizontal: isMobile ? 10 : 12,
      paddingVertical: isMobile ? 12 : 14,
    },
    sliderSection: {
      flex: 1,
      minWidth: 0,
      width: showSideSlider ? '53%' : 320,
      maxWidth: 600,
      position: 'relative' as const,
      justifyContent: 'center',
    },
    sliderContainer: {
      width: '100%',
      height: sliderHeight,
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    slideWrapper: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    slideImage: {
      width: '100%',
      height: '100%',
      ...Platform.select({
        web: {
          filter: 'saturate(1.15) contrast(1.05)',
        },
      }),
    },
    slideOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      paddingHorizontal: 18,
      paddingTop: 40,
      paddingBottom: 16,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          backgroundImage: 'linear-gradient(to top, rgba(7, 17, 29, 0.88) 0%, rgba(7, 17, 29, 0.52) 52%, rgba(7, 17, 29, 0) 100%)',
        },
      }),
    },
    slideCaption: {
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: 'rgba(9, 20, 33, 0.42)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: '92%',
      alignSelf: 'flex-start',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(6px)',
        },
      }),
    },
    slideTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 4,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    slideSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.92)',
    },
    sliderNav: {
      position: 'absolute' as const,
      top: '50%',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      ...Platform.select({
        web: {
          transform: 'translateY(-50%)',
        },
      }),
    },
    sliderNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(17, 24, 39, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
        },
      }),
    },
    sliderNavBtnHover: {
      backgroundColor: 'rgba(17, 24, 39, 0.7)',
    },
    sliderDots: {
      position: 'absolute' as const,
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      zIndex: 3,
    },
    sliderDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    sliderDotActive: {
      backgroundColor: colors.textOnPrimary,
      borderColor: colors.textOnPrimary,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 31 : isTablet ? 38 : (isDesktop ? 48 : 42),
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -1,
      lineHeight: isMobile ? 39 : isTablet ? 46 : (isDesktop ? 54 : 48),
      textAlign: 'left',
    },
    subtitle: {
      fontSize: isMobile ? 15 : 18,
      fontWeight: '400',
      color: colors.textMuted,
      lineHeight: isMobile ? 22 : 27,
      textAlign: 'left',
      maxWidth: 520,
      alignSelf: 'flex-start',
    },
    highlightsGrid: {
      flexDirection: isNarrowLayout ? 'column' : 'row',
      gap: 8,
      width: '100%',
      marginTop: 4,
    },
    highlightCard: {
      flex: isMobile ? undefined : 1,
      minWidth: 0,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      paddingVertical: 9,
      paddingHorizontal: 10,
      gap: 5,
    },
    highlightIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    highlightTitle: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    highlightSubtitle: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    buttonsContainer: {
      flexDirection: isNarrowLayout ? 'column' : 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 12,
      width: isNarrowLayout ? '100%' : undefined,
      marginTop: 4,
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 24 : 28,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: 50,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: isMobile ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
        },
      }),
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 24 : 28,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: 50,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: isMobile ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    moodChipsContainer: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      width: '100%',
    },
    moodChipsScrollContent: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: isMobile ? 0 : 0,
      justifyContent: showSideSlider ? 'flex-start' : 'center',
      flexWrap: showSideSlider ? 'wrap' : 'nowrap',
    },
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    moodChipHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    moodChipIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    moodChipText: {
      gap: 0,
    },
    moodChipTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    moodChipMeta: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textMuted,
    },
    popularSection: {
      marginTop: isMobile ? 28 : 44,
      width: '100%',
    },
    popularTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    popularScrollContent: {
      flexDirection: 'row',
      gap: 16,
      paddingRight: 16,
    },
    imageCard: {
      width: isMobile ? 180 : 200,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    imageCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
          borderColor: colors.primaryAlpha30,
        },
      }),
    },
    imageCardImage: {
      width: isMobile ? 180 : 200,
      height: isMobile ? 120 : 140,
    },
    imageCardContent: {
      padding: 12,
      gap: 4,
    },
    imageCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 18,
    },
    imageCardSubtitle: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textMuted,
      lineHeight: 16,
    },
  }), [colors, isMobile, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight]);

  const currentSlide = BOOK_IMAGES[activeSlide];

  return (
    <View testID="home-hero" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.heroShell}>
          {/* Hero Row: Text left, Slider right on desktop */}
          <View style={styles.heroRow}>
          {/* Hero Section - Text */}
          <View style={styles.heroSection}>
            <View style={styles.badge}>
              <Feather name="zap" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>Бесплатно и без регистрации</Text>
            </View>

            <Text style={styles.title}>
              Куда поехать{isNarrowLayout ? ' ' : '\n'}в эти выходные?
            </Text>

            <Text style={styles.subtitle}>
              Открывайте готовые маршруты, собирайте заметки и превращайте каждую поездку в красивую личную книгу путешествий.
            </Text>

            <View style={styles.highlightsGrid}>
              {HERO_HIGHLIGHTS.map((item) => (
                <View key={item.title} style={styles.highlightCard}>
                  <View style={styles.highlightIconWrap}>
                    <Feather name={item.icon as any} size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.highlightTitle}>{item.title}</Text>
                  <Text style={styles.highlightSubtitle}>{item.subtitle}</Text>
                </View>
              ))}
            </View>

            <View style={styles.buttonsContainer}>
              <Button
                onPress={handleCreateBook}
                label={primaryButtonLabel}
                variant="primary"
                size="md"
                fullWidth={isNarrowLayout}
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
                size="md"
                fullWidth={isNarrowLayout}
                icon={<Feather name="compass" size={16} color={colors.text} />}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                hoverStyle={styles.secondaryButtonHover}
                pressedStyle={styles.secondaryButtonHover}
                accessibilityLabel="Смотреть маршруты"
              />
            </View>

          </View>

          {/* Slider Section - Right side on desktop */}
          {showSideSlider && (
            <View style={styles.sliderSection}>
              <Pressable
                onPress={() => handleOpenArticles(currentSlide.href)}
                style={styles.sliderContainer}
                accessibilityRole="link"
                accessibilityHint="Открыть маршрут"
              >
                {/* Slides */}
                {BOOK_IMAGES.map((image, index) => (
                  <View
                    key={image.title}
                    style={[
                      styles.slideWrapper,
                      {
                        opacity: index === activeSlide ? 1 : 0,
                        zIndex: index === activeSlide ? 1 : 0,
                        ...(Platform.OS === 'web' ? { transition: 'opacity 0.5s ease' } : {}),
                      } as any,
                    ]}
                  >
                    <ImageCardMedia
                      source={image.source}
                      width={sliderMediaWidth}
                      height={sliderHeight}
                      borderRadius={0}
                      fit="contain"
                      blurBackground
                      quality={90}
                      alt={image.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      style={styles.slideImage}
                    />
                  </View>
                ))}

                {/* Overlay with title */}
                <View style={styles.slideOverlay}>
                  <View style={styles.slideCaption}>
                    <Text style={styles.slideTitle}>{currentSlide.title}</Text>
                    <Text style={styles.slideSubtitle}>{currentSlide.subtitle}</Text>
                  </View>
                </View>
              </Pressable>

              {/* Navigation dots - outside Pressable to avoid nested buttons */}
              {false && (
                <View style={styles.sliderDots}>
                  {BOOK_IMAGES.map((_, index) => (
                    <Pressable
                      key={index}
                      onPress={() => setActiveSlide(index)}
                      style={[
                        styles.sliderDot,
                        index === activeSlide && styles.sliderDotActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Слайд ${index + 1}`}
                    />
                  ))}
                </View>
              )}

              {/* Navigation arrows */}
              <View style={styles.sliderNav}>
                <Pressable
                  onPress={handlePrevSlide}
                  style={({ hovered }) => [
                    styles.sliderNavBtn,
                    hovered && styles.sliderNavBtnHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Предыдущий слайд"
                >
                  <Feather name="chevron-left" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={handleNextSlide}
                  style={({ hovered }) => [
                    styles.sliderNavBtn,
                    hovered && styles.sliderNavBtnHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Следующий слайд"
                >
                  <Feather name="chevron-right" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}
          </View>
          <View style={styles.moodChipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={isWeb ? ({ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overflowX: 'auto', overflowY: 'hidden' } as any) : undefined}
              contentContainerStyle={styles.moodChipsScrollContent}
            >
              {MOOD_CARDS.map((card) => (
                <Pressable
                  key={card.title}
                  onPress={() => handleQuickFilterPress(card.title, card.filters as unknown as QuickFilterParams, card.route)}
                  style={({ pressed, hovered }) => [
                    styles.moodChip,
                    (pressed || hovered) && styles.moodChipHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.title} ${card.meta}. Идея поездки`}
                >
                  <View style={styles.moodChipIcon}>
                    <Feather name={card.icon as any} size={14} color={colors.primary} />
                  </View>
                  <View style={styles.moodChipText}>
                    <Text style={styles.moodChipTitle}>{card.title}</Text>
                    <Text style={styles.moodChipMeta}>{card.meta}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Popular Routes Section - only on mobile */}
        {!showSideSlider && (
          <View style={styles.popularSection}>
            <Text style={styles.popularTitle}>Популярные маршруты</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={isWeb ? ({ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overflowX: 'auto', overflowY: 'hidden' } as any) : undefined}
              contentContainerStyle={styles.popularScrollContent}
            >
              {BOOK_IMAGES.map((image) => (
                <Pressable
                  key={image.title}
                  onPress={() => handleOpenArticles(image.href)}
                  style={({ pressed, hovered }) => [
                    styles.imageCard,
                    (pressed || hovered) && styles.imageCardHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={image.title}
                >
                <ImageCardMedia
                  source={image.source}
                  width={isMobile ? 180 : 200}
                  height={isMobile ? 120 : 140}
                  borderRadius={0}
                  fit="contain"
                  blurBackground
                  quality={85}
                  alt={image.alt}
                  loading="lazy"
                  style={styles.imageCardImage}
                />
                <View style={styles.imageCardContent}>
                  <Text style={styles.imageCardTitle} numberOfLines={1}>
                    {image.title}
                  </Text>
                  <Text style={styles.imageCardSubtitle} numberOfLines={1}>
                    {image.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        )}
      </ResponsiveContainer>
    </View>
  );
});

export default HomeHero;
