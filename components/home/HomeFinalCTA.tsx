import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { sendAnalyticsEvent } from '@/src/utils/analytics';

interface HomeFinalCTAProps {
  travelsCount?: number;
}

export default function HomeFinalCTA({ travelsCount = 0 }: HomeFinalCTAProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const handleAction = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA');
    if (!isAuthenticated) {
      router.push('/login?redirect=%2F&intent=create-book' as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  };

  const buttonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Рассказать о путешествии';
    if (travelsCount === 0) return 'Написать первую историю';
    return 'Собрать книгу из историй';
  }, [isAuthenticated, travelsCount]);

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          Начни писать свою историю
        </Text>
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
          Расскажи о своих путешествиях, вдохнови других — и собери всё в красивую книгу на память.
        </Text>

        <Pressable
          onPress={handleAction}
          style={({ pressed, hovered }) => [
            styles.button,
            (pressed || hovered) && styles.buttonHover,
            globalFocusStyles.focusable,
          ]}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 60,
    paddingVertical: 100,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #5d8c7c 0%, #4d7566 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
      },
    }),
  },
  containerMobile: {
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
  content: {
    maxWidth: 700,
    alignItems: 'center',
    gap: 32,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.surface,
    lineHeight: 52,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 32,
    textAlign: 'center',
    maxWidth: 560,
  },
  subtitleMobile: {
    fontSize: 18,
    lineHeight: 28,
  },
  button: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    minWidth: 300,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(31, 31, 31, 0.2)',
        transition: 'all 0.2s ease',
      },
    }),
  },
  buttonHover: {
    backgroundColor: DESIGN_TOKENS.colors.background,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px rgba(31, 31, 31, 0.3)',
        transform: 'translateY(-2px)',
      },
    }),
  },
  buttonText: {
    color: DESIGN_TOKENS.colors.primary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
