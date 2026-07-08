import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import RouteBuilder from '@/components/trips/planning/RouteBuilder';
import TripRouteExportMenu from '@/components/trips/planning/TripRouteExportMenu';
import TripParticipantsList from '@/components/trips/planning/TripParticipantsList';
import TripRsvpControl from '@/components/trips/planning/TripRsvpControl';
import TripInvitePanel from '@/components/trips/planning/TripInvitePanel';
import TripSuggestPointForm from '@/components/trips/planning/TripSuggestPointForm';
import TripSuggestionsPanel from '@/components/trips/planning/TripSuggestionsPanel';
import TripReportForm from '@/components/trips/planning/TripReportForm';
import TripRatingPanel from '@/components/trips/planning/TripRatingPanel';
import TripAffiliateBlock from '@/components/trips/planning/TripAffiliateBlock';
import TripTelegramGroupCard from '@/components/trips/communication/TripTelegramGroupCard';
import TripChatPanel from '@/components/trips/chat/TripChatPanel';
import {
  PLAN_STATUS_LABEL,
  formatTripDateTime,
  planStatusColor,
} from '@/components/trips/planning/tripPlanFormatting';
import { usePlannedTrip } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

export default function PlannedTripScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id?: string }>();
  const tripId = Number(params.id);
  const { data: trip, isLoading, isError } = usePlannedTrip(
    Number.isFinite(tripId) ? tripId : null,
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : isError || !trip ? (
          <Text style={styles.error}>Не удалось загрузить поездку.</Text>
        ) : (
          <>
            <View style={styles.cover} testID="trip-plan-cover">
              <ImageCardMedia
                src={trip.coverUrl}
                alt={trip.title}
                height={220}
                fit="cover"
                blurBackground={false}
                borderRadius={12}
              />
            </View>

            <View style={styles.header}>
              <View
                style={[styles.badge, { backgroundColor: planStatusColor(trip.status, colors) }]}
              >
                <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
              </View>
              <Text style={styles.title}>{trip.title}</Text>
              <Text style={styles.meta}>
                {formatTripDateTime(trip.startDate, trip.startTime)} · {trip.organizer.name}
              </Text>
              {trip.description ? (
                <Text style={styles.description}>{trip.description}</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <RouteBuilder trip={trip} />
            </View>

            <View style={styles.section}>
              <TripRouteExportMenu trip={trip} />
            </View>

            <View style={styles.section}>
              <TripParticipantsList trip={trip} />
              <TripRsvpControl trip={trip} />
            </View>

            <View style={styles.section}>
              <TripInvitePanel trip={trip} />
            </View>

            <View style={styles.section}>
              <TripTelegramGroupCard tripId={trip.id} isOwner={trip.isOwner} />
              <TripChatPanel tripId={trip.id} />
            </View>

            <View style={styles.section}>
              <TripSuggestPointForm trip={trip} />
              <TripSuggestionsPanel trip={trip} />
            </View>

            <View style={styles.section}>
              <TripReportForm trip={trip} />
            </View>

            {trip.status === 'completed' ? (
              <View style={styles.section}>
                <TripRatingPanel trip={trip} />
              </View>
            ) : null}

            <View style={styles.section}>
              <TripAffiliateBlock trip={trip} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760, gap: 16 },
    loader: { marginVertical: 48 },
    error: { color: colors.danger, fontSize: 14, fontWeight: '600', marginVertical: 24 },
    cover: {
      overflow: 'hidden',
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    header: { gap: 6 },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    meta: { fontSize: 14, color: colors.textSecondary },
    description: { fontSize: 15, color: colors.text, lineHeight: 21, marginTop: 4 },
    section: {
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
  });
