import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { sendAnalyticsEvent } from '@/src/utils/analytics';

interface HomeHeroProps {
  travelsCount?: number;
}

export default function HomeHero({ travelsCount = 0 }: HomeHeroProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const isSmallMobile = width <= 480;
  const isMobile = width <= 768;

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

  return (
    <View style={[
      styles.container, 
      isMobile && styles.containerMobile,
      isSmallMobile && styles.containerSmallMobile
    ]}>
      <View style={styles.content}>
        <Text style={[
          styles.title, 
          isMobile && styles.titleMobile,
          isSmallMobile && styles.titleSmallMobile
        ]}>
          Пиши о своих путешествиях
        </Text>
        <Text style={[
          styles.subtitle, 
          isMobile && styles.subtitleMobile,
          isSmallMobile && styles.subtitleSmallMobile
        ]}>
          Делись маршрутами и историями, собирай их в красивую книгу — или ищи вдохновение, куда отправиться в этот раз.
        </Text>

        {travelsCount === 0 && isAuthenticated && (
          <Text style={[styles.hint, isMobile && styles.hintMobile]}>
            Расскажи о своём первом путешествии — или найди вдохновение в историях других путешественников.
          </Text>
        )}

        <View style={[styles.buttonsContainer, isMobile && styles.buttonsContainerMobile]}>
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
        </View>
      </View>

      {!isMobile && (
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/images/pdf.webp')}
            style={styles.bookImage}
            resizeMode="contain"
            {...(Platform.OS === 'web' ? { loading: 'lazy' as any } : {})}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 60,
    paddingVertical: 100,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    alignItems: 'center',
    gap: 60,
    ...Platform.select({
      web: {
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f7f5 100%)',
      },
    }),
  },
  containerMobile: {
    flexDirection: 'column',
    paddingHorizontal: 24,
    paddingVertical: 60,
    gap: 40,
  },
  containerSmallMobile: {
    paddingHorizontal: 16,
    paddingVertical: 40,
    gap: 24,
  },
  content: {
    flex: 1,
    gap: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 56,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  titleSmallMobile: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 32,
    maxWidth: 540,
  },
  subtitleMobile: {
    fontSize: 18,
    lineHeight: 28,
  },
  subtitleSmallMobile: {
    fontSize: 16,
    lineHeight: 24,
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
  hintMobile: {
    fontSize: 14,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  buttonsContainerMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flex: 1,
    ...Platform.select({
      web: {
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
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: DESIGN_TOKENS.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    flex: 1,
    ...Platform.select({
      web: {
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
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
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
