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
          ]}
          onPress={handleFavorite}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          accessibilityState={{ selected: isFavorite }}
        >
          <MaterialIcons 
            name={isFavorite ? 'favorite' : 'favorite-border'} 
            size={20} 
            color={isFavorite ? '#fff' : '#ff9f5a'} 
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
            ]}
            onPress={handleViewAuthorTravels}
            accessibilityRole="button"
            accessibilityLabel="Смотреть все путешествия автора"
          >
            <MaterialIcons name="person" size={20} color="#ff9f5a" />
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
          ]}
          onPress={handleCreateTravel}
          accessibilityRole="button"
          accessibilityLabel="Создать свое путешествие"
        >
          <MaterialIcons name="add-circle-outline" size={20} color="#ff9f5a" />
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  containerMobile: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 12,
  },
  content: {
    gap: 12,
  },
  textSection: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 6,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  titleMobile: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  subtitleMobile: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fff5eb',
    borderWidth: 1,
    borderColor: '#ffe4d0',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: '#ffe4d0',
          borderColor: '#ff9f5a',
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: '0 4px 12px rgba(255, 159, 90, 0.2)' as any,
        } as any,
      },
    }),
  },
  actionButtonMobile: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonSecondary: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  actionButtonActive: {
    backgroundColor: '#ff9f5a',
    borderColor: '#ff9f5a',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff9f5a',
  },
  actionButtonTextMobile: {
    fontSize: 14,
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#ff9f5a',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: '#ff8c42',
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: '0 4px 12px rgba(255, 159, 90, 0.3)' as any,
        } as any,
      },
    }),
  },
  primaryButtonMobile: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  primaryButtonTextMobile: {
    fontSize: 15,
  },
});

