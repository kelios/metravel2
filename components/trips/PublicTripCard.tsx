// components/trips/PublicTripCard.tsx
// Карточка публичной поездки в каталоге «Поехали со мной» (#411). Фото — через
// UnifiedTravelCard (правило проекта). Featured/boosted (#463): метка «Продвигается»
// + featured-вариант + аналитика показа/клика.
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import TripStatusBadge from '@/components/trips/TripStatusBadge';
import { tripCardMeta } from '@/components/trips/tripFormatting';
import type { PublicTrip } from '@/api/publicTrips';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackFeaturedClick, trackFeaturedImpression } from '@/utils/tripAnalytics';

interface Props {
  trip: PublicTrip;
  onPress: (trip: PublicTrip) => void;
  width?: number;
  testID?: string;
}

function PublicTripCard({ trip, onPress, width, testID }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // #463 — фиксируем показ продвигаемой карточки (раз на маунт).
  useEffect(() => {
    if (trip.featured) trackFeaturedImpression(trip.id);
  }, [trip.featured, trip.id]);

  const handlePress = () => {
    if (trip.featured) trackFeaturedClick(trip.id);
    onPress(trip);
  };

  const featuredChip = trip.featured ? (
    <View style={styles.featuredChip} testID={`${testID ?? 'trip-card'}-featured`}>
      <Feather name="zap" size={11} color={colors.textOnPrimary} />
      <Text style={styles.featuredText}>Продвигается</Text>
    </View>
  ) : null;

  return (
    <UnifiedTravelCard
      title={trip.title}
      imageUrl={trip.coverUrl}
      metaText={tripCardMeta(trip)}
      onPress={handlePress}
      width={width}
      visualVariant={trip.featured ? 'featured' : 'default'}
      rightTopSlot={featuredChip}
      rightTopSlotScrim
      bottomLeftSlot={<TripStatusBadge kind="trip" status={trip.status} />}
      bottomRightSlot={
        trip.myApplicationStatus ? (
          <TripStatusBadge kind="application" status={trip.myApplicationStatus} />
        ) : null
      }
      testID={testID ?? `trip-card-${trip.id}`}
    />
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    featuredChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    featuredText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });

export default React.memo(PublicTripCard);
