import React, { useEffect, useMemo, useRef } from 'react';
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

const SUPPORT_EMAIL = 'metraveldev@gmail.com';

const STATUS_LABELS: Record<StravaConnectionStatus, string> = {
  not_connected: 'Не подключено',
  connected: 'Подключено',
  missing_scope: 'Нужен повторный доступ',
  deauthorized: 'Доступ отозван',
  rate_limited: 'Strava ограничила запросы',
  backend_config_error: 'Интеграция настраивается',
  error: 'Ошибка Strava',
};

const ACTIVITY_TYPES = [
  { label: 'Все типы', value: '' },
  { label: 'Ride', value: 'Ride' },
  { label: 'Run', value: 'Run' },
  { label: 'Walk', value: 'Walk' },
  { label: 'Hike', value: 'Hike' },
];

const formatDate = (value?: string | null) => {
  if (!value) return 'Дата не указана';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDistance = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} км`;
  return `${Math.round(meters)} м`;
};

const formatDuration = (seconds?: number | null) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
};

const formatElevation = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  return `${Math.round(meters)} м набора`;
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
      accessibilityLabel={`Открыть активность Strava ${activity.name}`}
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
        <Text style={styles.cacheHint}>Кеш доступен до {formatDate(activity.cacheExpiresAt)}</Text>
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
  const statusLabel = isStatusInitialLoading ? 'Проверяем статус…' : STATUS_LABELS[statusKind];
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
      showToast({ type: 'success', text1: 'Strava подключена' });
      strava.refetchAll();
      return;
    }

    if (key === 'access_denied') {
      showToast({
        type: 'info',
        text1: 'Подключение отменено',
        text2: 'Вы не предоставили доступ Strava.',
      });
      strava.refetchAll();
      return;
    }

    showToast({
      type: 'error',
      text1: 'Strava не подключена',
      text2: key === 'missing_scope' ? 'Не выданы обязательные разрешения Strava.' : 'Проверьте настройки backend OAuth.',
    });
    strava.refetchAll();
  }, [params.error, params.status, params.strava, params.strava_status, strava]);

  return (
    <>
      <Text style={styles.sectionTitle}>Strava</Text>
      <View style={styles.card} testID="strava-settings-section">
        <View style={styles.headerRow}>
          <View style={styles.brandMark}>
            <Feather name="activity" size={20} color={colors.textOnPrimary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Strava integration</Text>
            <Text style={styles.cardMeta}>
              Connect with Strava, чтобы видеть только свои активности в Metravel.
            </Text>
          </View>
        </View>

        <View style={styles.statusBox}>
          <View style={styles.statusRow}>
            <Feather name={statusIcon} size={17} color={statusKind === 'connected' ? colors.success : colors.textMuted} />
            <Text style={styles.statusText}>{statusLabel}</Text>
            {strava.statusQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          {athleteName ? <Text style={styles.statusMeta}>Атлет: {athleteName}</Text> : null}
          {status?.lastSyncAt ? <Text style={styles.statusMeta}>Последняя синхронизация: {formatDate(status.lastSyncAt)}</Text> : null}
          {status?.missingScopes?.length ? (
            <Text style={styles.warningText}>Не хватает scope: {status.missingScopes.join(', ')}. Подключите Strava повторно.</Text>
          ) : null}
          {status?.message ? <Text style={styles.statusMeta}>{status.message}</Text> : null}
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.copyTitle}>Перед подключением</Text>
          <Text style={styles.copyText}>
            Metravel запросит доступ Strava `read` и `activity:read`, чтобы показать ваши активности,
            дистанцию, время, набор высоты и дату старта. Токены Strava хранятся только на backend.
          </Text>
          <Text style={styles.copyText}>
            Данные Strava отображаются только вам как авторизованному пользователю. Локальный кеш временный:
            он может обновляться, исчезать после удаления в Strava или очищаться при отключении интеграции.
          </Text>
          <Text style={styles.copyText}>
            Отключить Strava и запросить удаление локального кеша можно здесь или через поддержку {SUPPORT_EMAIL}.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Button
            label={status?.connected ? 'Reconnect with Strava' : 'Connect with Strava'}
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
              label={strava.isDisconnecting ? 'Отключение…' : 'Отключить Strava'}
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
            <Text style={styles.noticeTitle}>Backend endpoint ещё не готов</Text>
            <Text style={styles.noticeText}>
              Фронт готов к `/strava/status/`, `/strava/connect/start/`, `/strava/disconnect/`
              и `/strava/activities/`. После backend задач sprint 5 секция начнёт работать без изменения UX.
            </Text>
          </View>
        ) : null}

        {statusKind === 'rate_limited' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Лимит Strava</Text>
            <Text style={styles.noticeText}>
              Не выполняем агрессивный refetch. Повторите позже
              {status?.rateLimit?.retryAfterSeconds ? ` через ${status.rateLimit.retryAfterSeconds} сек.` : '.'}
            </Text>
          </View>
        ) : null}

        {showActivities ? (
          <View style={styles.activitiesBlock} testID="strava-activities-section">
            <Text style={styles.copyTitle}>Активности</Text>
            <View style={styles.filtersGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>После даты</Text>
                <TextInput
                  value={strava.filters.after}
                  onChangeText={(value) => strava.updateFilters({ after: value })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>До даты</Text>
                <TextInput
                  value={strava.filters.before}
                  onChangeText={(value) => strava.updateFilters({ before: value })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.typeRow}>
              {ACTIVITY_TYPES.map((item) => {
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
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusMeta}>Загружаем активности Strava…</Text>
              </View>
            ) : strava.activitiesQuery.error ? (
              <Text style={styles.warningText}>
                {strava.activitiesQuery.error instanceof Error
                  ? strava.activitiesQuery.error.message
                  : 'Не удалось загрузить активности Strava.'}
              </Text>
            ) : strava.activities.length === 0 ? (
              <Text style={styles.statusMeta}>За выбранный период активностей нет.</Text>
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
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : selectedActivity ? (
                          <>
                            <Text style={styles.detailTitle}>Детали активности</Text>
                            <Text style={styles.detailText}>
                              {[formatDistance(selectedActivity.distanceMeters), formatDuration(selectedActivity.elapsedTimeSeconds)]
                                .filter(Boolean)
                                .join(' · ') || 'Детали доступны после ответа backend.'}
                            </Text>
                            {selectedActivity.mapPolyline ? (
                              <Text style={styles.cacheHint}>Маршрут доступен через backend detail/streams proxy.</Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={styles.statusMeta}>Backend detail endpoint пока не вернул данные.</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {strava.activitiesQuery.data?.hasMore ? (
              <Button
                label={strava.activitiesQuery.isFetching ? 'Загрузка…' : 'Загрузить ещё'}
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
