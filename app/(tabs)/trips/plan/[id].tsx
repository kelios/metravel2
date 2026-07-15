import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import MiniCalendar from '@/components/calendar/MiniCalendar';
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
  formatTripDisplayDate,
  formatTripDateTime,
  isRouteApproximate,
  planStatusColor,
  routeSummaryLine,
  routingStateHint,
} from '@/components/trips/planning/tripPlanFormatting';
import { getTripFallbackCover } from '@/components/trips/planning/tripFallbackCover';
import { useDeletePlannedTrip, usePlannedTrip, useUpdatePlannedTrip } from '@/hooks/usePlannedTripsApi';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { PlannedTrip, TripTransport, TripVisibility } from '@/api/plannedTrips';
import { translate as i18nT } from '@/i18n'
import { createStyles } from '@/components/trips/planning/plannedTripScreen.styles';


const TRANSPORT_OPTIONS: TripTransport[] = ['car', 'bike', 'foot', 'public', 'mixed'];
// БЭК хранит только is_public (PlannedTripUpdateSerializer): 'followers' молча
// деградировал в «Личная» — не предлагаем, пока бэк не поддержит уровень.
const VISIBILITY_OPTIONS: TripVisibility[] = ['public', 'private'];

type PlannerTabKey = 'route' | 'people' | 'export' | 'more';

interface PlannerTab {
  key: PlannerTabKey;
  label: string;
  icon: string;
}

const PLANNER_TABS: PlannerTab[] = [
  { key: 'route', get label() { return i18nT('tripsStatic:app.tabs.trips.plan.id.marshrut_52518f7d') }, icon: 'map' },
  { key: 'people', get label() { return i18nT('tripsStatic:app.tabs.trips.plan.id.lyudi_ecd00897') }, icon: 'users' },
  { key: 'export', get label() { return i18nT('tripsStatic:app.tabs.trips.plan.id.eksport_89eec9f8') }, icon: 'download' },
  { key: 'more', get label() { return i18nT('tripsStatic:app.tabs.trips.plan.id.esche_1eb0a8cd') }, icon: 'more-horizontal' },
];

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
  const { isMobile } = useResponsive();
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile]);
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
  const [editDatePickerVisible, setEditDatePickerVisible] = useState(false);
  const [coverUploadPending, setCoverUploadPending] = useState(false);
  const [activeTab, setActiveTab] = useState<PlannerTabKey>('route');
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

  const summaryLine = trip ? routeSummaryLine(trip.routeSummary) : '';
  const routeApproximate = trip ? isRouteApproximate(trip.routingState) : false;

  useEffect(() => {
    // Не сбрасывать значения при фоновых рефетчах открытой формы —
    // иначе refetchOnWindowFocus стирает несохранённый ввод.
    if (trip && !isEditing) setEditValues(initialEditValues(trip));
  }, [trip, isEditing]);

  const editDeeplinkConsumedRef = useRef(false);
  useEffect(() => {
    // Deeplink ?edit=1 открывает панель один раз: без ref каждый рефетч trip
    // заново включал isEditing — панель «не закрывалась» после сохранения.
    if (trip && params.edit === '1' && !editDeeplinkConsumedRef.current) {
      editDeeplinkConsumedRef.current = true;
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
        setDeleteError(i18nT('trips:app.tabs.trips.plan.id.ne_udalos_udalit_poezdku_poprobuyte_esche_ra_e7ed9e56'));
      },
    });
  };

  const handleStartEdit = () => {
    if (trip) setEditValues(initialEditValues(trip));
    setEditError(null);
    setCoverUploadPending(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (trip) setEditValues(initialEditValues(trip));
    setEditError(null);
    setEditDatePickerVisible(false);
    setCoverUploadPending(false);
    setIsEditing(false);
  };

  const handleEditStartDateSelect = (startDate: string) => {
    setEditValues((prev) => (prev ? { ...prev, startDate } : prev));
    setEditDatePickerVisible(false);
  };

  const handleSaveDetails = () => {
    if (!trip || !editValues || coverUploadPending) return;
    const title = editValues.title.trim();
    const startDate = editValues.startDate.trim();
    const seatsTotal = Number(editValues.seatsTotal);

    if (title.length < 3) {
      setEditError(i18nT('trips:app.tabs.trips.plan.id.nazvanie_dolzhno_byt_ne_koroche_3_simvolov_7818255f'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setEditError(i18nT('trips:app.tabs.trips.plan.id.data_dolzhna_byt_v_formate_gggg_mm_dd_e9eabe4e'));
      return;
    }
    if (editValues.startTime.trim() && !/^\d{2}:\d{2}$/.test(editValues.startTime.trim())) {
      setEditError(i18nT('trips:app.tabs.trips.plan.id.vremya_dolzhno_byt_v_formate_chch_mm_145c0e0b'));
      return;
    }
    if (!Number.isInteger(seatsTotal) || seatsTotal < 1 || seatsTotal > 50) {
      setEditError(i18nT('trips:app.tabs.trips.plan.id.ukazhite_ot_1_do_50_mest_b503c700'));
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
          setEditDatePickerVisible(false);
          setIsEditing(false);
        },
        onError: () => {
          setEditError(i18nT('trips:app.tabs.trips.plan.id.ne_udalos_sohranit_izmeneniya_poprobuyte_esc_2fe4ab76'));
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
          <Text style={styles.error}>{i18nT('trips:app.tabs.trips.plan.id.ne_udalos_zagruzit_poezdku_b321e113')}</Text>
        ) : (
          <>
            {/* ── Compact header: identity + route status at a glance ── */}
            <View style={styles.cover} testID="trip-plan-cover">
              <ImageCardMedia
                src={displayCoverUrl}
                alt={trip.title}
                height={isMobile ? 132 : 188}
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
              <View style={styles.badgeRow}>
                <View
                  style={[styles.badge, { backgroundColor: planStatusColor(trip.status, colors) }]}
                >
                  <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Feather
                    name={TRANSPORT_ICON_NAME[trip.transport] as never}
                    size={12}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaChipText}>{TRANSPORT_LABEL[trip.transport]}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Feather name="eye" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaChipText}>{VISIBILITY_LABEL[trip.visibility]}</Text>
                </View>
              </View>

              <Text style={styles.title}>{trip.title}</Text>
              <Text style={styles.meta}>
                {formatTripDateTime(trip.startDate, trip.startTime)} · {trip.organizer.name}
              </Text>

              <View
                style={[styles.summaryPill, routeApproximate && styles.summaryPillWarning]}
                testID="trip-plan-summary"
              >
                <Feather
                  name={routeApproximate ? 'alert-triangle' : 'navigation'}
                  size={13}
                  color={routeApproximate ? colors.warningDark : colors.primaryDark}
                />
                <Text
                  style={[styles.summaryPillText, routeApproximate && styles.summaryPillTextWarning]}
                  numberOfLines={1}
                >
                  {summaryLine}
                </Text>
              </View>

              {routeApproximate ? (
                <Text style={styles.approximateNote} testID="trip-plan-route-approximate">
                  {routingStateHint(trip.routingState) ??
                    i18nT('tripsStatic:route.approximateWarning')}
                </Text>
              ) : null}

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
                    label={i18nT('trips:app.tabs.trips.plan.id.redaktirovat_poezdku_535ddda6')}
                    variant="secondary"
                    size="sm"
                    onPress={handleStartEdit}
                    icon={<Feather name="edit-2" size={15} color={colors.primaryDark} />}
                    testID="trip-plan-edit"
                  />
                  <Button
                    label={i18nT('trips:app.tabs.trips.plan.id.udalit_poezdku_32f59a60')}
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

            {/* Owner-only metadata editor. It also opens from the ?edit=1 deeplink. */}
            {trip.isOwner && isEditing && editValues ? (
              <View style={styles.editPanel} testID="trip-plan-edit-panel">
                <Text style={styles.editHeading}>{i18nT('trips:app.tabs.trips.plan.id.redaktirovat_poezdku_535ddda6')}</Text>

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.nazvanie_f2800d8b')}</Text>
                <TextInput
                  value={editValues.title}
                  onChangeText={(title) => setEditValues((prev) => prev ? { ...prev, title } : prev)}
                  placeholder={i18nT('trips:app.tabs.trips.plan.id.nazvanie_poezdki_859baf33')}
                  placeholderTextColor={colors.textMuted}
                  editable={!updateTrip.isPending}
                  style={styles.input}
                  testID="trip-plan-edit-title"
                />

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.opisanie_c32c01de')}</Text>
                <TextInput
                  value={editValues.description}
                  onChangeText={(description) => setEditValues((prev) => prev ? { ...prev, description } : prev)}
                  placeholder={i18nT('trips:app.tabs.trips.plan.id.opisanie_poezdki_ssylki_detali_dlya_uchastni_e1269600')}
                  placeholderTextColor={colors.textMuted}
                  editable={!updateTrip.isPending}
                  multiline
                  style={styles.textArea}
                  testID="trip-plan-edit-description"
                />

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.oblozhka_6b408e05')}</Text>
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
                    onUploadStateChange={setCoverUploadPending}
                    placeholder={i18nT('trips:app.tabs.trips.plan.id.peretaschite_foto_oblozhki_2f8bb316')}
                    maxSizeMB={10}
                    disabled={updateTrip.isPending}
                  />
                  <Text style={styles.coverUploadHint}>
                    {i18nT('trips:app.tabs.trips.plan.id.foto_budet_prikrepleno_k_poezdke_posle_zagru_1d3589b9')}</Text>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.data_efe4aaba')}</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={editValues.startDate}
                        onChange={(event) => setEditValues((prev) => prev ? { ...prev, startDate: event.currentTarget.value } : prev)}
                        aria-label={i18nT('trips:app.tabs.trips.plan.id.data_poezdki_d9833760')}
                        data-testid="trip-plan-edit-start-date"
                        disabled={updateTrip.isPending}
                        style={webDateInputStyle}
                      />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setEditDatePickerVisible(true)}
                          disabled={updateTrip.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={i18nT('trips:app.tabs.trips.plan.id.vybrat_datu_poezdki_3861ee98')}
                          accessibilityHint={i18nT('trips:app.tabs.trips.plan.id.otkroet_kalendar_vybora_daty_b8c5a057')}
                          style={[styles.datePickerTrigger, globalFocusStyles.focusable]}
                          testID="trip-plan-edit-start-date"
                        >
                          <Feather name="calendar" size={16} color={colors.primary} />
                          <Text
                            style={styles.datePickerText}
                            numberOfLines={1}
                            testID="trip-plan-edit-start-date-value"
                          >
                            {formatTripDisplayDate(editValues.startDate)}
                          </Text>
                        </Pressable>
                        <Modal
                          visible={editDatePickerVisible}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setEditDatePickerVisible(false)}
                          statusBarTranslucent
                        >
                          <Pressable
                            style={styles.datePickerOverlay}
                            onPress={() => setEditDatePickerVisible(false)}
                            testID="trip-plan-edit-date-picker-backdrop"
                          >
                            <Pressable
                              style={styles.datePickerSheet}
                              onPress={() => undefined}
                              testID="trip-plan-edit-date-picker"
                            >
                              <View style={styles.datePickerHeader}>
                                <View style={styles.datePickerTitleRow}>
                                  <Feather name="calendar" size={18} color={colors.primary} />
                                  <Text style={styles.datePickerTitle}>{i18nT('trips:app.tabs.trips.plan.id.data_poezdki_d9833760')}</Text>
                                </View>
                                <Text style={styles.datePickerHint}>
                                  {i18nT('trips:app.tabs.trips.plan.id.vyberite_den_v_kalendare_otmena_ne_izmenit_t_6991c409')}</Text>
                              </View>
                              <View style={styles.datePickerCalendar}>
                                <MiniCalendar
                                  entries={[]}
                                  selectedDate={editValues.startDate || null}
                                  focusDate={editValues.startDate || undefined}
                                  onDayPress={handleEditStartDateSelect}
                                  accentColor={colors.primary}
                                  accentSoftColor={colors.primaryLight}
                                />
                              </View>
                              <Button
                                label={i18nT('trips:app.tabs.trips.plan.id.otmena_66379efd')}
                                onPress={() => setEditDatePickerVisible(false)}
                                variant="secondary"
                                fullWidth
                                testID="trip-plan-edit-start-date-cancel"
                              />
                            </Pressable>
                          </Pressable>
                        </Modal>
                      </>
                    )}
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.vremya_a8a7d6ef')}</Text>
                    <TextInput
                      value={editValues.startTime}
                      onChangeText={(startTime) => setEditValues((prev) => prev ? { ...prev, startTime } : prev)}
                      placeholder="08:00"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      editable={!updateTrip.isPending}
                      style={styles.input}
                      testID="trip-plan-edit-start-time"
                    />
                  </View>
                </View>

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.transport_dd5df49c')}</Text>
                <View style={styles.optionRow}>
                  {TRANSPORT_OPTIONS.map((option) => {
                    const active = editValues.transport === option;
                    return (
                      <Button
                        key={option}
                        label={TRANSPORT_LABEL[option]}
                        variant={active ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={updateTrip.isPending}
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

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.vidimost_bf1dd24d')}</Text>
                <View style={styles.optionRow}>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      label={VISIBILITY_LABEL[option]}
                      variant={editValues.visibility === option ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={updateTrip.isPending}
                      onPress={() => setEditValues((prev) => prev ? { ...prev, visibility: option } : prev)}
                      testID={`trip-plan-edit-visibility-${option}`}
                    />
                  ))}
                </View>

                <Text style={styles.label}>{i18nT('trips:app.tabs.trips.plan.id.mest_a8c84414')}</Text>
                <TextInput
                  value={editValues.seatsTotal}
                  onChangeText={(seatsTotal) => setEditValues((prev) => prev ? { ...prev, seatsTotal: seatsTotal.replace(/[^0-9]/g, '') } : prev)}
                  placeholder="4"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  editable={!updateTrip.isPending}
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
                    label={i18nT('trips:app.tabs.trips.plan.id.sohranit_izmeneniya_ca17c0aa')}
                    onPress={handleSaveDetails}
                    loading={updateTrip.isPending}
                    disabled={updateTrip.isPending || coverUploadPending}
                    size="sm"
                    testID="trip-plan-edit-save"
                  />
                  <Button
                    label={i18nT('trips:app.tabs.trips.plan.id.zakryt_87bc8fb5')}
                    onPress={handleCancelEdit}
                    variant="ghost"
                    size="sm"
                    disabled={updateTrip.isPending || coverUploadPending}
                    testID="trip-plan-edit-cancel"
                  />
                </View>
              </View>
            ) : null}

            {/* ── Workspace tabs: turn the long stack into a planning workspace ── */}
            <View style={styles.tabBar} testID="trip-plan-tabs">
              {PLANNER_TABS.map((tabItem) => {
                const active = tabItem.key === activeTab;
                return (
                  <Pressable
                    key={tabItem.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tabItem.label}
                    onPress={() => setActiveTab(tabItem.key)}
                    style={[styles.tab, active && styles.tabActive]}
                    testID={`trip-plan-tab-${tabItem.key}`}
                  >
                    <Feather
                      name={tabItem.icon as never}
                      size={16}
                      color={active ? colors.primaryDark : colors.textSecondary}
                    />
                    {!isMobile || active ? (
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>
                        {tabItem.label}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'route' ? (
              <View style={styles.panel} testID="trip-plan-panel-route">
                <RouteBuilder trip={trip} />
              </View>
            ) : null}

            {activeTab === 'people' ? (
              <View style={styles.panel} testID="trip-plan-panel-people">
                <TripParticipantsList trip={trip} />
                <TripRsvpControl trip={trip} />
                <TripInvitePanel trip={trip} />
                <TripSuggestPointForm trip={trip} />
                <TripSuggestionsPanel trip={trip} />
                <TripTelegramGroupCard tripId={trip.id} isOwner={trip.isOwner} />
                <TripChatPanel tripId={trip.id} />
              </View>
            ) : null}

            {activeTab === 'export' ? (
              <View style={styles.panel} testID="trip-plan-panel-export">
                {showRouteExportMenu ? (
                  <View testID="trip-plan-route-export-section">
                    <TripRouteExportMenu trip={trip} />
                  </View>
                ) : (
                  <Text style={styles.panelHint} testID="trip-plan-export-unavailable">
                    {i18nT('trips:app.tabs.trips.plan.id.eksport_marshruta_dostupen_v_veb_versii_i_mo_23033c52')}</Text>
                )}
              </View>
            ) : null}

            {activeTab === 'more' ? (
              <View style={styles.panel} testID="trip-plan-panel-more">
                <TripReportForm trip={trip} />
                {trip.status === 'completed' ? <TripRatingPanel trip={trip} /> : null}
                <TripAffiliateBlock trip={trip} />
              </View>
            ) : null}

            <ConfirmDialog
              visible={deleteConfirmVisible}
              onClose={() => setDeleteConfirmVisible(false)}
              onConfirm={handleDelete}
              title={i18nT('trips:app.tabs.trips.plan.id.udalit_poezdku_0d7713a2')}
              message={i18nT('trips:app.tabs.trips.plan.id.poezdka_ischeznet_iz_kataloga_i_vashih_sozda_6e60ee80')}
              confirmText={i18nT('trips:app.tabs.trips.plan.id.udalit_eafe069e')}
              cancelText={i18nT('trips:app.tabs.trips.plan.id.ostavit_1f797003')}
              confirmTestID="trip-plan-delete-confirm"
              cancelTestID="trip-plan-delete-cancel"
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
