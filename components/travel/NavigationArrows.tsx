/**
 * Компонент навигации между путешествиями
 * Показывает предыдущее и следующее путешествие из списка похожих
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';

interface NavigationArrowsProps {
  currentTravel: Travel;
  relatedTravels: Travel[];
  onNavigate?: (travelId: number | string) => void;
}

export default function NavigationArrows({
  currentTravel,
  relatedTravels,
  onNavigate,
}: NavigationArrowsProps) {
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  // Находим текущее путешествие в списке похожих
  const currentIndex = useMemo(() => {
    if (!currentTravel?.id) return -1;
    return relatedTravels.findIndex(
      (t) => t.id === currentTravel.id || t.slug === (currentTravel as any).slug
    );
  }, [currentTravel, relatedTravels]);

  // Определяем предыдущее и следующее путешествие
  const { prevTravel, nextTravel } = useMemo(() => {
    if (currentIndex === -1 || relatedTravels.length < 2) {
      return { prevTravel: null, nextTravel: null };
    }

    const prev = currentIndex > 0 ? relatedTravels[currentIndex - 1] : null;
    const next =
      currentIndex < relatedTravels.length - 1 ? relatedTravels[currentIndex + 1] : null;

    return { prevTravel: prev, nextTravel: next };
  }, [currentIndex, relatedTravels]);

  const handleNavigate = useCallback(
    (travel: Travel | null) => {
      if (!travel) return;
      const travelId = travel.slug || travel.id;
      if (onNavigate) {
        onNavigate(travelId);
      } else {
        router.push(`/travels/${travelId}`);
      }
    },
    [onNavigate, router]
  );

  // ✅ ИСПРАВЛЕНИЕ: Переместили useCallback выше условного return, чтобы соблюдать правила хуков
  // ✅ УЛУЧШЕНИЕ: Оптимизированная функция для построения URL изображений
  const buildImageUrl = useCallback((travel: Travel) => {
    const img = (travel as any).travel_image_thumb_url || (travel as any).gallery?.[0]?.url;
    if (!img) return undefined;
    
    const versionedUrl = buildVersionedImageUrl(
      img,
      (travel as any).gallery?.[0]?.updated_at || (travel as any).updated_at,
      (travel as any).gallery?.[0]?.id || travel.id
    );
    
    // Оптимизация размера для миниатюры навигации (60x60)
    const thumbSize = 60;
    const optimalSize = getOptimalImageSize(thumbSize, thumbSize);
    
    return optimizeImageUrl(versionedUrl, {
      width: optimalSize.width,
      height: optimalSize.height,
      format: 'webp',
      quality: 80,
      fit: 'cover',
    }) || versionedUrl;
  }, []);

  // Если нет соседних путешествий, не показываем компонент
  if (!prevTravel && !nextTravel) {
    return null;
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Предыдущее путешествие */}
      {prevTravel ? (
        <Pressable
          onPress={() => handleNavigate(prevTravel)}
          style={[styles.navCard, styles.prevCard, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
          accessibilityRole="button"
          accessibilityLabel={`Предыдущее путешествие: ${prevTravel.name || ''}`}
          android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
        >
          <View style={styles.navContent}>
            {/* ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет */}
            <MaterialIcons name="chevron-left" size={24} color={DESIGN_TOKENS.colors.primary} />
            <View style={styles.navInfo}>
              <Text style={styles.navLabel} numberOfLines={1}>
                Предыдущее
              </Text>
              <Text style={styles.navTitle} numberOfLines={2}>
                {prevTravel.name || 'Без названия'}
              </Text>
            </View>
            {buildImageUrl(prevTravel) && (
              <View style={styles.navImageWrap}>
                <ExpoImage
                  source={{ uri: buildImageUrl(prevTravel)! }}
                  style={styles.navImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="low"
                  // ✅ УЛУЧШЕНИЕ: Адаптивное качество для миниатюр
                  contentPosition="center"
                />
              </View>
            )}
          </View>
        </Pressable>
      ) : (
        <View style={styles.navCard} />
      )}

      {/* Следующее путешествие */}
      {nextTravel ? (
        <Pressable
          onPress={() => handleNavigate(nextTravel)}
          style={[styles.navCard, styles.nextCard, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
          accessibilityRole="button"
          accessibilityLabel={`Следующее путешествие: ${nextTravel.name || ''}`}
          android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
        >
          <View style={styles.navContent}>
            {buildImageUrl(nextTravel) && (
              <View style={styles.navImageWrap}>
                <ExpoImage
                  source={{ uri: buildImageUrl(nextTravel)! }}
                  style={styles.navImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="low"
                  // ✅ УЛУЧШЕНИЕ: Адаптивное качество для миниатюр
                  contentPosition="center"
                />
              </View>
            )}
            <View style={styles.navInfo}>
              <Text style={styles.navLabel} numberOfLines={1}>
                Следующее
              </Text>
              <Text style={styles.navTitle} numberOfLines={2}>
                {nextTravel.name || 'Без названия'}
              </Text>
            </View>
            {/* ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет */}
            <MaterialIcons name="chevron-right" size={24} color={DESIGN_TOKENS.colors.primary} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.navCard} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.lg,
    marginTop: 4,
    marginBottom: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  containerMobile: {
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 12,
  },
  navCard: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    padding: DESIGN_TOKENS.spacing.lg,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: '#1f1f1f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 80, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ':hover': {
          borderColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
          shadowOpacity: 0.1,
          shadowRadius: 12,
          transform: 'translateY(-2px)',
        } as any,
        ':active': {
          transform: 'translateY(0)',
        } as any,
      },
    }),
  },
  prevCard: {},
  nextCard: {},
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
  },
  navInfo: {
    flex: 1,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  navLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: '#1f2937',
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  navImageWrap: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  navImage: {
    width: '100%',
    height: '100%',
  },
});

