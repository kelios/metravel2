import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
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
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  VISIBILITY_LABEL,
  formatTripDateTime,
  planStatusColor,
} from '@/components/trips/planning/tripPlanFormatting';
import { getTripFallbackCover } from '@/components/trips/planning/tripFallbackCover';
import { useDeletePlannedTrip, usePlannedTrip, useUpdatePlannedTrip } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { LAYOUT } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { PlannedTrip, TripTransport, TripVisibility } from '@/api/plannedTrips';

// Reserve space for the bottom tab bar / web dock so the route builder and
// bottom controls are never hidden behind it.
const SCROLL_BOTTOM_RESERVE = Platform.select({
  web: 'calc(var(--mt-dock-h, 0px) + 24px)' as unknown as number,
  default: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
});

const TRANSPORT_OPTIONS: TripTransport[] = ['car', 'bike', 'foot', 'public', 'mixed'];
const VISIBILITY_OPTIONS: TripVisibility[] = ['public', 'followers', 'private'];

const toDateInputValue = (value: string): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
};

const initialEditValues = (trip: PlannedTrip) => ({
  title: trip.title,
  description: trip.description,
  coverUrl: trip.coverUrl ?? '',
  startDate: toDateInputValue(trip.startDate),
  startTime: trip.startTime ?? '',
  transport: trip.transport,
  visibility: trip.visibility,
  seatsTotal: String(trip.seatsTotal || 1),
});

export default function PlannedTripScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webDateInputStyle = useMemo<CSSProperties>(
    () => ({
      width: '100%',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      borderRadius: 12,
      padding: '10px 12px',
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      lineHeight: '20px',
      outline: 'none',
      boxSizing: 'border-box',
    }),
    [colors],
  );
  const showRouteExportMenu = shouldRenderTripRouteExportMenu(Platform.OS);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; edit?: string }>();
  const tripId = Number(params.id);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ReturnType<typeof initialEditValues> | null>(null);
  const { data: trip, isLoading, isError } = usePlannedTrip(
    Number.isFinite(tripId) ? tripId : null,
  );
  const deleteTrip = useDeletePlannedTrip();
  const updateTrip = useUpdatePlannedTrip();
  const fallbackCover = trip
    ? getTripFallbackCover({
        id: trip.id,
        startDate: trip.startDate,
        title: trip.title,
        transport: trip.transport,
        region: trip.region,
      })
    : null;
  const coverUrl = typeof trip?.coverUrl === 'string' ? trip.coverUrl.trim() : '';
  const usesFallbackCover = Boolean(trip && coverUrl.length === 0);
  const displayCoverUrl = usesFallbackCover ? (fallbackCover?.uri ?? '') : coverUrl;

  useEffect(() => {
    if (trip) setEditValues(initialEditValues(trip));
  }, [trip]);

  useEffect(() => {
    if (trip && params.edit === '1') {
      setEditError(null);
      setIsEditing(true);
    }
  }, [params.edit, trip]);

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

  const handleStartEdit = () => {
    if (trip) setEditValues(initialEditValues(trip));
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (trip) setEditValues(initialEditValues(trip));
    setEditError(null);
    setIsEditing(false);
  };

  const handleSaveDetails = () => {
    if (!trip || !editValues) return;
    const title = editValues.title.trim();
    const startDate = editValues.startDate.trim();
    const seatsTotal = Number(editValues.seatsTotal);

    if (title.length < 3) {
      setEditError('Название должно быть не короче 3 символов.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setEditError('Дата должна быть в формате ГГГГ-ММ-ДД.');
      return;
    }
    if (editValues.startTime.trim() && !/^\d{2}:\d{2}$/.test(editValues.startTime.trim())) {
      setEditError('Время должно быть в формате ЧЧ:ММ.');
      return;
    }
    if (!Number.isInteger(seatsTotal) || seatsTotal < 1 || seatsTotal > 50) {
      setEditError('Укажите от 1 до 50 мест.');
      return;
    }

    setEditError(null);
    updateTrip.mutate(
      {
        tripId: trip.id,
        title,
        description: editValues.description.trim(),
        startDate,
        startTime: editValues.startTime.trim() || null,
        transport: editValues.transport,
        visibility: editValues.visibility,
        seatsTotal,
        coverUrl: editValues.coverUrl.trim() || null,
      },
      {
        onSuccess: (updatedTrip) => {
          setEditValues(initialEditValues(updatedTrip));
          setIsEditing(false);
        },
        onError: () => {
          setEditError('Не удалось сохранить изменения. Попробуйте ещё раз позже.');
        },
      },
    );
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
                src={displayCoverUrl}
                alt={trip.title}
                height={220}
                fit="cover"
                blurBackground={false}
                borderRadius={12}
                optimizeWeb={!usesFallbackCover}
                placeholderSrc={usesFallbackCover ? fallbackCover?.uri : undefined}
                recyclingKey={usesFallbackCover ? fallbackCover?.key : displayCoverUrl}
                showImmediately={usesFallbackCover}
                showLoadingIndicator={!usesFallbackCover}
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
                    label="Редактировать поездку"
                    variant="secondary"
                    size="sm"
                    onPress={handleStartEdit}
                    icon={<Feather name="edit-2" size={15} color={colors.primaryDark} />}
                    testID="trip-plan-edit"
                  />
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

            {trip.isOwner && isEditing && editValues ? (
              <View style={styles.editPanel} testID="trip-plan-edit-panel">
                <Text style={styles.editHeading}>Редактировать поездку</Text>

                <Text style={styles.label}>Название</Text>
                <TextInput
                  value={editValues.title}
                  onChangeText={(title) => setEditValues((prev) => prev ? { ...prev, title } : prev)}
                  placeholder="Название поездки"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  testID="trip-plan-edit-title"
                />

                <Text style={styles.label}>Описание</Text>
                <TextInput
                  value={editValues.description}
                  onChangeText={(description) => setEditValues((prev) => prev ? { ...prev, description } : prev)}
                  placeholder="Описание поездки, ссылки, детали для участников"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.textArea}
                  testID="trip-plan-edit-description"
                />

                <Text style={styles.label}>Обложка</Text>
                <View style={styles.coverUpload} testID="trip-plan-edit-cover">
                  <PhotoUploadWithPreview
                    collection="plannedTripCover"
                    idTravel={String(trip.id)}
                    oldImage={editValues.coverUrl || null}
                    onUpload={(coverUrl) =>
                      setEditValues((prev) => (prev ? { ...prev, coverUrl } : prev))
                    }
                    onRequestRemove={() =>
                      setEditValues((prev) => (prev ? { ...prev, coverUrl: '' } : prev))
                    }
                    placeholder="Перетащите фото обложки"
                    maxSizeMB={10}
                    disabled={updateTrip.isPending}
                  />
                  <Text style={styles.coverUploadHint}>
                    Фото будет прикреплено к поездке после загрузки и сохранения изменений.
                  </Text>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.label}>Дата</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={editValues.startDate}
                        onChange={(event) => setEditValues((prev) => prev ? { ...prev, startDate: event.currentTarget.value } : prev)}
                        aria-label="Дата поездки"
                        data-testid="trip-plan-edit-start-date"
                        style={webDateInputStyle}
                      />
                    ) : (
                      <TextInput
                        value={editValues.startDate}
                        onChangeText={(startDate) => setEditValues((prev) => prev ? { ...prev, startDate } : prev)}
                        placeholder="ГГГГ-ММ-ДД"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        testID="trip-plan-edit-start-date"
                      />
                    )}
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.label}>Время</Text>
                    <TextInput
                      value={editValues.startTime}
                      onChangeText={(startTime) => setEditValues((prev) => prev ? { ...prev, startTime } : prev)}
                      placeholder="08:00"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      style={styles.input}
                      testID="trip-plan-edit-start-time"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Транспорт</Text>
                <View style={styles.optionRow}>
                  {TRANSPORT_OPTIONS.map((option) => {
                    const active = editValues.transport === option;
                    return (
                      <Button
                        key={option}
                        label={TRANSPORT_LABEL[option]}
                        variant={active ? 'primary' : 'secondary'}
                        size="sm"
                        onPress={() => setEditValues((prev) => prev ? { ...prev, transport: option } : prev)}
                        icon={
                          <Feather
                            name={TRANSPORT_ICON_NAME[option] as never}
                            size={14}
                            color={active ? colors.textOnPrimary : colors.primaryDark}
                          />
                        }
                        testID={`trip-plan-edit-transport-${option}`}
                      />
                    );
                  })}
                </View>

                <Text style={styles.label}>Видимость</Text>
                <View style={styles.optionRow}>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      label={VISIBILITY_LABEL[option]}
                      variant={editValues.visibility === option ? 'primary' : 'secondary'}
                      size="sm"
                      onPress={() => setEditValues((prev) => prev ? { ...prev, visibility: option } : prev)}
                      testID={`trip-plan-edit-visibility-${option}`}
                    />
                  ))}
                </View>

                <Text style={styles.label}>Мест</Text>
                <TextInput
                  value={editValues.seatsTotal}
                  onChangeText={(seatsTotal) => setEditValues((prev) => prev ? { ...prev, seatsTotal: seatsTotal.replace(/[^0-9]/g, '') } : prev)}
                  placeholder="4"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.input}
                  testID="trip-plan-edit-seats"
                />

                {editError ? (
                  <Text style={styles.editError} testID="trip-plan-edit-error">
                    {editError}
                  </Text>
                ) : null}

                <View style={styles.editActions}>
                  <Button
                    label="Сохранить изменения"
                    onPress={handleSaveDetails}
                    loading={updateTrip.isPending}
                    disabled={updateTrip.isPending}
                    size="sm"
                    testID="trip-plan-edit-save"
                  />
                  <Button
                    label="Отмена"
                    onPress={handleCancelEdit}
                    variant="ghost"
                    size="sm"
                    disabled={updateTrip.isPending}
                    testID="trip-plan-edit-cancel"
                  />
                </View>
              </View>
            ) : null}

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
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    deleteError: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: '600' },
    editPanel: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    editHeading: { fontSize: 18, fontWeight: '800', color: colors.text },
    label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      minHeight: 110,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    coverUpload: { gap: 6 },
    coverUploadHint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
    formRow: { flexDirection: 'row', gap: 10 },
    formCol: { flex: 1, gap: 6 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    editError: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: '600' },
    section: {
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
  });
