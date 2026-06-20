// components/trips/TripStatusBadge.tsx
// Визуальный индикатор статуса заявки участника (#414) или статуса поездки.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ApplicationStatus, PublicTripStatus } from '@/api/publicTrips';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import {
  APPLICATION_STATUS_LABEL,
  TRIP_STATUS_LABEL,
  applicationStatusColor,
  tripStatusColor,
} from '@/components/trips/tripFormatting';

type Props =
  | { kind: 'application'; status: ApplicationStatus; testID?: string }
  | { kind: 'trip'; status: PublicTripStatus; testID?: string };

function TripStatusBadge(props: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { label, color } =
    props.kind === 'application'
      ? {
          label: APPLICATION_STATUS_LABEL[props.status],
          color: applicationStatusColor(props.status, colors),
        }
      : {
          label: TRIP_STATUS_LABEL[props.status],
          color: tripStatusColor(props.status, colors),
        };

  return (
    <View
      style={[styles.badge, { borderColor: color }]}
      accessibilityRole="text"
      accessibilityLabel={`Статус: ${label}`}
      testID={props.testID}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: colors.surface,
      alignSelf: 'flex-start',
    },
    dot: { width: 7, height: 7, borderRadius: 999 },
    label: { fontSize: 12, fontWeight: '600' },
  });

export default React.memo(TripStatusBadge);
