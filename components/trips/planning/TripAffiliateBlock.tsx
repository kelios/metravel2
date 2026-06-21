// components/trips/planning/TripAffiliateBlock.tsx
// Партнёрский блок на странице поездки (FE-trip-monetization #460): подборка
// предложений (жильё/активности) с трекингом кликов в воронку аналитики.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import AffiliateOffers from '@/components/affiliate/AffiliateOffers';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackTripAffiliateClick } from '@/utils/tripAnalytics';

interface Props {
  trip: PlannedTrip;
}

function TripAffiliateBlock({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap} testID="trip-affiliate">
      <Text style={styles.heading}>Где остановиться и что посмотреть</Text>
      <AffiliateOffers
        city={trip.region || undefined}
        onOfferClick={(key) => trackTripAffiliateClick(trip.id, key)}
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  });

export default React.memo(TripAffiliateBlock);
