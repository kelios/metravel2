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
import { openExternalUrl } from '@/utils/externalLinks';

interface HomeHeroProps {
  travelsCount?: number;
}

const QUICK_FILTER_BADGES = [
  { icon: 'navigation', label: 'До 200 км' },
  { icon: 'credit-card', label: 'Бюджет до 200 BYN' },
  { icon: 'sun', label: 'Природа / город / активность' },
  { icon: 'clock', label: '1-2 дня' },
];

const MOOD_CARDS = [
  { title: 'Озёрный уикенд', meta: 'Природа • 2 дня', icon: 'sun' },
  { title: 'Город и кофе', meta: 'Город • 1 день', icon: 'coffee' },
  { title: 'Активный выезд', meta: 'Треккинг • Бюджетно', icon: 'activity' },
] as const;

const HomeHero = memo(function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone } = useResponsive();
  const articleUrl =
    'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele';

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

  const handleOpenArticle = () => {
    queueAnalyticsEvent('HomeClick_TrainArticle');
    void openExternalUrl(articleUrl);
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Создать книгу путешествий';
    if (travelsCount === 0) return 'Сохранить первую поездку';
    return 'Открыть книгу путешествий';
  }, [isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const shouldRenderImageSlot = isWeb && !isMobile;

  // Preload removed: the <img loading="eager"> already fetches the image.
  // A separate <link rel="preload"> caused "preloaded but not used" warnings,
  // especially on mobile where the image slot is CSS-hidden (<768px).

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 52,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 80% 60% at 72% 38%, ${colors.primarySoft} 0%, transparent 72%), linear-gradient(115deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    bandMobile: {
      paddingVertical: 28,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 120% 50% at 50% 30%, ${colors.primarySoft} 0%, transparent 70%), linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 100%)`,
        },
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
    content: {
      flex: 1,
      gap: isMobile ? 16 : 20,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    titleWrap: {
      gap: 8,
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
      maxWidth: 540,
      fontSize: isMobile ? 16 : 18,
      lineHeight: isMobile ? 24 : 27,
      fontWeight: '400',
    },
    flowText: {
      color: colors.text,
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 22 : 24,
      fontWeight: '600',
      maxWidth: 560,
    },
    quickFilters: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 2,
    },
    quickFilterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backdropFilter: 'blur(6px)',
          transition: 'all 0.2s ease',
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
      marginTop: 4,
      paddingLeft: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    buttonsContainer: {
      marginTop: isMobile ? 16 : 28,
      width: '100%',
    },
    primaryButton: {
      paddingHorizontal: 28,
      paddingVertical: 16,
      minHeight: 56,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          flex: 1,
          boxShadow: `${DESIGN_TOKENS.shadows.medium}, 0 0 0 0 ${colors.primarySoft}`,
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
      borderColor: colors.border,
      paddingHorizontal: 24,
      paddingVertical: 14,
      gap: 8,
      minHeight: 56,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          flex: 1,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(8px)',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transform: 'translateY(-1px)',
        },
      }),
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imageDecor: {
      position: 'absolute',
      width: 360,
      height: 440,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.primaryLight,
      opacity: 0.5,
      ...Platform.select({
        web: {
          transform: 'rotate(3deg) translate(8px, 8px)',
        },
      }),
    },
    moodPanel: {
      position: 'absolute',
      left: -54,
      top: 22,
      width: 210,
      gap: 8,
    },
    moodPanelMobileHidden: {
      display: 'none',
    },
    moodCard: {
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.25s ease',
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
      right: -40,
      bottom: 34,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
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
          boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 8px 32px ${colors.primaryAlpha30}`,
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s ease',
          transform: 'rotate(-2deg)',
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
      <View style={[styles.decorOrb, styles.decorOrbTop]} />
      <View style={[styles.decorOrb, styles.decorOrbBottom]} />
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack testID="home-hero-stack" direction="responsive" gap={60} align="center">
          <View style={styles.content}>
            <View style={styles.positioning}>
              <Text style={styles.positioningText}>Планировщик коротких путешествий</Text>
            </View>

            <View style={styles.titleWrap}>
              <ResponsiveText variant="h1" style={styles.title}>
                Идеи поездок на выходные + ваша личная книга путешествий
              </ResponsiveText>
            </View>

            <ResponsiveText variant="h2" style={styles.subtitle}>
              Сервис для тех, кто не знает куда поехать: выбирай направление, сохраняй маршруты и собирай travel-историю в одном месте.
            </ResponsiveText>

            <Text style={styles.flowText}>
              Выбирай куда поехать {'->'} сохраняй маршруты {'->'} создавай travel-историю.
            </Text>

            <View style={styles.quickFilters}>
              {QUICK_FILTER_BADGES.map((badge) => (
                <View key={badge.label} style={styles.quickFilterItem}>
                  <Feather name={badge.icon as any} size={14} color={colors.primary} />
                  <Text style={styles.quickFilterText}>{badge.label}</Text>
                </View>
              ))}
            </View>

            {travelsCount === 0 && isAuthenticated && (
              <Text style={styles.hint}>
                Начни с одной поездки на выходные: сохрани маршрут и получи основу для своей книги путешествий.
              </Text>
            )}

            <ResponsiveStack
              direction={isMobile ? 'vertical' : 'horizontal'}
              gap={isMobile ? 12 : 16}
              style={styles.buttonsContainer}
            >
              <Button
                onPress={handleOpenSearch}
                label="Подобрать поездку"
                variant="primary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                icon={<Feather name="compass" size={18} color={colors.textOnPrimary} />}
                style={styles.primaryButton}
                labelStyle={styles.primaryButtonText}
                hoverStyle={styles.primaryButtonHover}
                pressedStyle={styles.primaryButtonHover}
                accessibilityLabel="Подобрать поездку"
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
              onPress={handleOpenArticle}
              accessibilityRole="link"
              accessibilityLabel="Открыть статью о маршруте Харцер Хексенштиг"
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
                      <View key={card.title} style={styles.moodCard}>
                        <View style={styles.moodCardHeader}>
                          <Feather name={card.icon as any} size={13} color={colors.primary} />
                          <Text style={styles.moodCardTitle}>{card.title}</Text>
                        </View>
                        <Text style={styles.moodCardMeta}>{card.meta}</Text>
                      </View>
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
                    <Text style={styles.travelStatsValue}>12 поездок</Text>
                    <Text style={styles.travelStatsMeta}>готова к PDF и share</Text>
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
