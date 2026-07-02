// components/trips/planning/TripReportForm.tsx
// Пост-отчёт о поездке (Sprint 14, FE-trip-report): организатор завершает поездку,
// описывает её и при желании публикует маршрут в каталог сообщества. Бэкенд
// /complete/ хранит только summary, visited_place_ids и publish_to_catalog —
// фото/GPX требуют asset-id, которых фронт пока не умеет создавать, поэтому форма
// их не собирает (отправляем photoUrls: [] и gpxUrl: null). Если отчёт уже
// опубликован — показываем read-only карточку вместо формы.
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { PlannedTrip, SubmitReportInput } from '@/api/plannedTrips';
import { useSubmitTripReport } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const SUMMARY_MIN = 10;

const formatPublishedAt = (value: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU');
};

const parsePlaceIds = (raw: string): number[] =>
  raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((n) => Number.isInteger(n) && Number.isFinite(n));

function TripReportForm({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submit = useSubmitTripReport();

  const [summary, setSummary] = useState('');
  const [places, setPlaces] = useState('');
  const [publishToCommunity, setPublishToCommunity] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!trip.isOwner) return null;

  if (trip.report?.published) {
    const report = trip.report;
    const publishedAt = formatPublishedAt(report.publishedAt);
    return (
      <View style={styles.wrap} testID="trip-report-form">
        <View style={styles.publishedHead}>
          <Feather name="check-circle" size={18} color={colors.primaryDark} />
          <Text style={styles.heading}>Отчёт опубликован</Text>
        </View>
        {report.summary ? (
          <Text style={styles.summaryText}>{report.summary}</Text>
        ) : null}
        {trip.publishedToCommunity ? (
          <Text style={styles.note}>Маршрут добавлен в каталог сообщества</Text>
        ) : null}
        {publishedAt ? (
          <Text style={styles.hint}>Опубликовано {publishedAt}</Text>
        ) : null}
      </View>
    );
  }

  const trimmedSummary = summary.trim();
  const summaryTooShort = trimmedSummary.length < SUMMARY_MIN;
  const disabled = summaryTooShort || submit.isPending;

  const handleSubmit = () => {
    setTouched(true);
    setSubmitError(null);
    if (summaryTooShort) return;
    const input: SubmitReportInput = {
      tripId: trip.id,
      summary: trimmedSummary,
      photoUrls: [],
      gpxUrl: null,
      visitedPlaceIds: parsePlaceIds(places),
      publishToCommunity,
    };
    submit.mutate(input, {
      onError: () =>
        setSubmitError('Не удалось сохранить отчёт. Попробуйте ещё раз.'),
    });
  };

  return (
    <View style={styles.wrap} testID="trip-report-form">
      <Text style={styles.heading}>Отчёт о поездке</Text>

      <Text style={styles.label}>Как всё прошло</Text>
      <TextInput
        value={summary}
        onChangeText={setSummary}
        placeholder="Расскажите, как прошла поездка, что запомнилось, советы попутчикам"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-report-summary"
      />
      {touched && summaryTooShort ? (
        <Text style={styles.error}>
          Опишите поездку — не короче {SUMMARY_MIN} символов
        </Text>
      ) : null}

      <Text style={styles.label}>ID посещённых мест MeTravel (через запятую)</Text>
      <TextInput
        value={places}
        onChangeText={setPlaces}
        placeholder="Например: 12, 48, 103"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.input}
        testID="trip-report-places"
      />

      <Pressable
        onPress={() => setPublishToCommunity((prev) => !prev)}
        style={[styles.toggle, publishToCommunity && styles.toggleActive]}
        testID="trip-report-publish-toggle"
      >
        {publishToCommunity ? (
          <Feather name="check" size={16} color={colors.primaryDark} />
        ) : null}
        <Text style={[styles.toggleText, publishToCommunity && styles.toggleTextActive]}>
          Опубликовать маршрут в каталог сообщества
        </Text>
      </Pressable>

      {submitError ? (
        <Text style={styles.error} testID="trip-report-error">
          {submitError}
        </Text>
      ) : null}

      <Button
        label="Завершить поездку и опубликовать отчёт"
        onPress={handleSubmit}
        loading={submit.isPending}
        disabled={disabled}
        fullWidth
        testID="trip-report-submit"
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    publishedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    summaryText: { fontSize: 14, color: colors.text, lineHeight: 20 },
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
      minHeight: 96,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      marginTop: 4,
    },
    toggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    toggleText: { flex: 1, fontSize: 14, color: colors.textSecondary },
    toggleTextActive: { color: colors.primaryText, fontWeight: '600' },
    note: { fontSize: 13, color: colors.text, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  });

export default React.memo(TripReportForm);
