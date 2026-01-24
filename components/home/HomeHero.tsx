import { useEffect, useMemo, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Asset } from 'expo-asset';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { ResponsiveContainer, ResponsiveText, ResponsiveStack } from '@/components/layout';
import Button from '@/components/ui/Button';
import OptimizedImage from './OptimizedImage';

interface HomeHeroProps {
  travelsCount?: number;
}

const HomeHero = memo(function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const colors = useThemedColors();
  const { isSmallPhone, isPhone, isTablet, isLargeTablet, isDesktop } = useResponsive();
  const articleUrl =
    'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele';

  const isWeb = Platform.OS === 'web';
  const [hydrated, setHydrated] = useState(!isWeb);

  const queueAnalyticsEvent = (eventName: string, eventParams: Record<string, unknown> = {}) => {
    if (process.env.NODE_ENV === 'test') {
      try {
        const m = require('@/src/utils/analytics');
        if (typeof m?.sendAnalyticsEvent === 'function') {
          const isEmptyParams = !eventParams || Object.keys(eventParams).length === 0;
          if (isEmptyParams) {
            m.sendAnalyticsEvent(eventName);
          } else {
            m.sendAnalyticsEvent(eventName, eventParams);
          }
        }
      } catch {
        // noop
      }
      return;
    }

    const run = () => {
      import('@/src/utils/analytics')
        .then((m) => m.sendAnalyticsEvent(eventName, eventParams))
        .catch(() => {
          // noop
        });
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
      return;
    }

    setTimeout(run, 0);
  };

  useEffect(() => {
    if (!isWeb) return;
    setHydrated(true);
  }, [isWeb]);

  const handleCreateBook = () => {
    queueAnalyticsEvent('HomeClick_CreateBook');
    if (!isAuthenticated) {
      router.push('/login?redirect=%2F&intent=create-book' as any);
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
    Linking.openURL(articleUrl);
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Рассказать о путешествии';
    if (travelsCount === 0) return 'Написать первую историю';
    return 'Собрать книгу из историй';
  }, [isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const showImage = hydrated && (isTablet || isLargeTablet || isDesktop);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!showImage) return;
    if (typeof document === 'undefined') return;

    const moduleId = require('../../assets/images/pdf.webp');
    const asset = Asset.fromModule(moduleId);
    const href = typeof asset?.uri === 'string' ? asset.uri : '';
    if (!href) return;

    const id = 'preload-home-hero-pdf';
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);

    return () => {
      try {
        link.parentNode?.removeChild(link);
      } catch {
        // noop
      }
    };
  }, [showImage]);

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 56,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
    },
    bandMobile: {
      paddingVertical: 40,
    },
    content: {
      flex: 1,
      gap: 24,
    },
    title: {
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textMuted,
      maxWidth: 540,
    },
    hint: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 24,
      marginTop: 8,
      paddingLeft: 16,
      borderLeftWidth: 3,
      borderLeftColor: colors.primaryLight,
    },
    buttonsContainer: {
      marginTop: 32,
      width: '100%',
    },
    primaryButton: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      minHeight: 56,
      ...Platform.select({
        web: {
          flex: 1,
          boxShadow: DESIGN_TOKENS.shadows.medium,
          transition: 'all 0.2s ease',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.heavy,
          transform: 'translateY(-2px)',
        },
      }),
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    secondaryButton: {
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 8,
      minHeight: 56,
      ...Platform.select({
        web: {
          flex: 1,
          transition: 'all 0.2s ease',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
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
      width: 320,
      height: 400,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        },
      }),
    },
  }), [colors]);

  return (
    <View testID="home-hero" style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack direction="responsive" gap={60} align="center">
          <View style={styles.content}>
            <ResponsiveText variant="h1" style={styles.title}>
              Пиши о своих путешествиях
            </ResponsiveText>

            <ResponsiveText variant="h4" style={styles.subtitle}>
              Делись маршрутами и историями, собирай их в красивую книгу — или выбирай, куда поехать дальше, читая поездки других.
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
                onPress={handleCreateBook}
                label={primaryButtonLabel}
                variant="primary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                style={styles.primaryButton}
                labelStyle={styles.primaryButtonText}
                hoverStyle={styles.primaryButtonHover}
                pressedStyle={styles.primaryButtonHover}
              />

              <Button
                onPress={handleOpenSearch}
                label="Выбрать, куда поехать"
                variant="secondary"
                size={isMobile ? 'md' : 'lg'}
                fullWidth={isMobile}
                icon={<Feather name="compass" size={18} color={colors.text} />}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                hoverStyle={styles.secondaryButtonHover}
                pressedStyle={styles.secondaryButtonHover}
                accessibilityLabel="Выбрать, куда поехать"
              />
            </ResponsiveStack>
          </View>

          {showImage && (
            <Pressable
              onPress={handleOpenArticle}
              accessibilityRole="link"
              accessibilityLabel="Открыть статью о маршруте Харцер Хексенштиг"
              style={styles.imageContainer}
            >
              <OptimizedImage
                source={require('../../assets/images/pdf.webp')}
                width={320}
                height={400}
                borderRadius={DESIGN_TOKENS.radii.lg}
                alt="Пример книги путешествий"
                loadingStrategy={Platform.OS === 'web' ? 'eager' : 'lazy'}
                style={styles.bookImage}
              />
            </Pressable>
          )}
        </ResponsiveStack>
      </ResponsiveContainer>
    </View>
  );
});


export default HomeHero;
