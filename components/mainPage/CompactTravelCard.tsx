// CompactTravelCard.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Компактная карточка путешествия

import React, { useMemo, useState, memo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { optimizeImageUrl, buildVersionedImageUrl } from '@/utils/imageOptimization';

interface CompactTravelCardProps {
  travel: Travel;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
  showQuickInfo?: boolean;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const CARD_SIZES = {
  small: { width: 180, imageHeight: 120 },
  medium: { width: 240, imageHeight: 160 },
  large: { width: 300, imageHeight: 200 },
};

// ✅ РЕДИЗАЙН: Для очень маленьких экранов используем полную ширину
const getCardWidth = (size: 'small' | 'medium' | 'large', containerWidth: number, columns: number) => {
  if (columns === 1) {
    return containerWidth - (DESIGN_TOKENS.spacing.md * 2); // Полная ширина минус padding
  }
  return CARD_SIZES[size].width;
};

function CompactTravelCard({
  travel,
  size = 'medium',
  onPress,
  onFavoritePress,
  isFavorite = false,
  showQuickInfo = true,
}: CompactTravelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardSize = CARD_SIZES[size];
  
  // ✅ РЕДИЗАЙН: Определяем, нужно ли показывать меньше информации на маленьких карточках
  const isCompact = size === 'small';

  // ✅ UX УЛУЧШЕНИЕ: Анимация hover для web
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (Platform.OS === 'web') {
      Animated.spring(scaleAnim, {
        toValue: isHovered ? 1.02 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [isHovered, scaleAnim]);

  const {
    id,
    name,
    travel_image_thumb_url,
    countryName = '',
    userName,
    countUnicIpView = 0,
    number_days = 0,
  } = travel;

  // Оптимизация изображения
  const imageUrl = useMemo(() => {
    if (!travel_image_thumb_url) return null;
    const versionedUrl = buildVersionedImageUrl(
      travel_image_thumb_url,
      (travel as any).updated_at,
      id
    );
    return optimizeImageUrl(versionedUrl, {
      width: cardSize.width,
      height: cardSize.imageHeight,
      format: 'webp',
      quality: 75,
      fit: 'cover',
    }) || versionedUrl;
  }, [travel_image_thumb_url, cardSize, id, travel]);

  const countries = useMemo(
    () => countryName.split(',').map(c => c.trim()).filter(Boolean),
    [countryName]
  );

  return (
    <Animated.View
      style={[
        styles.card,
        { width: cardSize.width },
        Platform.OS === 'web' && {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        onHoverIn={Platform.OS === 'web' ? () => setIsHovered(true) : undefined}
        onHoverOut={Platform.OS === 'web' ? () => setIsHovered(false) : undefined}
        {...Platform.select({
          web: {
            cursor: 'pointer',
          },
        })}
      >
      {/* Изображение */}
      <View style={[styles.imageContainer, { height: cardSize.imageHeight }]}>
        {imageUrl ? (
          Platform.OS === 'web' ? (
            // @ts-ignore - web img element
            <img
              src={imageUrl}
              alt={name}
              style={styles.image}
              loading={isCompact ? "lazy" : "lazy"}
              decoding="async"
              fetchpriority={isCompact ? "low" : "auto"}
            />
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              priority={isCompact ? "low" : "normal"}
            />
          )
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={32} color={palette.textSubtle} />
          </View>
        )}

        {/* Градиент для читаемости */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          locations={[0.6, 0.8, 1]}
          style={styles.gradient}
        />

        {/* Badge с ключевой информацией */}
        {showQuickInfo && (
          <View style={styles.topBadges}>
            {countries[0] && !isCompact && (
              <View style={styles.infoBadge}>
                <Feather name="map-pin" size={10} color="#fff" />
                <Text style={styles.infoBadgeText} numberOfLines={1}>
                  {countries[0]}
                </Text>
              </View>
            )}
            {number_days > 0 && (
              <View style={styles.infoBadge}>
                <Feather name="calendar" size={isCompact ? 9 : 10} color="#fff" />
                <Text style={[styles.infoBadgeText, isCompact && styles.infoBadgeTextCompact]}>
                  {number_days} {isCompact ? 'д' : 'дн.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Кнопка избранного */}
        {onFavoritePress && (
          <Pressable
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              onFavoritePress();
            }}
            {...Platform.select({
              web: {
                cursor: 'pointer',
              },
            })}
          >
            <Feather
              name={isFavorite ? 'heart' : 'heart'}
              size={16}
              color={isFavorite ? '#ef4444' : '#fff'}
              fill={isFavorite ? '#ef4444' : 'none'}
            />
          </Pressable>
        )}

        {/* ✅ UX УЛУЧШЕНИЕ: Hover overlay с анимацией */}
        {Platform.OS === 'web' && (
          <Animated.View
            style={[
              styles.hoverOverlay,
              {
                opacity: isHovered ? 1 : 0,
              },
            ]}
          >
            <Text style={styles.hoverText}>Нажмите для просмотра</Text>
          </Animated.View>
        )}
      </View>
      </Pressable>

      {/* Контент */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.meta}>
          {userName && (
            <View style={styles.metaItem}>
              <Feather name="user" size={11} color={palette.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {userName}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="eye" size={11} color={palette.textMuted} />
            <Text style={styles.metaText}>
              {countUnicIpView || 0}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    borderWidth: Platform.select({
      ios: StyleSheet.hairlineWidth,
      android: StyleSheet.hairlineWidth,
      web: StyleSheet.hairlineWidth,
      default: 1,
    }), // ✅ ИСПРАВЛЕНИЕ: Используем hairlineWidth для более тонкой границы
    borderColor: palette.border,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: DESIGN_TOKENS.shadows.soft, // ✅ ИСПРАВЛЕНИЕ: Базовая тень из дизайн-системы
        // @ts-ignore
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: DESIGN_TOKENS.shadows.medium, // ✅ ИСПРАВЛЕНИЕ: Используем тень из дизайн-системы
          borderColor: palette.primary,
        },
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        objectFit: 'cover',
        display: 'block',
      },
    }),
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  topBadges: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 10,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
      },
    }),
  },
  infoBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  infoBadgeTextCompact: {
    fontSize: 9,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          // Убираем масштабирование, чтобы избежать мигания и дрожания при наведении
          backgroundColor: '#fff',
        },
      },
    }),
  },
  hoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: spacing.sm,
    backgroundColor: palette.surface,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 11,
    color: palette.textMuted,
    flex: 1,
  },
});

// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента для предотвращения лишних ререндеров
const MemoizedCompactTravelCard = memo(CompactTravelCard, (prevProps, nextProps) => {
  // Сравниваем только критичные пропсы
  return (
    prevProps.travel.id === nextProps.travel.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.size === nextProps.size &&
    prevProps.showQuickInfo === nextProps.showQuickInfo
  );
});

export default MemoizedCompactTravelCard;

