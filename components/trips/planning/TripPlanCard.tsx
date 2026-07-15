import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip } from '@/api/plannedTrips';
import CardActionPressable from '@/components/ui/CardActionPressable';
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import {
  PLAN_STATUS_LABEL,
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  VISIBILITY_LABEL,
  formatTripDateTime,
  planStatusColor,
  routeSummaryLine,
} from '@/components/trips/planning/tripPlanFormatting';
import { getTripFallbackCover } from '@/components/trips/planning/tripFallbackCover';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


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
  const [actionsVisible, setActionsVisible] = useState(false);

  const statusBg = planStatusColor(trip.status, colors);
  const participantsCount = Math.max(trip.participants.length, trip.isOwner ? 1 : 0);
  const goingCount = Math.max(
    trip.participants.filter((p) => p.rsvp === 'going').length,
    trip.isOwner ? 1 : 0,
  );
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
  const hasOwnerActions = Boolean(onEditPress || onDeletePress);

  const handleOpen = () => {
    if (onOpenPress) {
      onOpenPress(trip);
      return;
    }
    router.push(`/trips/plan/${trip.id}`);
  };

  const ownerActions = useMemo<ActionListSheetItem[]>(() => {
    const actions: ActionListSheetItem[] = [];
    if (onEditPress) {
      actions.push({
        key: 'edit',
        label: i18nT('trips:components.trips.planning.TripPlanCard.redaktirovat_poezdku_548d7f17'),
        icon: 'edit-2',
        onPress: () => {
          setActionsVisible(false);
          onEditPress(trip);
        },
      });
    }
    if (onDeletePress) {
      actions.push({
        key: 'delete',
        label: i18nT('trips:components.trips.planning.TripPlanCard.udalit_poezdku_33c7dfe4'),
        icon: 'trash-2',
        iconColor: colors.danger,
        onPress: () => {
          setActionsVisible(false);
          onDeletePress(trip);
        },
      });
    }
    return actions;
  }, [colors.danger, onDeletePress, onEditPress, trip]);

  const contentSlot = (
    <View style={styles.contentStack}>
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
        </View>
        <View style={styles.visibilityBadge}>
          <Feather name="eye" size={12} color={colors.textSecondary} />
          <Text style={styles.visibilityText}>{VISIBILITY_LABEL[trip.visibility]}</Text>
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
        <View style={styles.occupancyRow}>
          <Feather name="users" size={14} color={colors.textSecondary} />
          <Text style={styles.footerText}>{i18nT('trips:components.trips.planning.TripPlanCard.edut_f472215c')}{goingCount} {i18nT('trips:components.trips.planning.TripPlanCard.iz_b3249d51')}{trip.seatsTotal}</Text>
          <Text style={styles.participantsHint}>· {participantsCount} {i18nT('trips:components.trips.planning.TripPlanCard.v_spiske_e0d50d93')}</Text>
        </View>
        <View style={styles.cardActions} testID={`trip-plan-card-actions-${trip.id}`}>
          <CardActionPressable
            accessibilityLabel={hasOwnerActions ? i18nT('trips:components.trips.planning.TripPlanCard.upravlyat_poezdkoy_80d7b0d2') : i18nT('trips:components.trips.planning.TripPlanCard.otkryt_poezdku_4ed54163')}
            title={hasOwnerActions ? i18nT('trips:components.trips.planning.TripPlanCard.upravlyat_poezdkoy_80d7b0d2') : i18nT('trips:components.trips.planning.TripPlanCard.otkryt_poezdku_4ed54163')}
            onPress={handleOpen}
            style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}
            disabled={isDeleting}
            testID={`trip-plan-card-manage-${trip.id}`}
          >
            <Text style={styles.manageButtonText}>
              {hasOwnerActions ? i18nT('trips:components.trips.planning.TripPlanCard.upravlyat_poezdkoy_80d7b0d2') : i18nT('trips:components.trips.planning.TripPlanCard.otkryt_poezdku_4ed54163')}
            </Text>
            <Feather name="arrow-right" size={15} color={colors.textOnPrimary} />
          </CardActionPressable>
          {hasOwnerActions ? (
            <CardActionPressable
              accessibilityLabel={i18nT('trips:components.trips.planning.TripPlanCard.drugie_deystviya_s_poezdkoy_9a8b5df9')}
              title={i18nT('trips:components.trips.planning.TripPlanCard.drugie_deystviya_4b60e2d6')}
              onPress={() => setActionsVisible(true)}
              style={styles.moreButton}
              disabled={isDeleting}
              accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
              testID={`trip-plan-card-more-${trip.id}`}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Feather name="more-horizontal" size={19} color={colors.text} />
              )}
            </CardActionPressable>
          ) : null}
        </View>
        {hasOwnerActions ? (
          <ActionListSheet
            visible={actionsVisible}
            onClose={() => setActionsVisible(false)}
            title={trip.title}
            actions={ownerActions}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <UnifiedTravelCard
      title={trip.title}
      imageUrl={cardImageUrl}
      onPress={handleOpen}
      mediaFit="cover"
      imageHeight={176}
      heroTitleOverlay={false}
      contentPosition="belowMedia"
      contentSlot={contentSlot}
      contentContainerStyle={styles.contentContainer}
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
    headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
    visibilityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    visibilityText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
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
    occupancyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
    footerText: { fontSize: 13, fontWeight: '700', color: colors.text },
    participantsHint: { fontSize: 12, color: colors.textMuted },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    manageButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
    },
    manageButtonPressed: { opacity: 0.86 },
    manageButtonText: { fontSize: 14, fontWeight: '800', color: colors.textOnPrimary },
    moreButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mediaPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceMuted,
    },
  });

export default React.memo(TripPlanCard);
