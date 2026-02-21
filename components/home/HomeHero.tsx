import { useMemo, memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
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
  {
    source: {
      uri: 'https://metravel.by/travel-image/4864/conversions/iIGMjveCXmzwjZASHQTnPvEog7WURBjDEjYX7D3N-webpTravelMainImage_400.webp',
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
  },
  {
    title: 'Дворцы и замки',
    meta: 'Город • 1 день',
    icon: 'coffee',
    filters: { categoryTravelAddress: [33, 43] },
  },
  {
    title: 'Руины',
    meta: 'История',
    icon: 'columns',
    filters: { categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] },
  },
  {
    title: 'Активный выезд',
    meta: 'Треккинг • Хайкинг',
    icon: 'activity',
    filters: { categories: [21, 22, 2] },
  },
] as const;

export const MOOD_CARDS_FOR_TEST = MOOD_CARDS;

const HomeHero = memo(function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone, isTablet, width } = useResponsive();

  const isMobile = isSmallPhone || isPhone;
  const isWeb = Platform.OS === 'web';
  const isTabletRange = isTablet || (width >= 768 && width < 1024);
  const isNarrowDesktop = !isMobile && width < 1200;
  const shouldRenderImageSlot = isWeb && !isMobile && width >= 1024;

  const [bookImageIndex, setBookImageIndex] = useState(0);

  useEffect(() => {
    if (!shouldRenderImageSlot) return;
    const timer = setInterval(() => {
      setBookImageIndex((prev) => (prev + 1) % BOOK_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [shouldRenderImageSlot]);

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

  const handleQuickFilterPress = (label: string, filters?: QuickFilterParams) => {
    queueAnalyticsEvent('HomeClick_QuickFilter', { label, source: 'home-hero' });
    const path = buildFilterPath('/search', filters);
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
    if (!isAuthenticated) return 'Начать бесплатно';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingTop: isMobile ? 40 : 64,
      paddingBottom: isMobile ? 40 : 64,
      backgroundColor: colors.background,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    content: {
      flex: 1,
      gap: isMobile ? 24 : 28,
      maxWidth: isMobile ? '100%' : isNarrowDesktop ? '100%' : 560,
      zIndex: 1,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 32 : 48,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -1,
      lineHeight: isMobile ? 40 : 56,
    },
    subtitle: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '400',
      color: colors.textMuted,
      lineHeight: isMobile ? 24 : 28,
      maxWidth: 480,
    },
    buttonsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: 12,
      width: isMobile ? '100%' : undefined,
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 28 : 32,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: 52,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: isMobile ? '100%' : undefined,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          transition: 'all 0.25s ease',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.heavy,
        },
      }),
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 28 : 32,
      paddingVertical: isMobile ? 14 : 16,
      minHeight: 52,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      width: isMobile ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.25s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
        },
      }),
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    moodChipsContainer: {
      marginTop: 8,
    },
    moodChipsRow: {
      flexDirection: 'row',
      flexWrap: isMobile ? 'nowrap' : 'wrap',
      gap: 10,
      paddingRight: isMobile ? 16 : 0,
    },
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
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
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    moodChipIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    moodChipText: {
      gap: 2,
    },
    moodChipTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    moodChipMeta: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    imageContainer: {
      flex: 0,
      flexShrink: 0,
      width: isTabletRange ? 240 : 280,
      minHeight: isTabletRange ? 340 : 400,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imageDecor: {
      position: 'absolute',
      width: isTabletRange ? 200 : 240,
      height: isTabletRange ? 300 : 360,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.primarySoft,
      opacity: 0.5,
      ...Platform.select({
        web: {
          transform: 'rotate(4deg) translate(20px, 10px)',
        } as any,
      }),
    },
    bookImageWrap: {
      position: 'relative',
      ...Platform.select({
        web: {
          transition: 'transform 0.3s ease',
        },
      }),
    },
    bookImage: {
      width: isTabletRange ? 180 : 220,
      height: isTabletRange ? 270 : 330,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
        },
      }),
    },
    bookImageHover: {
      ...Platform.select({
        web: {
          transform: 'scale(1.02)',
        },
      }),
    },
    bookOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderBottomLeftRadius: DESIGN_TOKENS.radii.lg,
      borderBottomRightRadius: DESIGN_TOKENS.radii.lg,
      paddingHorizontal: 16,
      paddingTop: 40,
      paddingBottom: 16,
      gap: 4,
      ...Platform.select({
        web: {
          backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))',
        },
      }),
    },
    bookOverlayTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    bookOverlaySubtitle: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 14,
    },
    bookDots: {
      position: 'absolute',
      bottom: -24,
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
  }), [colors, isMobile, isTabletRange]);

  return (
    <View testID="home-hero" style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack direction="responsive" gap={isMobile ? 32 : 64} align="center">
          <View style={styles.content}>
            <View style={styles.badge}>
              <Feather name="zap" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>Бесплатно и без регистрации</Text>
            </View>

            <Text style={styles.title}>
              Идеи для поездок на выходные
            </Text>

            <Text style={styles.subtitle}>
              Выбирай маршруты по расстоянию и формату. Сохраняй поездки с фото. Собирай личную книгу путешествий.
            </Text>

            <View style={styles.buttonsContainer}>
              <Button
                onPress={handleCreateBook}
                label={primaryButtonLabel}
                variant="primary"
                size="md"
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
                size="md"
                fullWidth={isMobile}
                icon={<Feather name="compass" size={16} color={colors.text} />}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                hoverStyle={styles.secondaryButtonHover}
                pressedStyle={styles.secondaryButtonHover}
                accessibilityLabel="Смотреть маршруты"
              />
            </View>

            <View style={styles.moodChipsContainer}>
              {isMobile ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={isWeb ? ({ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overflowX: 'auto', overflowY: 'hidden' } as any) : undefined}
                  contentContainerStyle={styles.moodChipsRow}
                >
                  {MOOD_CARDS.map((card) => (
                    <Pressable
                      key={card.title}
                      onPress={() => handleQuickFilterPress(card.title, card.filters as unknown as QuickFilterParams)}
                      style={({ pressed, hovered }) => [
                        styles.moodChip,
                        (pressed || hovered) && styles.moodChipHover,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Идея поездки ${card.title}`}
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
              ) : (
                <View style={styles.moodChipsRow}>
                  {MOOD_CARDS.map((card) => (
                    <Pressable
                      key={card.title}
                      onPress={() => handleQuickFilterPress(card.title, card.filters as unknown as QuickFilterParams)}
                      style={({ pressed, hovered }) => [
                        styles.moodChip,
                        (pressed || hovered) && styles.moodChipHover,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Идея поездки ${card.title}`}
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
                </View>
              )}
            </View>
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
                  <View style={[styles.bookImageWrap, hovered && styles.bookImageHover]}>
                    <ImageCardMedia
                      source={BOOK_IMAGES[bookImageIndex].source}
                      width={isTabletRange ? 180 : 220}
                      height={isTabletRange ? 270 : 330}
                      borderRadius={DESIGN_TOKENS.radii.lg}
                      fit="cover"
                      quality={90}
                      alt={BOOK_IMAGES[bookImageIndex].alt}
                      loading={Platform.OS === 'web' ? 'eager' : 'lazy'}
                      priority={Platform.OS === 'web' ? 'high' : 'normal'}
                      transition={300}
                      style={styles.bookImage}
                    />
                    <View style={styles.bookOverlay}>
                      <Text style={styles.bookOverlayTitle} numberOfLines={2}>
                        {BOOK_IMAGES[bookImageIndex].title}
                      </Text>
                      <Text style={styles.bookOverlaySubtitle} numberOfLines={1}>
                        {BOOK_IMAGES[bookImageIndex].subtitle}
                      </Text>
                    </View>
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
