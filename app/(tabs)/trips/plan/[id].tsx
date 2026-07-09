import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import RouteBuilder from '@/components/trips/planning/RouteBuilder';
import TripRouteExportMenu, {
  shouldRenderTripRouteExportMenu,
} from '@/components/trips/planning/TripRouteExportMenu';
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
import TripPlanLinkedText from '@/components/trips/planning/TripPlanLinkedText';
import {
  PLAN_STATUS_LABEL,
  formatTripDateTime,
  planStatusColor,
} from '@/components/trips/planning/tripPlanFormatting';
import { useDeletePlannedTrip, usePlannedTrip } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { LAYOUT } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Reserve space for the bottom tab bar / web dock so the route builder and
// bottom controls are never hidden behind it.
const SCROLL_BOTTOM_RESERVE = Platform.select({
  web: 'calc(var(--mt-dock-h, 0px) + 24px)' as unknown as number,
  default: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
});

export default function PlannedTripScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showRouteExportMenu = shouldRenderTripRouteExportMenu(Platform.OS);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const tripId = Number(params.id);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: trip, isLoading, isError } = usePlannedTrip(
    Number.isFinite(tripId) ? tripId : null,
  );
  const deleteTrip = useDeletePlannedTrip();

  const handleDelete = () => {
    if (!trip) return;
    setDeleteError(null);
    deleteTrip.mutate(trip.id, {
      onSuccess: () => {
        setDeleteConfirmVisible(false);
        router.replace('/trips/my');
      },
      onError: () => {
        setDeleteError('Не удалось удалить поездку. Попробуйте ещё раз позже.');
      },
    });
  };

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
                <TripPlanLinkedText
                  text={trip.description}
                  style={styles.description}
                  linkStyle={styles.descriptionLink}
                  testID="trip-plan-description"
                />
              ) : null}
              {trip.isOwner ? (
                <View style={styles.ownerActions}>
                  <Button
                    label="Удалить поездку"
                    variant="danger"
                    size="sm"
                    onPress={() => setDeleteConfirmVisible(true)}
                    loading={deleteTrip.isPending}
                    disabled={deleteTrip.isPending}
                    icon={<Feather name="trash-2" size={15} color={colors.textOnPrimary} />}
                    testID="trip-plan-delete"
                  />
                  {deleteError ? (
                    <Text style={styles.deleteError} testID="trip-plan-delete-error">
                      {deleteError}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <RouteBuilder trip={trip} />
            </View>

            {showRouteExportMenu ? (
              <View style={styles.section} testID="trip-plan-route-export-section">
                <TripRouteExportMenu trip={trip} />
              </View>
            ) : null}

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

            <ConfirmDialog
              visible={deleteConfirmVisible}
              onClose={() => setDeleteConfirmVisible(false)}
              onConfirm={handleDelete}
              title="Удалить поездку?"
              message="Поездка исчезнет из каталога и ваших созданных поездок. Действие нельзя отменить."
              confirmText="Удалить"
              cancelText="Оставить"
              confirmTestID="trip-plan-delete-confirm"
              cancelTestID="trip-plan-delete-cancel"
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: SCROLL_BOTTOM_RESERVE,
      alignItems: 'center',
    },
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
    descriptionLink: { color: colors.primaryDark, fontWeight: '700' },
    ownerActions: {
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 8,
    },
    deleteError: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: '600' },
    section: {
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
  });
