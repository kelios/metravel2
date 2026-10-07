import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip } from '@/api/plannedTrips';
import MapIcon from '@/components/MapPage/MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import {
  PLAN_STATUS_LABEL,
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  VISIBILITY_ICON_NAME,
  VISIBILITY_LABEL,
  formatTripDateTime,
  planStatusColor,
  routeSummaryLine,
} from '@/components/trips/planning/tripPlanFormatting';
import { createTripPlanCardStyles, TRIP_PLAN_CARD_MEDIA_HEIGHT } from './TripPlanCard.styles';
import { getTripFallbackCover } from '@/components/trips/planning/tripFallbackCover';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT, translatePlural } from '@/i18n'


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
  const styles = useMemo(() => createTripPlanCardStyles(colors), [colors]);
  const router = useRouter();

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

  const contentSlot = (
    <View style={styles.contentStack}>
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
        </View>
        <View style={styles.visibilityBadge}>
          <Feather
            name={VISIBILITY_ICON_NAME[trip.visibility] as never}
            size={12}
            color={colors.textSecondary}
          />
          <Text style={styles.visibilityText}>{VISIBILITY_LABEL[trip.visibility]}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {trip.title}
      </Text>

      <View style={styles.metaRow}>
        <MapIcon
          name={TRANSPORT_ICON_NAME[trip.transport]}
          size={13}
          color={colors.textSecondary}
        />
        <Text style={styles.meta}>
          {`${TRANSPORT_LABEL[trip.transport]} · ${formatTripDateTime(trip.startDate, trip.startTime, trip.endDate)}`}
        </Text>
      </View>

      {/* #2056: с переездами строка длиннее — две строки вместо обрезки. */}
      <Text style={styles.route} numberOfLines={2}>
        {routeSummaryLine(trip.routeSummary)}
      </Text>

      <View style={styles.footer}>
        <View style={styles.occupancyRow}>
          <Feather name="users" size={14} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            {translatePlural('tripsStatic:plan.card.goingSeats', goingCount, {
              seats: trip.seatsTotal,
            })}
          </Text>
          <Text style={styles.participantsHint}>
            {`· ${i18nT('tripsStatic:plan.card.inList', { people: participantsCount })}`}
          </Text>
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
            <Text style={styles.manageButtonText} numberOfLines={1}>
              {hasOwnerActions ? i18nT('trips:components.trips.planning.TripPlanCard.upravlyat_poezdkoy_80d7b0d2') : i18nT('trips:components.trips.planning.TripPlanCard.otkryt_poezdku_4ed54163')}
            </Text>
            <Feather name="arrow-right" size={15} color={colors.textOnPrimary} />
          </CardActionPressable>
          {onEditPress ? (
            <CardActionPressable
              accessibilityLabel={i18nT('trips:components.trips.planning.TripPlanCard.redaktirovat_poezdku_548d7f17')}
              title={i18nT('trips:components.trips.planning.TripPlanCard.redaktirovat_poezdku_548d7f17')}
              onPress={() => onEditPress(trip)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              disabled={isDeleting}
              testID={`trip-plan-card-edit-${trip.id}`}
            >
              <Feather name="edit-2" size={18} color={colors.text} />
            </CardActionPressable>
          ) : null}
          {onDeletePress ? (
            <CardActionPressable
              accessibilityLabel={i18nT('trips:components.trips.planning.TripPlanCard.udalit_poezdku_33c7dfe4')}
              title={i18nT('trips:components.trips.planning.TripPlanCard.udalit_poezdku_33c7dfe4')}
              onPress={() => onDeletePress(trip)}
              style={({ pressed }) => [
                styles.iconButton,
                styles.iconButtonDanger,
                pressed && styles.iconButtonPressed,
              ]}
              disabled={isDeleting}
              accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
              testID={`trip-plan-card-delete-${trip.id}`}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Feather name="trash-2" size={18} color={colors.danger} />
              )}
            </CardActionPressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <UnifiedTravelCard
      title={trip.title}
      imageUrl={cardImageUrl}
      onPress={handleOpen}
      mediaFit="cover"
      imageHeight={TRIP_PLAN_CARD_MEDIA_HEIGHT}
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


export default React.memo(TripPlanCard);
