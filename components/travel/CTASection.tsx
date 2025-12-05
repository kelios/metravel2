/**
 * Компонент CTA секции - призывы к действию
 * Побуждает пользователей к ключевым действиям: добавить в избранное, подписаться, создать путешествие
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface CTASectionProps {
  travel: Travel;
  onFavoriteToggle?: () => void;
}

export default function CTASection({ travel, onFavoriteToggle }: CTASectionProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const { isAuthenticated } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();

  // Проверяем, в избранном ли путешествие
  const isFavorite = favorites.some(f => f.id === travel.id);

  const handleFavorite = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    toggleFavorite({
      id: travel.id,
      type: 'travel',
      title: travel.name,
      imageUrl: travel.travel_image_thumb_url,
      url: `/travels/${travel.slug || travel.id}`,
      country: (travel as any).countryName,
    });
    onFavoriteToggle?.();
  }, [travel, isAuthenticated, toggleFavorite, onFavoriteToggle, router]);

  const handleCreateTravel = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push('/travel/new');
  }, [isAuthenticated, router]);

  const handleViewAuthorTravels = useCallback(() => {
    const userId = (travel as any).userIds ?? (travel as any).userId;
    if (userId) {
      router.push(`/?user_id=${userId}` as any);
    }
  }, [travel, router]);

  // Не показываем если пользователь не авторизован (или показываем с призывом зарегистрироваться)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, isMobile && styles.containerMobile]}>
        <View style={styles.content}>
          <View style={styles.textSection}>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              Хотите сохранить это путешествие?
            </Text>
            <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
              Войдите или зарегистрируйтесь, чтобы добавить в избранное и создавать свои маршруты
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isMobile && styles.primaryButtonMobile,
              pressed && styles.buttonPressed,
              globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
            ]}
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="Войти или зарегистрироваться"
          >
            <Text style={[styles.primaryButtonText, isMobile && styles.primaryButtonTextMobile]}>
              Войти / Регистрация
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        {/* Кнопка "Добавить в избранное" */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            isMobile && styles.actionButtonMobile,
            isFavorite && styles.actionButtonActive,
            pressed && styles.buttonPressed,
            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
          ]}
          onPress={handleFavorite}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          accessibilityState={{ selected: isFavorite }}
        >
          <MaterialIcons 
            name={isFavorite ? 'favorite' : 'favorite-border'} 
            size={20} 
            color={isFavorite ? DESIGN_TOKENS.colors.surface : DESIGN_TOKENS.colors.primary} 
          />
          <Text style={[
            styles.actionButtonText,
            isMobile && styles.actionButtonTextMobile,
            isFavorite && styles.actionButtonTextActive,
          ]}>
            {isFavorite ? 'В избранном' : 'В избранное'}
          </Text>
        </Pressable>

        {/* Кнопка "Смотреть все путешествия автора" */}
        {(travel as any).userIds || (travel as any).userId ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              isMobile && styles.actionButtonMobile,
              styles.actionButtonSecondary,
              pressed && styles.buttonPressed,
              globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
            ]}
            onPress={handleViewAuthorTravels}
            accessibilityRole="button"
            accessibilityLabel="Смотреть все путешествия автора"
          >
            <MaterialIcons name="person" size={20} color={DESIGN_TOKENS.colors.primary} />
            <Text style={[
              styles.actionButtonText,
              isMobile && styles.actionButtonTextMobile,
            ]}>
              Все путешествия автора
            </Text>
          </Pressable>
        ) : null}

        {/* Кнопка "Создать путешествие" */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            isMobile && styles.actionButtonMobile,
            styles.actionButtonSecondary,
            pressed && styles.buttonPressed,
            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
          ]}
          onPress={handleCreateTravel}
          accessibilityRole="button"
          accessibilityLabel="Создать свое путешествие"
        >
          <MaterialIcons name="add-circle-outline" size={20} color={DESIGN_TOKENS.colors.primary} />
          <Text style={[
            styles.actionButtonText,
            isMobile && styles.actionButtonTextMobile,
          ]}>
            Создать путешествие
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 16,
    padding: DESIGN_TOKENS.spacing.xxs4,
    marginBottom: 32,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
  },
  containerMobile: {
    padding: DESIGN_TOKENS.spacing.xxs0,
    marginBottom: DESIGN_TOKENS.spacing.xxs4,
    borderRadius: 12,
  },
  content: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  textSection: {
    marginBottom: 8,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: DESIGN_TOKENS.spacing.xs,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  titleMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: '#4a5568',
    lineHeight: 20,
  },
  subtitleMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: DESIGN_TOKENS.spacing.xxs0,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.primarySoft, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
          borderColor: DESIGN_TOKENS.colors.primary,
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: DESIGN_TOKENS.shadows.medium as any,
        } as any,
      },
    }),
  },
  actionButtonMobile: {
    paddingVertical: 12,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  actionButtonSecondary: {
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderColor: DESIGN_TOKENS.colors.border,
  },
  actionButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
  },
  actionButtonTextMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  actionButtonTextActive: {
    color: DESIGN_TOKENS.colors.surface,
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: DESIGN_TOKENS.spacing.xxs4,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: '#3a7a7a', // Темнее primary для hover
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: DESIGN_TOKENS.shadows.medium as any,
        } as any,
      },
    }),
  },
  primaryButtonMobile: {
    paddingVertical: 12,
    paddingHorizontal: DESIGN_TOKENS.spacing.xxs0,
  },
  primaryButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.surface,
  },
  primaryButtonTextMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
});

