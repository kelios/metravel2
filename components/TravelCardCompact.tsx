// components/TravelCardCompact.tsx
// ✅ РЕДИЗАЙН: Компактная карточка путешествия для главной страницы

import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { Travel } from '@/src/types/types';
import FavoriteButton from '@/components/FavoriteButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelCardCompactProps {
  travel: Travel;
  onPress?: () => void;
  showActions?: boolean;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function TravelCardCompact({
  travel,
  onPress,
  showActions = true,
}: TravelCardCompactProps) {
  const router = useRouter();

  const {
    id,
    name,
    countryName,
    travel_image_thumb_url,
    countUnicIpView,
    slug,
  } = travel;

  const countries = countryName?.split(',').map(c => c.trim()).filter(Boolean) || [];

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/travels/${slug || id}`);
    }
  }, [onPress, router, slug, id]);

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Путешествие: ${name}`}
      {...Platform.select({
        web: {
          cursor: 'pointer',
          // @ts-ignore
          ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        },
      })}
    >
      {/* Изображение */}
      <View style={styles.imageContainer}>
        {travel_image_thumb_url ? (
          <Image
            source={{ uri: travel_image_thumb_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={24} color={palette.textMuted} />
          </View>
        )}
        
        {/* Градиент для читаемости */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.gradient}
        />

        {/* Быстрые действия */}
        {showActions && (
          <View style={styles.actionsOverlay}>
            <FavoriteButton
              id={id}
              type="travel"
              title={name || ''}
              imageUrl={travel_image_thumb_url}
              url={`/travels/${slug || id}`}
              country={countries[0]}
              size={18}
            />
          </View>
        )}

        {/* Просмотры */}
        {Number(countUnicIpView) > 0 && (
          <View style={styles.viewsBadge}>
            <Feather name="eye" size={12} color="#fff" />
            <Text style={styles.viewsText}>{countUnicIpView}</Text>
          </View>
        )}
      </View>

      {/* Контент */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {name}
        </Text>
        {countries.length > 0 && (
          <View style={styles.countries}>
            <Feather name="map-pin" size={12} color={palette.textMuted} />
            <Text style={styles.countriesText} numberOfLines={1}>
              {countries.join(', ')}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default memo(TravelCardCompact);

const styles = StyleSheet.create({
  card: {
    height: '100%',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: palette.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  actionsOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  viewsBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  viewsText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    padding: spacing.sm,
    height: 100,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  countries: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countriesText: {
    fontSize: 12,
    color: palette.textMuted,
    flex: 1,
  },
});

