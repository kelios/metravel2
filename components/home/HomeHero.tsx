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
    if (!isAuthenticated) return 'Рассказать о путешествии';
    if (travelsCount === 0) return 'Написать первую историю';
    return 'Собрать книгу из историй';
  }, [isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const shouldRenderImageSlot = isWeb && !isMobile;

  // Preload removed: the <img loading="eager"> already fetches the image.
  // A separate <link rel="preload"> caused "preloaded but not used" warnings,
  // especially on mobile where the image slot is CSS-hidden (<768px).

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 72,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 80% 60% at 70% 40%, ${colors.primarySoft} 0%, transparent 70%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    bandMobile: {
      paddingVertical: 48,
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 120% 50% at 50% 30%, ${colors.primarySoft} 0%, transparent 70%)`,
        },
      }),
    },
    content: {
      flex: 1,
      gap: 20,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    titleWrap: {
      gap: 4,
    },
    title: {
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textMuted,
      maxWidth: 540,
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '400',
    },
    hint: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 24,
      marginTop: 8,
      paddingLeft: 16,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    buttonsContainer: {
      marginTop: 28,
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
  }), [colors]);

  return (
    <View testID="home-hero" style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack testID="home-hero-stack" direction="responsive" gap={60} align="center">
          <View style={styles.content}>
            <View style={styles.titleWrap}>
              <ResponsiveText variant="h1" style={styles.title}>
                Находи маршруты.{isWeb ? '\n' : ' '}Делись историями.
              </ResponsiveText>
            </View>

            <ResponsiveText variant="h2" style={styles.subtitle}>
              Читай поездки других путешественников, сохраняй лучшие маршруты и собирай свои истории в книгу.
            </ResponsiveText>

            {travelsCount === 0 && isAuthenticated && (
              <Text style={styles.hint}>
                Расскажи о своём первом путешествии — или найди вдохновение в историях других путешественников.
              </Text>
            )}

            <ResponsiveStack
              direction={isMobile ? 'vertical' : 'horizontal'}
              gap={isMobile ? 12 : 16}
              style={styles.buttonsContainer}
            >
              <Button
                onPress={handleOpenSearch}
                label="Найти маршрут"
                variant="primary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                icon={<Feather name="compass" size={18} color={colors.textOnPrimary} />}
                style={styles.primaryButton}
                labelStyle={styles.primaryButtonText}
                hoverStyle={styles.primaryButtonHover}
                pressedStyle={styles.primaryButtonHover}
                accessibilityLabel="Найти маршрут"
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
                  <ImageCardMedia
                    source={require('../../assets/images/pdf.webp')}
                    width={267}
                    height={400}
                    borderRadius={DESIGN_TOKENS.radii.lg}
                    fit="cover"
                    alt="Пример книги путешествий"
                    loading={Platform.OS === 'web' ? 'eager' : 'lazy'}
                    priority={Platform.OS === 'web' ? 'high' : 'normal'}
                    transition={300}
                    style={[styles.bookImage, hovered && styles.bookImageHover]}
                  />
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
