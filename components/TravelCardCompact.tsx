// components/TravelCardCompact.tsx
// РЕДИЗАЙН: Компактная карточка путешествия для главной страницы

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { Travel } from '@/src/types/types';
import FavoriteButton from '@/components/FavoriteButton';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { TRAVEL_CARD_MAX_WIDTH } from '@/components/listTravel/utils/listTravelConstants';

interface TravelCardCompactProps {
  travel: Travel;
  onPress?: () => void;
  showActions?: boolean;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function TravelCardCompact({
  travel,
  onPress,
  showActions = true,
}: TravelCardCompactProps) {
  const router = useRouter();
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      height: '100%',
      maxWidth: TRAVEL_CARD_MAX_WIDTH,
      backgroundColor: colors.surface,
    },
    viewsBadge: {
      position: 'absolute',
      bottom: spacing.xs,
      left: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.overlay,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: radii.sm,
    },
    viewsText: {
      fontSize: 11,
      color: colors.textOnDark,
      fontWeight: '500',
    },
  }), [colors]);

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

  const rightTopSlot = showActions ? (
    <FavoriteButton
      id={id}
      type="travel"
      title={name || ''}
      imageUrl={travel_image_thumb_url}
      url={`/travels/${slug || id}`}
      country={countries[0]}
      size={18}
    />
  ) : null;

  const bottomLeftSlot = Number(countUnicIpView) > 0 ? (
    <View style={styles.viewsBadge}>
      <Feather name="eye" size={12} color={colors.textOnDark} />
      <Text style={styles.viewsText}>{countUnicIpView}</Text>
    </View>
  ) : null;

  return (
    <UnifiedTravelCard
      title={name}
      imageUrl={travel_image_thumb_url}
      metaText={countries.length > 0 ? countries.join(', ') : null}
      onPress={handlePress}
      rightTopSlot={rightTopSlot}
      bottomLeftSlot={bottomLeftSlot}
      imageHeight={Platform.OS === 'web' ? 200 : 180}
      style={styles.card}
    />
  );
}

export default memo(TravelCardCompact);
