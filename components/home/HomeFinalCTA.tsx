import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { ResponsiveContainer } from '@/components/layout';

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
      <ResponsiveContainer maxWidth="xl" padding>
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
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 88,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, rgba(93, 140, 124, 0.10) 0%, rgba(93, 140, 124, 0.06) 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
      },
    }),
  },
  containerMobile: {
    paddingHorizontal: 0,
    paddingVertical: 72,
  },
  content: {
    alignItems: 'center',
    gap: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 48,
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
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 32,
    textAlign: 'center',
    maxWidth: 560,
  },
  subtitleMobile: {
    fontSize: 18,
    lineHeight: 28,
  },
  button: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    minWidth: 300,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 26px rgba(93, 140, 124, 0.28)',
        transition: 'all 0.2s ease',
      },
    }),
  },
  buttonHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryDark,
    ...Platform.select({
      web: {
        boxShadow: '0 14px 34px rgba(93, 140, 124, 0.35)',
        transform: 'translateY(-2px)',
      },
    }),
  },
  buttonText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
