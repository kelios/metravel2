import { useMemo, memo, useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
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

  const styles = useMemo(() => createHomeHeroStyles({
    colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight,
  }), [colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight]);

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
              <View style={styles.badgeDot} />
              <Feather name="zap" size={12} color={colors.primaryText} />
              <Text style={styles.badgeText}>Бесплатно • Без регистрации</Text>
            </View>

            <View>
              <Text style={styles.title}>
                Куда поехать{isNarrowLayout ? ' ' : '\n'}
              </Text>
              <Text style={styles.titleAccent}>
                в эти выходные?
              </Text>
            </View>

            <Text style={styles.subtitle}>
              Открывайте готовые маршруты, собирайте заметки и превращайте каждую поездку в красивую личную книгу путешествий.
            </Text>

            <View style={styles.highlightsGrid}>
              {HERO_HIGHLIGHTS.map((item) => (
                <View key={item.title} style={styles.highlightCard}>
                  <View style={styles.highlightIconWrap}>
                    <Feather name={item.icon as any} size={16} color={colors.textOnPrimary} />
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
                icon={<Feather name="arrow-right" size={16} color={colors.textOnPrimary} />}
                iconPosition="right"
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
                {/* Render only active slide to avoid eager loading hidden images on first paint */}
                <View
                  key={currentSlide.title}
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
                    loading={activeSlide === 0 ? 'eager' : 'lazy'}
                    style={styles.slideImage}
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
                  <Text style={styles.slideCounterText}>{activeSlide + 1} / {totalSlides}</Text>
                </View>
              </Pressable>

              {/* Navigation dots - outside Pressable to avoid nested buttons */}
              {null}

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
