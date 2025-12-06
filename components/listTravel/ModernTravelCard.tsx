// ModernTravelCard.tsx - Modern Travel Card Component Examples
import React, { memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { MODERN_DESIGN_TOKENS } from '@/styles/modernRedesign';

const {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  animations,
} = MODERN_DESIGN_TOKENS;

interface TravelCardProps {
  variant?: 'minimal' | 'rich' | 'pinterest';
  title: string;
  location: string;
  imageUrl: string;
  views?: number;
  author?: string;
  duration?: string;
  price?: string;
  rating?: number;
  onPress?: () => void;
}

// Variant 1: Minimal Clean Card (Airbnb-inspired)
export const MinimalTravelCard = memo(({
  title,
  location,
  imageUrl,
  views = 0,
  author,
  duration,
  rating,
  onPress,
}: TravelCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.minimalCard,
        isHovered && styles.minimalCardHover,
      ]}
    >
      <View style={styles.minimalImageWrapper}>
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.minimalImage}
          imageStyle={styles.minimalImageStyle}
        >
          <View style={styles.minimalFavorite}>
            <Feather name="heart" size={20} color="#fff" />
          </View>
        </ImageBackground>
      </View>
      
      <View style={styles.minimalContent}>
        <View style={styles.minimalHeader}>
          <View style={styles.minimalLocation}>
            <Feather name="map-pin" size={14} color={colors.neutral[500]} />
            <Text style={styles.minimalLocationText}>{location}</Text>
          </View>
          {rating && (
            <View style={styles.minimalRating}>
              <Feather name="star" size={14} color={colors.accent.amber} />
              <Text style={styles.minimalRatingText}>{rating}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.minimalTitle} numberOfLines={2}>
          {title}
        </Text>
        
        <View style={styles.minimalMeta}>
          {duration && (
            <View style={styles.minimalMetaItem}>
              <Feather name="calendar" size={12} color={colors.neutral[400]} />
              <Text style={styles.minimalMetaText}>{duration}</Text>
            </View>
          )}
          <View style={styles.minimalMetaItem}>
            <Feather name="eye" size={12} color={colors.neutral[400]} />
            <Text style={styles.minimalMetaText}>{formatViews(views)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// Variant 2: Rich Card with Overlay (Pinterest-inspired)
export const RichTravelCard = memo(({
  title,
  location,
  imageUrl,
  views = 0,
  author,
  price,
  onPress,
}: TravelCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.richCard,
        isHovered && styles.richCardHover,
      ]}
    >
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.richImage}
        imageStyle={styles.richImageStyle}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.richGradient}
        >
          <View style={styles.richOverlay}>
            <View style={styles.richBadge}>
              <Feather name="trending-up" size={12} color="#fff" />
              <Text style={styles.richBadgeText}>Popular</Text>
            </View>
            
            <View style={styles.richOverlayContent}>
              <View style={styles.richLocationRow}>
                <Feather name="map-pin" size={14} color="#fff" />
                <Text style={styles.richLocation}>{location}</Text>
              </View>
              <Text style={styles.richTitle} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
      
      <View style={styles.richBottom}>
        <View style={styles.richAuthor}>
          <View style={styles.richAvatar}>
            <Text style={styles.richAvatarText}>
              {author?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.richAuthorName}>{author || 'Unknown'}</Text>
            <Text style={styles.richViews}>{formatViews(views)} views</Text>
          </View>
        </View>
        {price && (
          <View style={styles.richPrice}>
            <Text style={styles.richPriceText}>{price}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// Variant 3: Pinterest-Style Card
export const PinterestTravelCard = memo(({
  title,
  location,
  imageUrl,
  views = 0,
  author,
  onPress,
}: TravelCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.pinterestCard,
        isHovered && styles.pinterestCardHover,
      ]}
    >
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.pinterestImage}
        imageStyle={styles.pinterestImageStyle}
      >
        {isHovered && (
          <View style={styles.pinterestOverlay}>
            <Pressable style={styles.pinterestAction}>
              <Feather name="heart" size={18} color="#fff" />
            </Pressable>
            <Pressable style={styles.pinterestAction}>
              <Feather name="bookmark" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </ImageBackground>
      
      <View style={styles.pinterestContent}>
        <Text style={styles.pinterestTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.pinterestMeta}>
          <Text style={styles.pinterestAuthor}>{author}</Text>
          <Text style={styles.pinterestDot}>•</Text>
          <Text style={styles.pinterestViews}>{formatViews(views)}</Text>
        </View>
      </View>
    </Pressable>
  );
});

// Helper function to format view counts
const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

const styles = StyleSheet.create({
  // Minimal Card Styles
  minimalCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.sm,
    ...Platform.select({
      web: {
        transition: `all ${animations.duration.base}ms ${animations.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  minimalCardHover: {
    ...shadows.lg,
    transform: [{ translateY: -4 }],
  },
  minimalImageWrapper: {
    width: '100%',
    aspectRatio: 1.5,
    overflow: 'hidden',
  },
  minimalImage: {
    width: '100%',
    height: '100%',
  },
  minimalImageStyle: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  minimalFavorite: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalContent: {
    padding: spacing.md,
  },
  minimalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  minimalLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  minimalLocationText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  minimalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  minimalRatingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[700],
  },
  minimalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[800],
    marginBottom: spacing.xs,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  minimalMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  minimalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  minimalMetaText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },

  // Rich Card Styles
  richCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    ...shadows.md,
    ...Platform.select({
      web: {
        transition: `all ${animations.duration.base}ms ${animations.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  richCardHover: {
    ...shadows.xl,
    transform: [{ scale: 1.02 }],
  },
  richImage: {
    width: '100%',
    height: 280,
  },
  richImageStyle: {
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
  },
  richGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  richOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  richBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.accent.amber,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  richBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
  richOverlayContent: {
    gap: spacing.xs,
  },
  richLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  richLocation: {
    fontSize: typography.fontSize.sm,
    color: '#fff',
    opacity: 0.9,
  },
  richTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: '#fff',
    lineHeight: typography.fontSize.xl * typography.lineHeight.tight,
  },
  richBottom: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  richAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  richAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  richAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  richAuthorName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  richViews: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  richPrice: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
  },
  richPriceText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },

  // Pinterest Card Styles
  pinterestCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.sm,
    ...Platform.select({
      web: {
        transition: `all ${animations.duration.fast}ms ${animations.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  pinterestCardHover: {
    ...shadows.md,
  },
  pinterestImage: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
  },
  pinterestImageStyle: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  pinterestOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  pinterestAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinterestContent: {
    padding: spacing.sm,
  },
  pinterestTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[800],
    marginBottom: spacing.xxs,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  pinterestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  pinterestAuthor: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
  },
  pinterestDot: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  pinterestViews: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
});

export default MinimalTravelCard;
