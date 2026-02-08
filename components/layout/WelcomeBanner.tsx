// components/WelcomeBanner.tsx
// ✅ РЕДИЗАЙН: Блок приветствия для главной страницы

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

interface WelcomeBannerProps {
  compact?: boolean;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function WelcomeBanner({ compact = false }: WelcomeBannerProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const isWeb = Platform.OS === 'web';

  const styles = useMemo(() => StyleSheet.create({
    container: {
      borderRadius: radii.lg,
      overflow: 'hidden',
      ...(isWeb
        ? ({ boxShadow: colors.boxShadows.medium } as any)
        : { ...colors.shadows.medium }),
    },
    gradient: {
      padding: spacing.lg,
    },
    content: {
      gap: spacing.md,
    },
    textContainer: {
      gap: spacing.xs,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textOnPrimary,
      ...(isWeb ? ({ fontFamily: 'Georgia, serif' } as any) : null),
    },
    subtitle: {
      fontSize: 15,
      color: colors.textOnPrimary,
      lineHeight: 22,
      opacity: 0.9,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      minHeight: 44,
      ...(isWeb
        ? ({
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
            ':hover': {
              transform: 'translateY(-2px)',
            },
          } as any)
        : null),
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primaryLight,
      minHeight: 44,
      ...(isWeb
        ? ({
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            ':hover': {
              backgroundColor: colors.primaryLight,
            },
          } as any)
        : null),
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    compactContainer: {
      padding: spacing.md,
      backgroundColor: colors.primarySoft,
      borderRadius: radii.md,
    },
    compactTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryText,
    },
  }), [colors, isWeb]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactTitle}>Откройте мир путешествий</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, `${colors.primary}dd`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Откройте мир путешествий</Text>
            <Text style={styles.subtitle}>
              Исследуйте уникальные маршруты, делитесь впечатлениями и находите вдохновение для новых приключений
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/travel/new')}
              accessibilityLabel="Создать путешествие"
            >
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={styles.primaryButtonText}>Создать путешествие</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/map')}
              accessibilityLabel="Открыть карту"
            >
              <Feather name="map" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>На карте</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export default React.memo(WelcomeBanner);
