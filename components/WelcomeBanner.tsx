// components/WelcomeBanner.tsx
// ✅ РЕДИЗАЙН: Блок приветствия для главной страницы

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LinearGradient } from 'expo-linear-gradient';

interface WelcomeBannerProps {
  compact?: boolean;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export default function WelcomeBanner({ compact = false }: WelcomeBannerProps) {
  const router = useRouter();

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
        colors={[palette.primary, `${palette.primary}dd`]}
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
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                },
              })}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Создать путешествие</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/map')}
              accessibilityLabel="Открыть карту"
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                },
              })}
            >
              <Feather name="map" size={18} color={palette.primary} />
              <Text style={styles.secondaryButtonText}>На карте</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
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
    color: '#fff',
    ...Platform.select({
      web: {
        fontFamily: 'Georgia, serif',
      },
    }),
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
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
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        // @ts-ignore
        ':hover': {
          transform: 'translateY(-2px)',
        },
      },
    }),
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.primary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: 'rgba(255,255,255,0.3)',
        },
      },
    }),
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  compactContainer: {
    padding: spacing.md,
    backgroundColor: palette.primarySoft,
    borderRadius: radii.md,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.primary,
  },
});

