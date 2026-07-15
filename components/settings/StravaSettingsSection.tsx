import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';

import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useStravaIntegration } from '@/hooks/useStravaIntegration';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { StravaActivitySummary, StravaAthleteSummary, StravaConnectionStatus } from '@/api/strava';
import { showToast } from '@/utils/toast';
import { formatDate as formatLocalizedDate, translate as i18nT } from '@/i18n'


const SUPPORT_EMAIL = 'metraveldev@gmail.com';

const createStatusLabels = (): Record<StravaConnectionStatus, string> => ({
  not_connected: i18nT('profile:components.settings.StravaSettingsSection.status.notConnected'),
  connected: i18nT('profile:components.settings.StravaSettingsSection.status.connected'),
  missing_scope: i18nT('profile:components.settings.StravaSettingsSection.status.missingScope'),
  deauthorized: i18nT('profile:components.settings.StravaSettingsSection.status.deauthorized'),
  rate_limited: i18nT('profile:components.settings.StravaSettingsSection.status.rateLimited'),
  backend_config_error: i18nT('profile:components.settings.StravaSettingsSection.status.backendConfigError'),
  error: i18nT('profile:components.settings.StravaSettingsSection.status.error'),
});

const createActivityTypes = () => [
  { label: i18nT('profile:components.settings.StravaSettingsSection.activityTypes.all'), value: '' },
  { label: 'Ride', value: 'Ride' },
  { label: 'Run', value: 'Run' },
  { label: 'Walk', value: 'Walk' },
  { label: 'Hike', value: 'Hike' },
];

const formatDate = (value?: string | null) => {
  if (!value) return i18nT('profile:components.settings.StravaSettingsSection.data_ne_ukazana_03850875');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalizedDate(parsed, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDistance = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters >= 1000) return i18nT('profile:components.settings.StravaSettingsSection.value1_km_cb14e0a5', { value1: (meters / 1000).toFixed(1) });
  return i18nT('profile:components.settings.StravaSettingsSection.value1_m_d2dbf1b0', { value1: Math.round(meters) });
};

const formatDuration = (seconds?: number | null) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? i18nT('profile:components.settings.StravaSettingsSection.value1_ch_value2_min_c49d665b', { value1: hours, value2: minutes }) : i18nT('profile:components.settings.StravaSettingsSection.value1_min_124a9f19', { value1: minutes });
};

const formatElevation = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  return i18nT('profile:components.settings.StravaSettingsSection.value1_m_nabora_0fd281ae', { value1: Math.round(meters) });
};

const getAthleteName = (athlete?: StravaAthleteSummary | null) => {
  if (!athlete) return null;
  const fullName = `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim();
  return fullName || athlete.username || null;
};

function ActivityCard({
  activity,
  selected,
  onSelect,
}: {
  activity: StravaActivitySummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const stats = [
    formatDistance(activity.distanceMeters),
    formatDuration(activity.movingTimeSeconds),
    formatElevation(activity.totalElevationGainMeters),
  ].filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.activityCard,
        selected && styles.activityCardSelected,
        pressed && styles.pressed,
        globalFocusStyles.focusable,
      ]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={i18nT('profile:components.settings.StravaSettingsSection.otkryt_aktivnost_strava_value1_429eaa41', { value1: activity.name })}
      testID={`strava-activity-${activity.id}`}
      {...Platform.select({ web: { cursor: 'pointer' } })}
    >
      <View style={styles.activityTitleRow}>
        <View style={styles.activityIcon}>
          <Feather name="activity" size={16} color={colors.strava} />
        </View>
        <View style={styles.activityTitleBlock}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {activity.name}
          </Text>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {[activity.sportType || activity.type, formatDate(activity.startDate)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Feather name={selected ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </View>
      {stats.length > 0 ? (
        <Text style={styles.activityStats} numberOfLines={2}>
          {stats.join(' · ')}
        </Text>
      ) : null}
      {activity.cacheExpiresAt ? (
        <Text style={styles.cacheHint}>{i18nT('profile:components.settings.StravaSettingsSection.kesh_dostupen_do_c4dee12c')}{formatDate(activity.cacheExpiresAt)}</Text>
      ) : null}
    </Pressable>
  );
}

export default function StravaSettingsSection() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const strava = useStravaIntegration();
  const params = useLocalSearchParams<{
    strava?: string;
    strava_status?: string;
    status?: string;
    error?: string;
  }>();
  const handledCallbackRef = useRef('');
  const status = strava.status;
  const isStatusInitialLoading = strava.statusQuery.isLoading && !status;
  const statusKind = status?.status ?? 'not_connected';
  const statusLabels = createStatusLabels();
  const activityTypes = createActivityTypes();
  const statusLabel = isStatusInitialLoading ? i18nT('profile:components.settings.StravaSettingsSection.proveryaem_status_4508f1dc') : statusLabels[statusKind];
  const athleteName = getAthleteName(status?.athlete);
  const statusIcon =
    isStatusInitialLoading
      ? 'clock'
      : statusKind === 'connected'
        ? 'check-circle'
        : statusKind === 'rate_limited'
          ? 'clock'
          : statusKind === 'backend_config_error'
            ? 'tool'
            : statusKind === 'missing_scope'
              ? 'alert-triangle'
              : 'link';
  const connectDisabled = isStatusInitialLoading || strava.isConnecting || statusKind === 'backend_config_error';
  const showActivities = strava.canLoadActivities;
  const selectedActivity = strava.selectedActivity;

  useEffect(() => {
    const callbackStatus = params.strava_status || params.strava || params.status || params.error;
    if (!callbackStatus) return;
    const key = String(callbackStatus);
    if (handledCallbackRef.current === key) return;
    handledCallbackRef.current = key;

    if (key === 'success' || key === 'connected') {
      showToast({ type: 'success', text1: i18nT('profile:components.settings.StravaSettingsSection.strava_podklyuchena_b2ecf298') });
      strava.refetchAll();
      return;
    }

    if (key === 'access_denied') {
      showToast({
        type: 'info',
        text1: i18nT('profile:components.settings.StravaSettingsSection.podklyuchenie_otmeneno_e0c538f3'),
        text2: i18nT('profile:components.settings.StravaSettingsSection.vy_ne_predostavili_dostup_strava_ddc9eb74'),
      });
      strava.refetchAll();
      return;
    }

    showToast({
      type: 'error',
      text1: i18nT('profile:components.settings.StravaSettingsSection.strava_ne_podklyuchena_c83e113c'),
      text2: key === 'missing_scope' ? i18nT('profile:components.settings.StravaSettingsSection.ne_vydany_obyazatelnye_razresheniya_strava_8022b65d') : i18nT('profile:components.settings.StravaSettingsSection.proverte_nastroyki_backend_oauth_074f597f'),
    });
    strava.refetchAll();
  }, [params.error, params.status, params.strava, params.strava_status, strava]);

  return (
    <>
      <Text style={styles.sectionTitle}>{i18nT('profile:components.settings.StravaSettingsSection.strava_e8e17f36')}</Text>
      <View style={styles.card} testID="strava-settings-section">
        <View style={styles.headerRow}>
          <View style={styles.brandMark}>
            <Feather name="activity" size={20} color={colors.textOnPrimary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{i18nT('profile:components.settings.StravaSettingsSection.strava_integration_d874fea3')}</Text>
            <Text style={styles.cardMeta}>
              {i18nT('profile:components.settings.StravaSettingsSection.connect_with_strava_chtoby_videt_tolko_svoi__a72fec52')}</Text>
          </View>
        </View>

        <View style={styles.statusBox}>
          <View style={styles.statusRow}>
            <Feather name={statusIcon} size={17} color={statusKind === 'connected' ? colors.success : colors.textMuted} />
            <Text style={styles.statusText}>{statusLabel}</Text>
            {strava.statusQuery.isFetching ? <ActivityIndicator size="small" color={colors.primaryDark} /> : null}
          </View>
          {athleteName ? <Text style={styles.statusMeta}>{i18nT('profile:components.settings.StravaSettingsSection.atlet_26905d50')}{athleteName}</Text> : null}
          {status?.lastSyncAt ? <Text style={styles.statusMeta}>{i18nT('profile:components.settings.StravaSettingsSection.poslednyaya_sinhronizatsiya_58488896')}{formatDate(status.lastSyncAt)}</Text> : null}
          {status?.missingScopes?.length ? (
            <Text style={styles.warningText}>{i18nT('profile:components.settings.StravaSettingsSection.ne_hvataet_scope_34f1e878')}{status.missingScopes.join(', ')}{i18nT('profile:components.settings.StravaSettingsSection.podklyuchite_strava_povtorno_36a67da7')}</Text>
          ) : null}
          {status?.message ? <Text style={styles.statusMeta}>{status.message}</Text> : null}
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.copyTitle}>{i18nT('profile:components.settings.StravaSettingsSection.pered_podklyucheniem_75b7a61f')}</Text>
          <Text style={styles.copyText}>
            {i18nT('profile:components.settings.StravaSettingsSection.metravel_zaprosit_dostup_strava_read_i_activ_dfc0f141')}</Text>
          <Text style={styles.copyText}>
            {i18nT('profile:components.settings.StravaSettingsSection.dannye_strava_otobrazhayutsya_tolko_vam_kak__47ce026e')}</Text>
          <Text style={styles.copyText}>
            {i18nT('profile:components.settings.StravaSettingsSection.otklyuchit_strava_i_zaprosit_udalenie_lokaln_35d5a4f9')}{SUPPORT_EMAIL}.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Button
            label={status?.connected
              ? i18nT('profile:components.settings.StravaSettingsSection.actions.reconnect')
              : i18nT('profile:components.settings.StravaSettingsSection.actions.connect')}
            onPress={strava.connect}
            disabled={connectDisabled}
            loading={strava.isConnecting}
            icon={<Feather name="external-link" size={16} color={colors.textOnPrimary} />}
            style={styles.stravaButton}
            labelStyle={styles.stravaButtonText}
            fullWidth={Platform.OS !== 'web'}
            testID="strava-connect-button"
          />
          {status?.connected || statusKind === 'missing_scope' || statusKind === 'deauthorized' ? (
            <Button
              label={strava.isDisconnecting ? i18nT('profile:components.settings.StravaSettingsSection.otklyuchenie_aa76be67') : i18nT('profile:components.settings.StravaSettingsSection.otklyuchit_strava_7902eb47')}
              onPress={strava.disconnect}
              disabled={strava.isDisconnecting}
              loading={strava.isDisconnecting}
              variant="outline"
              icon={<Feather name="x-circle" size={16} color={colors.danger} />}
              labelStyle={styles.disconnectLabel}
              style={styles.disconnectButton}
              testID="strava-disconnect-button"
            />
          ) : null}
        </View>

        {statusKind === 'backend_config_error' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{i18nT('profile:components.settings.StravaSettingsSection.backend_endpoint_esche_ne_gotov_036391f9')}</Text>
            <Text style={styles.noticeText}>
              {i18nT('profile:components.settings.StravaSettingsSection.front_gotov_k_strava_status_strava_connect_s_b9de85cb')}</Text>
          </View>
        ) : null}

        {statusKind === 'rate_limited' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{i18nT('profile:components.settings.StravaSettingsSection.limit_strava_d730116e')}</Text>
            <Text style={styles.noticeText}>
              {i18nT('profile:components.settings.StravaSettingsSection.ne_vypolnyaem_agressivnyy_refetch_povtorite__13a96240')}{status?.rateLimit?.retryAfterSeconds ? i18nT('profile:components.settings.StravaSettingsSection.cherez_value1_sek_268630b0', { value1: status.rateLimit.retryAfterSeconds }) : '.'}
            </Text>
          </View>
        ) : null}

        {showActivities ? (
          <View style={styles.activitiesBlock} testID="strava-activities-section">
            <Text style={styles.copyTitle}>{i18nT('profile:components.settings.StravaSettingsSection.aktivnosti_ce647e33')}</Text>
            <View style={styles.filtersGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.StravaSettingsSection.posle_daty_fbce0a89')}</Text>
                <TextInput
                  value={strava.filters.after}
                  onChangeText={(value) => strava.updateFilters({ after: value })}
                  placeholder={i18nT('profile:components.settings.StravaSettingsSection.yyyy_mm_dd_573a553b')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.StravaSettingsSection.do_daty_b26fd001')}</Text>
                <TextInput
                  value={strava.filters.before}
                  onChangeText={(value) => strava.updateFilters({ before: value })}
                  placeholder={i18nT('profile:components.settings.StravaSettingsSection.yyyy_mm_dd_573a553b')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.typeRow}>
              {activityTypes.map((item) => {
                const selected = strava.filters.type === item.value;
                return (
                  <Pressable
                    key={item.value || 'all'}
                    style={({ pressed }) => [
                      styles.typeChip,
                      selected && styles.typeChipSelected,
                      pressed && styles.pressed,
                      globalFocusStyles.focusable,
                    ]}
                    onPress={() => strava.updateFilters({ type: item.value })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {strava.activitiesQuery.isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.statusMeta}>{i18nT('profile:components.settings.StravaSettingsSection.zagruzhaem_aktivnosti_strava_ad2c8170')}</Text>
              </View>
            ) : strava.activitiesQuery.error ? (
              <Text style={styles.warningText}>
                {strava.activitiesQuery.error instanceof Error
                  ? strava.activitiesQuery.error.message
                  : i18nT('profile:components.settings.StravaSettingsSection.ne_udalos_zagruzit_aktivnosti_strava_d35d3d18')}
              </Text>
            ) : strava.activities.length === 0 ? (
              <Text style={styles.statusMeta}>{i18nT('profile:components.settings.StravaSettingsSection.za_vybrannyy_period_aktivnostey_net_c4f40516')}</Text>
            ) : (
              <View style={styles.activityList}>
                {strava.activities.map((activity) => (
                  <View key={activity.id}>
                    <ActivityCard
                      activity={activity}
                      selected={strava.selectedActivityId === activity.id}
                      onSelect={() =>
                        strava.setSelectedActivityId(
                          strava.selectedActivityId === activity.id ? null : activity.id,
                        )
                      }
                    />
                    {strava.selectedActivityId === activity.id ? (
                      <View style={styles.detailBox} testID={`strava-activity-detail-${activity.id}`}>
                        {strava.selectedActivityQuery.isLoading ? (
                          <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : selectedActivity ? (
                          <>
                            <Text style={styles.detailTitle}>{i18nT('profile:components.settings.StravaSettingsSection.detali_aktivnosti_729aa588')}</Text>
                            <Text style={styles.detailText}>
                              {[formatDistance(selectedActivity.distanceMeters), formatDuration(selectedActivity.elapsedTimeSeconds)]
                                .filter(Boolean)
                                .join(' · ') || i18nT('profile:components.settings.StravaSettingsSection.activityDetails.backendFallback')}
                            </Text>
                            {selectedActivity.mapPolyline ? (
                              <Text style={styles.cacheHint}>{i18nT('profile:components.settings.StravaSettingsSection.marshrut_dostupen_cherez_backend_detail_stre_bc5a9143')}</Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={styles.statusMeta}>{i18nT('profile:components.settings.StravaSettingsSection.backend_detail_endpoint_poka_ne_vernul_danny_8baf12cc')}</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {strava.activitiesQuery.data?.hasMore ? (
              <Button
                label={strava.activitiesQuery.isFetching ? i18nT('profile:components.settings.StravaSettingsSection.zagruzka_33437c29') : i18nT('profile:components.settings.StravaSettingsSection.zagruzit_esche_a79ab121')}
                onPress={strava.loadNextPage}
                disabled={strava.activitiesQuery.isFetching}
                loading={strava.activitiesQuery.isFetching}
                variant="secondary"
                size="sm"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 14,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        },
        ios: {
          shadowColor: colors.shadows.light.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    brandMark: {
      width: 40,
      height: 40,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.strava,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statusBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 6,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    statusMeta: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    warningText: {
      fontSize: 12,
      color: colors.warningDark,
      lineHeight: 17,
    },
    copyBlock: {
      gap: 8,
    },
    copyTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    copyText: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },
    actionsRow: {
      gap: 10,
      ...Platform.select({
        web: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
        } as any,
      }),
    },
    stravaButton: {
      backgroundColor: colors.strava,
      borderColor: colors.strava,
      minWidth: 210,
    },
    stravaButtonText: {
      color: colors.textOnPrimary,
    },
    disconnectButton: {
      borderColor: colors.danger,
      minWidth: 170,
    },
    disconnectLabel: {
      color: colors.danger,
    },
    noticeBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      padding: 12,
      gap: 4,
    },
    noticeTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    noticeText: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    activitiesBlock: {
      gap: 12,
    },
    filtersGrid: {
      gap: 10,
      ...Platform.select({
        web: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        } as any,
      }),
    },
    field: {
      gap: 6,
      ...Platform.select({
        web: {
          flexBasis: 'calc(50% - 5px)' as any,
          minWidth: 190,
          flexGrow: 1,
        } as any,
      }),
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeChip: {
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    typeChipSelected: {
      borderColor: colors.strava,
      backgroundColor: colors.primarySoft,
    },
    typeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    typeChipTextSelected: {
      color: colors.text,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activityList: {
      gap: 10,
    },
    activityCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 8,
    },
    activityCardSelected: {
      borderColor: colors.strava,
    },
    activityTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    activityIcon: {
      width: 30,
      height: 30,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityTitleBlock: {
      flex: 1,
      gap: 2,
    },
    activityTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    activityMeta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    activityStats: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
    },
    cacheHint: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
    },
    detailBox: {
      marginTop: 8,
      marginLeft: 8,
      borderLeftWidth: 2,
      borderLeftColor: colors.strava,
      paddingLeft: 10,
      gap: 4,
    },
    detailTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    detailText: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    pressed: {
      opacity: 0.9,
    },
  });
