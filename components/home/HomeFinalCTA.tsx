import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { ResponsiveContainer } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { buildLoginHref } from '@/utils/authNavigation';

interface HomeFinalCTAProps {
  travelsCount?: number;
}

function HomeFinalCTA({ travelsCount = 0 }: HomeFinalCTAProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const colors = useThemedColors();

  const handleAction = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA');
    if (!isAuthenticated) {
      router.push(buildLoginHref({ redirect: '/', intent: 'create-book' }) as any);
    } else if (travelsCount === 0) {
      router.push('/travel/new' as any);
    } else {
      router.push('/export' as any);
    }
  };

  const handleOpenSearch = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA_Search');
    router.push('/search' as any);
  };

  const buttonLabel = useMemo(() => {
    if (!isAuthenticated) return 'Начать бесплатно';
    if (travelsCount === 0) return 'Добавить первую поездку';
    return 'Открыть мою книгу';
  }, [isAuthenticated, travelsCount]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingVertical: isMobile ? 64 : 96,
      backgroundColor: colors.background,
      alignItems: 'center',
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
        },
      }),
    },
    content: {
      alignItems: 'center',
      gap: isMobile ? 20 : 28,
      maxWidth: 600,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: isMobile ? 28 : 40,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.8,
      lineHeight: isMobile ? 36 : 48,
    },
    subtitle: {
      fontSize: isMobile ? 16 : 18,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 24 : 28,
      maxWidth: 480,
    },
    buttonsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      gap: 12,
      width: isMobile ? '100%' : undefined,
      marginTop: 8,
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 40 : 48,
      paddingVertical: isMobile ? 18 : 20,
      minHeight: 60,
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
      fontSize: 17,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 32 : 40,
      paddingVertical: isMobile ? 18 : 20,
      minHeight: 60,
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
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth="lg" padding>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name="book-open" size={28} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>
            Готовы начать?
          </Text>
          
          <Text style={styles.subtitle}>
            Создайте личную книгу путешествий — бесплатно и без регистрации
          </Text>

          <View style={styles.buttonsContainer}>
            <Button
              onPress={handleAction}
              label={buttonLabel}
              variant="primary"
              size="lg"
              fullWidth={isMobile}
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonText}
              hoverStyle={styles.primaryButtonHover}
              pressedStyle={styles.primaryButtonHover}
              accessibilityLabel={buttonLabel}
            />
            <Button
              onPress={handleOpenSearch}
              label="Смотреть маршруты"
              variant="secondary"
              size="lg"
              fullWidth={isMobile}
              icon={<Feather name="compass" size={18} color={colors.text} />}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              hoverStyle={styles.secondaryButtonHover}
              pressedStyle={styles.secondaryButtonHover}
              accessibilityLabel="Смотреть маршруты"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFinalCTA);
