import { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer } from '@/components/layout';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { buildLoginHref } from '@/utils/authNavigation';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';
import { createHomeHeroStyles } from './homeHeroStyles';

interface HomeHeroProps {
  travelsCount?: number;
  /** HERO-06: показывать skeleton для кнопки пока загружается travelsCount */
  travelsCountLoading?: boolean;
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

const getSlideRemoteUri = (source: { uri?: string } | number | null | undefined): string | null => {
  if (!source || typeof source === 'number') return null;
  if (typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    const trimmedUri = source.uri.trim();
    return trimmedUri.length > 0 ? trimmedUri : null;
  }
  return null;
};

const preloadWebImage = async (uri: string): Promise<boolean> => {
  if (!uri || Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || typeof Image === 'undefined') return false;
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };

    image.onload = () => settle(true);
    image.onerror = () => settle(false);
    image.decoding = 'async';
    image.src = uri;

    if (image.complete && image.naturalWidth > 0) {
      settle(true);
      return;
    }

    setTimeout(() => settle(false), 10000);
  });
};

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

const HomeHero = memo(function HomeHero({ travelsCount = 0, travelsCountLoading = false }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone, isLargePhone, isTablet, isLargeTablet, isDesktop, width, isPortrait } = useResponsive();

  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const isLandscape = !isPortrait && isMobile; // RESP-05
  const isWeb = Platform.OS === 'web';
  const isNarrowLayout = isMobile || (isWeb && width <= 860);
  const showSideSlider = isWeb && (isDesktop || isLargeTablet || isTablet);
  const sliderHeight = isDesktop ? 420 : 360;
  const sliderMediaWidth = isDesktop ? 500 : 380;

  // Book wrapper measured height for adaptive aspect-ratio
  const [bookWrapperWidth, setBookWrapperWidth] = useState(0);
  const bookHeight = useMemo(() => {
    if (bookWrapperWidth <= 0) return 0;
    const aspectH = Math.round(bookWrapperWidth * 765 / 1040);
    const vh = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.innerHeight : Dimensions.get('window').height)
      : Dimensions.get('window').height;
    return Math.min(aspectH, vh - 130);
  }, [bookWrapperWidth]);

  // Slider state
  const [activeSlide, setActiveSlide] = useState(0);
  const [visibleSlide, setVisibleSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(() => new Set([0]));
  const totalSlides = BOOK_IMAGES.length;

  const markSlideAsLoaded = useCallback((slideIndex: number) => {
    setLoadedSlides((prev) => {
      if (prev.has(slideIndex)) return prev;
      const next = new Set(prev);
      next.add(slideIndex);
      return next;
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisibleSlide(activeSlide);
      markSlideAsLoaded(activeSlide);
      return;
    }

    let cancelled = false;
    const preloadSlide = async (slideIndex: number) => {
      if (loadedSlides.has(slideIndex)) return;
      const remoteUri = getSlideRemoteUri(BOOK_IMAGES[slideIndex]?.source);
      if (!remoteUri) {
        if (!cancelled) markSlideAsLoaded(slideIndex);
        return;
      }
      const preloadSucceeded = await preloadWebImage(remoteUri);
      if (!cancelled && preloadSucceeded) {
        markSlideAsLoaded(slideIndex);
      }
    };

    const nextSlide = (activeSlide + 1) % totalSlides;
    void preloadSlide(activeSlide);
    void preloadSlide(nextSlide);

    return () => {
      cancelled = true;
    };
  }, [activeSlide, loadedSlides, markSlideAsLoaded, totalSlides]);

  useEffect(() => {
    if (loadedSlides.has(activeSlide)) {
      setVisibleSlide(activeSlide);
    }
  }, [activeSlide, loadedSlides]);

  // Auto-advance slider
  useEffect(() => {
    if (!showSideSlider) return;
    // Уважаем настройку пользователя об уменьшении анимации (WCAG 2.2 SC 2.3.3)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (mediaQuery?.matches) return;
    }
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

  const styles = useMemo(() => createHomeHeroStyles({
    colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight,
    isLandscape, bookHeight,
  }), [colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight, isLandscape, bookHeight]);

  const currentSlide = BOOK_IMAGES[visibleSlide];
  const isVisibleSlideLoaded = loadedSlides.has(visibleSlide);
  const showBookmarkRail = showSideSlider && !isNarrowLayout;
  const showInlineBookmarkRail = showBookmarkRail;
  const heroSubtitle = isMobile || (showSideSlider && bookHeight > 0 && bookHeight < 760)
    ? 'Готовые маршруты, заметки и личная книга путешествий.'
    : 'Открывайте готовые маршруты, собирайте заметки и превращайте каждую поездку в красивую личную книгу путешествий.';

  return (
    <View testID="home-hero" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.heroShell}>
          {/* Book wrapper for 3D effect */}
          <View
            style={styles.bookWrapper}
            onLayout={showSideSlider ? (e) => setBookWrapperWidth(e.nativeEvent.layout.width) : undefined}
          >
            {/* Book cover shadow/glow */}
            {isWeb && showSideSlider && <View style={styles.bookCoverOuter} />}
            
            {/* Hero Row: Left page (text) + Right page (slider) */}
            <View style={styles.heroRow}>
              {/* Central book spine */}
              {isWeb && showSideSlider && <View style={styles.heroBookSpine} />}

              {/* Left Page - Text Content */}
              <View testID="home-hero-left-page" style={styles.heroSection}>
                {/* Golden decorative line at top */}
                {isWeb && showSideSlider && <View style={styles.heroPageGoldLine} />}
                {/* Page curl effect */}
                {isWeb && showSideSlider && <View style={styles.heroPageCurlLeft} />}

                {/* Title */}
                <View>
                  <Text style={styles.title}>
                    Куда поехать{isNarrowLayout ? ' ' : '\n'}
                  </Text>
                  <Text style={styles.titleAccent}>
                    в эти выходные?
                  </Text>
                </View>

                {/* Subtitle */}
                <Text style={styles.subtitle}>{heroSubtitle}</Text>

                {/* Mood filter chips as inline vertical list (desktop) */}
                {showInlineBookmarkRail && (
                  <View testID="home-hero-bookmark-rail" style={styles.bookmarkRail}>
                    {MOOD_CARDS.map((card) => (
                      <Pressable
                        key={`inline-${card.title}`}
                        onPress={() => handleQuickFilterPress(card.title, card.filters as unknown as QuickFilterParams, card.route)}
                        style={({ pressed, hovered }) => [
                          styles.bookmarkChip,
                          (pressed || hovered) && styles.bookmarkChipHover,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${card.title} ${card.meta}. Идея поездки`}
                      >
                        <View style={styles.bookmarkChipIcon}>
                          <Feather name={card.icon as any} size={14} color={colors.primary} />
                        </View>
                        <View style={styles.moodChipText}>
                          <Text style={styles.moodChipTitle} numberOfLines={1}>{card.title}</Text>
                          <Text style={styles.moodChipMeta} numberOfLines={1}>{card.meta}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Inner mini-book feature highlights widget */}
                {!showInlineBookmarkRail && !isMobile && (
                  <View style={styles.openBookContainer}>
                    <View style={styles.openBook}>
                      {isWeb && <View style={styles.bookCover} />}
                      {/* Left Page */}
                      <View style={[styles.bookPage, styles.bookPageLeft]}>
                        {isWeb && <View style={styles.bookPageGoldLine} />}
                        <View style={styles.bookSpineShadowLeft} />
                        {HERO_HIGHLIGHTS.slice(0, 2).map((item) => (
                          <Pressable
                            key={item.title}
                            style={({ hovered }) => [
                              styles.bookHighlightItem,
                              hovered && styles.bookHighlightItemHover,
                            ]}
                          >
                            <View style={styles.bookHighlightIconWrap}>
                              <Feather name={item.icon as any} size={isMobile ? 13 : 15} color={colors.textOnPrimary} />
                            </View>
                            <View style={styles.bookHighlightTextWrap}>
                              <Text style={styles.bookHighlightTitle}>{item.title}</Text>
                              <Text style={styles.bookHighlightSubtitle}>{item.subtitle}</Text>
                            </View>
                          </Pressable>
                        ))}
                        <View style={[styles.bookPageCurl, styles.bookPageCurlLeft]} />
                        <Text style={[styles.bookPageNumber, styles.bookPageNumberLeft]}>1</Text>
                      </View>
                      {/* Center Spine */}
                      <View style={styles.bookSpine} />
                      {/* Right Page */}
                      <View style={[styles.bookPage, styles.bookPageRight]}>
                        {isWeb && <View style={styles.bookPageGoldLine} />}
                        <View style={styles.bookSpineShadowRight} />
                        {HERO_HIGHLIGHTS.slice(2).map((item) => (
                          <Pressable
                            key={item.title}
                            style={({ hovered }) => [
                              styles.bookHighlightItem,
                              hovered && styles.bookHighlightItemHover,
                            ]}
                          >
                            <View style={styles.bookHighlightIconWrap}>
                              <Feather name={item.icon as any} size={isMobile ? 13 : 15} color={colors.textOnPrimary} />
                            </View>
                            <View style={styles.bookHighlightTextWrap}>
                              <Text style={styles.bookHighlightTitle}>{item.title}</Text>
                              <Text style={styles.bookHighlightSubtitle}>{item.subtitle}</Text>
                            </View>
                          </Pressable>
                        ))}
                        <View style={[styles.bookPageCurl, styles.bookPageCurlRight]} />
                        <Text style={[styles.bookPageNumber, styles.bookPageNumberRight]}>2</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* CTA Buttons */}
                <View testID="home-hero-cta-row" style={styles.buttonsContainer}>
                  {travelsCountLoading ? (
                    <View style={[styles.primaryButton, {
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: 0.6,
                      flexDirection: 'row',
                      gap: 8,
                    }]}>
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    </View>
                  ) : (
                    <Button
                      onPress={handleCreateBook}
                      label={primaryButtonLabel}
                      variant="primary"
                      size="md"
                      fullWidth={isNarrowLayout}
                      icon={<Feather name="arrow-right" size={16} color={colors.textOnPrimary} />}
                      iconPosition="right"
                      style={styles.primaryButton}
                      labelStyle={styles.primaryButtonText}
                      hoverStyle={styles.primaryButtonHover}
                      pressedStyle={styles.primaryButtonHover}
                      accessibilityLabel={primaryButtonLabel}
                    />
                  )}
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

                {/* Page number on left page */}
                {showSideSlider && <Text style={[styles.bookPageNumber, styles.bookPageNumberLeft]}>1</Text>}
              </View>

              {/* Right Page - Slider Section */}
              {showSideSlider && (
                <View style={styles.sliderSection}>
                  {/* Golden decorative line at top */}
                  {isWeb && <View style={styles.sliderPageGoldLine} />}
                  {/* Page curl effect */}
                  {isWeb && <View style={styles.heroPageCurlRight} />}
                  {/* Page number */}
                  <Text style={styles.sliderPageNumber}>2</Text>
              <Pressable
                onPress={() => handleOpenArticles(currentSlide.href)}
                style={styles.sliderContainer}
                accessibilityRole="link"
                accessibilityLabel={`Маршрут: ${currentSlide.title}`}
                accessibilityHint="Открыть маршрут"
              >
                {/* Keep the currently visible slide mounted; switch after preload to avoid blank frame */}
                <View
                  style={[
                    styles.slideWrapper,
                    Platform.OS === 'web' ? ({ transition: 'opacity 0.5s ease' } as any) : null,
                  ]}
                >
                  <ImageCardMedia
                    source={currentSlide.source}
                    width={sliderMediaWidth}
                    height={sliderHeight}
                    borderRadius={0}
                    fit="contain"
                    blurBackground
                    quality={90}
                    alt={currentSlide.alt}
                    loading={isVisibleSlideLoaded ? 'eager' : 'lazy'}
                    showImmediately={isVisibleSlideLoaded}
                    style={styles.slideImage}
                    onLoad={() => markSlideAsLoaded(visibleSlide)}
                  />
                </View>

                {/* Overlay with title */}
                <View style={styles.slideOverlay}>
                  <View style={styles.slideCaption}>
                    <Text style={styles.slideTitle}>{currentSlide.title}</Text>
                    <Text style={styles.slideSubtitle}>{currentSlide.subtitle}</Text>
                  </View>
                </View>

                {/* Slide counter */}
                <View style={styles.slideCounter}>
                  <Text style={styles.slideCounterText}>{visibleSlide + 1} / {totalSlides}</Text>
                </View>

                {/* Navigation arrows — inside sliderContainer to stay within book page bounds */}
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
                    <Feather name="chevron-left" size={18} color="#fff" />
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
                    <Feather name="chevron-right" size={18} color="#fff" />
                  </Pressable>
                </View>
              </Pressable>
              </View>
            )}
            </View>
          </View>
          {!showBookmarkRail && (
            <View style={styles.moodChipsContainer}>
              <View
                style={isWeb ? ({
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
                  maskImage: 'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
                  overflow: 'hidden',
                } as any) : undefined}
              >
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
                    <View style={styles.moodChipAccent} />
                    <View style={styles.moodChipIcon}>
                      <Feather name={card.icon as any} size={16} color={colors.primary} />
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
          )}
        </View>

        {/* Popular Routes Section - only on mobile */}
        {!showSideSlider && (
          <View style={styles.popularSection}>
            {/* Featured изображение маршрута — даёт визуальный контекст сразу без скролла */}
            <Pressable
              onPress={() => handleOpenArticles(BOOK_IMAGES[0].href)}
              style={({ pressed, hovered }) => [
                styles.featuredCard,
                (pressed || hovered) && styles.featuredCardHover,
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Открыть маршрут: ${BOOK_IMAGES[0].title}`}
            >
              <ImageCardMedia
                source={BOOK_IMAGES[0].source}
                width={undefined}
                height={isMobile ? 200 : 260}
                borderRadius={0}
                fit="contain"
                blurBackground
                quality={85}
                alt={BOOK_IMAGES[0].alt}
                loading="eager"
                style={styles.featuredCardImage}
              />
              <View style={styles.featuredCardOverlay}>
                <Text style={styles.featuredCardTitle} numberOfLines={1}>
                  {BOOK_IMAGES[0].title}
                </Text>
                <Text style={styles.featuredCardSubtitle} numberOfLines={1}>
                  {BOOK_IMAGES[0].subtitle}
                </Text>
              </View>
            </Pressable>
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
                  width={isMobile ? 195 : 215}
                  height={isMobile ? 130 : 148}
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
