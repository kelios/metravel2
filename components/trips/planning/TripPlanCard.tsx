import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip } from '@/api/plannedTrips';
import CardActionPressable from '@/components/ui/CardActionPressable';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import {
  PLAN_STATUS_LABEL,
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatTripDateTime,
  planStatusColor,
  routeSummaryLine,
} from '@/components/trips/planning/tripPlanFormatting';
import { getTripFallbackCover } from '@/components/trips/planning/tripFallbackCover';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
  onOpenPress?: (trip: PlannedTrip) => void;
  onEditPress?: (trip: PlannedTrip) => void;
  onDeletePress?: (trip: PlannedTrip) => void;
  isDeleting?: boolean;
}

function TripPlanCard({
  trip,
  onOpenPress,
  onEditPress,
  onDeletePress,
  isDeleting = false,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const statusBg = planStatusColor(trip.status, colors);
  const participantsCount = trip.participants.length;
  const goingCount = trip.participants.filter((p) => p.rsvp === 'going').length;
  const coverUrl = typeof trip.coverUrl === 'string' ? trip.coverUrl.trim() : '';
  const fallbackCover = useMemo(
    () =>
      getTripFallbackCover({
        id: trip.id,
        startDate: trip.startDate,
        title: trip.title,
        transport: trip.transport,
        region: trip.region,
      }),
    [trip.id, trip.startDate, trip.title, trip.transport, trip.region],
  );
  const usesFallbackCover = coverUrl.length === 0;
  const cardImageUrl = usesFallbackCover ? fallbackCover.uri : coverUrl;

  const handleOpen = () => {
    if (onOpenPress) {
      onOpenPress(trip);
      return;
    }
    router.push(`/trips/plan/${trip.id}`);
  };

  const actionSlot = onEditPress || onDeletePress ? (
    <View style={styles.cardActions} testID={`trip-plan-card-actions-${trip.id}`}>
      {onEditPress ? (
        <CardActionPressable
          accessibilityLabel="Редактировать поездку"
          title="Редактировать"
          onPress={() => onEditPress(trip)}
          style={styles.cardActionButton}
          disabled={isDeleting}
          accessibilityState={{ disabled: isDeleting }}
          testID={`my-created-trip-edit-${trip.id}`}
        >
          <Feather name="edit-2" size={15} color={colors.text} />
        </CardActionPressable>
      ) : null}
      {onDeletePress ? (
        <CardActionPressable
          accessibilityLabel={isDeleting ? 'Поездка удаляется' : 'Удалить поездку'}
          title={isDeleting ? 'Удаляется...' : 'Удалить'}
          onPress={() => onDeletePress(trip)}
          style={styles.cardActionButton}
          disabled={isDeleting}
          accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
          testID={`my-created-trip-delete-${trip.id}`}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Feather name="trash-2" size={15} color={colors.danger} />
          )}
        </CardActionPressable>
      ) : null}
    </View>
  ) : null;

  const contentSlot = (
    <View style={styles.contentStack}>
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {trip.title}
      </Text>

      <View style={styles.metaRow}>
        <Feather
          name={TRANSPORT_ICON_NAME[trip.transport] as never}
          size={13}
          color={colors.textSecondary}
        />
        <Text style={styles.meta} numberOfLines={1}>
          {TRANSPORT_LABEL[trip.transport]}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatTripDateTime(trip.startDate, trip.startTime)}
        </Text>
      </View>

      <Text style={styles.route} numberOfLines={1}>
        {routeSummaryLine(trip.routeSummary)}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {participantsCount} участников · {goingCount} едут
        </Text>
      </View>
    </View>
  );

  return (
    <UnifiedTravelCard
      title={trip.title}
      imageUrl={cardImageUrl}
      onPress={handleOpen}
      mediaFit="cover"
      imageHeight={190}
      heroTitleOverlay={false}
      contentPosition="belowMedia"
      contentSlot={contentSlot}
      contentContainerStyle={styles.contentContainer}
      rightTopSlot={actionSlot}
      rightTopSlotScrim
      mediaProps={{
        optimizeWeb: !usesFallbackCover,
        placeholderSrc: usesFallbackCover ? fallbackCover.uri : undefined,
        recyclingKey: usesFallbackCover ? fallbackCover.key : coverUrl,
        showImmediately: usesFallbackCover,
        showLoadingIndicator: !usesFallbackCover,
      }}
      mediaPlaceholderSlot={<View style={styles.mediaPlaceholder} />}
      style={[styles.card, isDeleting ? styles.cardDeleting : null]}
      testID={`trip-plan-card-${trip.id}`}
      webAsView={Platform.OS === 'web'}
      webHoverScale={Platform.OS === 'web'}
    />
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 14,
    },
    cardDeleting: { opacity: 0.6 },
    contentContainer: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
    contentStack: { gap: 6 },
    headerRow: { flexDirection: 'row' },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    meta: { fontSize: 13, color: colors.textSecondary },
    metaDot: { fontSize: 13, color: colors.textMuted },
    route: { fontSize: 13, color: colors.textMuted },
    footer: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: colors.text },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(15, 23, 42, 0.14)' as any },
      }),
    },
    cardActionButton: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    mediaPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceMuted,
    },
  });

export default React.memo(TripPlanCard);
