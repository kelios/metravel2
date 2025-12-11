/**
 * Компонент карточки автора для основного контента
 * Показывает информацию об авторе путешествия для установления доверия
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface AuthorCardProps {
  travel: Travel;
  onViewAuthorTravels?: () => void;
}

export default function AuthorCard({ travel, onViewAuthorTravels }: AuthorCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  // Извлекаем и очищаем данные об авторе
  const userName = useMemo(() => {
    // 1. Пробуем user объект (самый надежный источник)
    const userObj = travel.user;
    if (userObj) {
      const firstName = userObj.first_name || userObj.name;
      const lastName = userObj.last_name;
      
      if (firstName && typeof firstName === 'string' && firstName.trim()) {
        const cleanFirstName = firstName.trim();
        if (lastName && typeof lastName === 'string' && lastName.trim()) {
          return `${cleanFirstName} ${lastName.trim()}`.trim();
        }
        return cleanFirstName;
      }
    }
    
    // 2. Пробуем прямые поля в travel объекте
    const directName = (travel as any).author_name || (travel as any).authorName || (travel as any).owner_name || (travel as any).ownerName;
    if (directName && typeof directName === 'string' && directName.trim()) {
      const clean = directName.trim();
      // Проверяем на очевидные плейсхолдеры
      if (!/^[\.\s\u00B7\u2022]+$|^Автор|^Пользователь|^User/i.test(clean)) {
        return clean;
      }
    }
    
    // 3. Используем поле userName как основной fallback
    const base = (travel as any).userName || '';
    if (typeof base === 'string' && base.trim()) {
      const clean = base.trim();
      // Проверяем на плейсхолдеры, но менее строго
      if (!/^[\.\s\u00B7\u2022]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i.test(clean)) {
        return clean;
      }
    }
    
    // 4. Ничего не найдено
    return '';
  }, [travel.user?.name, travel.user?.first_name, travel.user?.last_name, (travel as any).userName]);
  
  const countryName = (travel as any).countryName || '';
  const userId = (travel as any).userIds ?? (travel as any).userId ?? null;
  
  // Подсчет количества путешествий автора (если доступно)
  const travelsCount = (travel as any).userTravelsCount || null;

  // Оптимизация аватара
  const avatarUri = useMemo(() => {
    const rawUri = (travel as any).travel_image_thumb_small_url;
    if (!rawUri) return '';
    
    const versionedUrl = buildVersionedImageUrl(
      rawUri,
      (travel as any).updated_at,
      travel.id
    );
    
    const avatarSize = isMobile ? 64 : 80;
    const optimalSize = getOptimalImageSize(avatarSize, avatarSize);
    
    return optimizeImageUrl(versionedUrl, {
      width: optimalSize.width,
      height: optimalSize.height,
      format: 'webp',
      quality: 85,
      fit: 'cover',
    }) || versionedUrl;
  }, [(travel as any).travel_image_thumb_small_url, (travel as any).updated_at, travel.id, isMobile]);

  const handleViewAuthorTravels = useCallback(() => {
    if (onViewAuthorTravels) {
      onViewAuthorTravels();
    } else if (userId) {
      const url = `/?user_id=${userId}`;
      if (Platform.OS === 'web') {
        router.push(url as any);
      } else {
        Linking.openURL(url);
      }
    }
  }, [userId, onViewAuthorTravels, router]);

  // Не показываем если нет данных об авторе
  if (!userName && !countryName && !userId) {
    return null;
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        {/* Аватар */}
        <View style={styles.avatarSection}>
          {avatarUri ? (
            <ExpoImage
              source={{ uri: avatarUri }}
              style={[styles.avatar, isMobile && styles.avatarMobile]}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="low"
              transition={200}
              placeholder={require("@/assets/placeholder.webp")}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, isMobile && styles.avatarMobile]}>
              <MaterialIcons name="person" size={isMobile ? 32 : 40} color="#94a3b8" />
            </View>
          )}
        </View>

        {/* Информация об авторе */}
        <View style={styles.infoSection}>
          <Text style={[styles.authorName, isMobile && styles.authorNameMobile]}>
            {userName || 'Аноним'}
          </Text>
          
          {countryName && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color="#718096" />
              <Text style={styles.locationText}>{countryName}</Text>
            </View>
          )}

          {travelsCount !== null && (
            <View style={styles.statsRow}>
              {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
              <MaterialIcons name="explore" size={16} color="#6b7280" />
              <Text style={styles.statsText}>
                {travelsCount} {travelsCount === 1 ? 'путешествие' : travelsCount < 5 ? 'путешествия' : 'путешествий'}
              </Text>
            </View>
          )}
        </View>

        {/* Кнопка "Смотреть все путешествия" */}
        {userId && (
          <Pressable
            style={({ pressed }) => [
              styles.viewButton,
              isMobile && styles.viewButtonMobile,
              pressed && styles.viewButtonPressed,
            ]}
            onPress={handleViewAuthorTravels}
            accessibilityRole="button"
            accessibilityLabel={`Смотреть все путешествия автора ${userName}`}
          >
            <Text style={[styles.viewButtonText, isMobile && styles.viewButtonTextMobile]}>
              Все путешествия
            </Text>
            {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
            <Feather name="arrow-right" size={16} color="#6b7280" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: Platform.select({
      default: 20, // Мобильные
      web: 24, // Десктоп
    }),
    marginBottom: Platform.select({
      default: 24, // Мобильные
      web: 32, // Десктоп
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 4,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  containerMobile: {
    padding: DESIGN_TOKENS.spacing.xxs,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
    borderRadius: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    height: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    borderRadius: Platform.select({
      default: 32, // Мобильные
      web: 40, // Десктоп
    }),
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 3
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 2,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 3
  },
  avatarMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
  },
  avatarPlaceholder: {
    width: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    height: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    borderRadius: Platform.select({
      default: 32, // Мобильные
      web: 40, // Десктоп
    }),
    backgroundColor: '#f3f4f6',
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 3
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    flex: 1,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  authorName: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
    color: '#1a202c',
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  authorNameMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  locationText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: '#4a5568',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: 4,
  },
  statsText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: '#718096',
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: Platform.select({
      default: 10, // Мобильные
      web: 12, // Десктоп
    }),
    paddingHorizontal: Platform.select({
      default: 16, // Мобильные
      web: 20, // Десктоп
    }),
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)', // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: 'rgba(0, 0, 0, 0.06)',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        ':hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderColor: '#1f2937',
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' as any,
        } as any,
      },
    }),
  },
  viewButtonMobile: {
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  viewButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)', // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    transform: [{ scale: 0.98 }],
  },
  viewButtonText: {
    fontSize: Platform.select({
      default: 14, // Мобильные
      web: 15, // Десктоп
    }),
    fontWeight: '600',
    color: '#6b7280', // ✅ УЛУЧШЕНИЕ: Нейтральный серый
  },
  viewButtonTextMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
});

