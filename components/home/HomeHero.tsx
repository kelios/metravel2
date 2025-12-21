import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveText, ResponsiveStack } from '@/components/layout';

interface HomeHeroProps {
  travelsCount?: number;
}

export default function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isSmallPhone, isPhone, isTablet, isDesktop } = useResponsive();

  const handleCreateBook = () => {
    sendAnalyticsEvent('HomeClick_CreateBook');
    if (!isAuthenticated) {
      router.push('/login?redirect=%2F&intent=create-book' as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  };

  const handleOpenSearch = () => {
    sendAnalyticsEvent('HomeClick_OpenSearch');
    router.push('/search' as any);
  };

  const primaryButtonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Рассказать о путешествии';
    if (travelsCount === 0) return 'Написать первую историю';
    return 'Собрать книгу из историй';
  }, [isAuthenticated, travelsCount]);

  const isMobile = isSmallPhone || isPhone;
  const showImage = isTablet || isDesktop;

  return (
    <ResponsiveContainer maxWidth="xxl" padding>
      <ResponsiveStack direction="responsive" gap={60} align="center">
        <View style={styles.content}>
          <ResponsiveText variant="h1" style={styles.title}>
            Пиши о своих путешествиях
          </ResponsiveText>
          
          <ResponsiveText variant="h4" style={styles.subtitle}>
            Делись маршрутами и историями, собирай их в красивую книгу — или ищи вдохновение, куда отправиться в этот раз.
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
            <Pressable
              onPress={handleCreateBook}
              style={({ pressed, hovered }) => [
                styles.primaryButton,
                (pressed || hovered) && styles.primaryButtonHover,
                globalFocusStyles.focusable,
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryButtonLabel}
            >
              <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
            </Pressable>

            <Pressable
              onPress={handleOpenSearch}
              style={({ pressed, hovered }) => [
                styles.secondaryButton,
                (pressed || hovered) && styles.secondaryButtonHover,
                globalFocusStyles.focusable,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Найти вдохновение">
              <Feather name="compass" size={18} color={DESIGN_TOKENS.colors.text} />
              <Text style={styles.secondaryButtonText}>Найти вдохновение</Text>
            </Pressable>
          </ResponsiveStack>
        </View>

        {showImage && (
          <View style={styles.imageContainer}>
            <Image
              source={require('../../assets/images/pdf.webp')}
              style={styles.bookImage}
              resizeMode="contain"
              {...(Platform.OS === 'web' ? { loading: 'lazy' as any } : {})}
            />
          </View>
        )}
      </ResponsiveStack>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
  },
  title: {
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: DESIGN_TOKENS.colors.textMuted,
    maxWidth: 540,
  },
  hint: {
    fontSize: 15,
    color: DESIGN_TOKENS.colors.textSubtle,
    lineHeight: 24,
    marginTop: 8,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: DESIGN_TOKENS.colors.primaryLight,
  },
  buttonsContainer: {
    marginTop: 32,
  },
  primaryButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Platform.select({
      web: {
        flex: 1,
        boxShadow: '0 4px 14px rgba(93, 140, 124, 0.25)',
        transition: 'all 0.2s ease',
      },
    }),
  },
  primaryButtonHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryDark,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(93, 140, 124, 0.35)',
        transform: 'translateY(-2px)',
      },
    }),
  },
  primaryButtonText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: DESIGN_TOKENS.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    ...Platform.select({
      web: {
        flex: 1,
        transition: 'all 0.2s ease',
      },
    }),
  },
  secondaryButtonHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderColor: DESIGN_TOKENS.colors.primary,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      },
    }),
  },
  secondaryButtonText: {
    color: DESIGN_TOKENS.colors.text,
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
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
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
    color: DESIGN_TOKENS.colors.textMuted,
    fontWeight: '500',
  },
  bookImage: {
    width: 320,
    height: 400,
    borderRadius: DESIGN_TOKENS.radii.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(31, 31, 31, 0.15), 0 8px 24px rgba(31, 31, 31, 0.1)',
      },
    }),
  },
});
