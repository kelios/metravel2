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

interface AuthorCardProps {
  travel: Travel;
  onViewAuthorTravels?: () => void;
}

export default function AuthorCard({ travel, onViewAuthorTravels }: AuthorCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  // Извлекаем данные об авторе
  const userName = (travel as any).userName || '';
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
            {userName || 'Автор путешествия'}
          </Text>
          
          {countryName && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color="#718096" />
              <Text style={styles.locationText}>{countryName}</Text>
            </View>
          )}

          {travelsCount !== null && (
            <View style={styles.statsRow}>
              <MaterialIcons name="explore" size={16} color="#ff9f5a" />
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
            <Feather name="arrow-right" size={16} color="#ff9f5a" />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#ffe4d0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    borderWidth: 3,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    flex: 1,
    gap: 8,
  },
  authorName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  authorNameMobile: {
    fontSize: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
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
  viewButtonMobile: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewButtonPressed: {
    backgroundColor: '#ffe4d0',
    transform: [{ scale: 0.98 }],
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff9f5a',
  },
  viewButtonTextMobile: {
    fontSize: 14,
  },
});

