// components/trips/planning/TripSuggestPointForm.tsx
// Форма «Предложить место» (Sprint 13 / FE-trip-coedit): попутчик-не-владелец
// предлагает точку маршрута организатору. Зеркалит add-point sub-form из
// RouteBuilder, отправляет предложение через useSuggestPoint.
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type {
  PlannedTrip,
  RoutePoint,
  RoutePointType,
} from '@/api/plannedTrips';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import { useSuggestPoint } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const POINT_TYPES: RoutePointType[] = ['place', 'custom', 'rest', 'overnight'];

function TripSuggestPointForm({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const suggest = useSuggestPoint();

  const [type, setType] = useState<RoutePointType>('place');
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (trip.isOwner) {
    return null;
  }

  const handleSuggest = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitError(null);
    setSent(false);

    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    const coordinates: [number, number] | null =
      Number.isFinite(latNum) && Number.isFinite(lngNum) ? [lngNum, latNum] : null;
    const desc = description.trim();

    const point: Omit<RoutePoint, 'id'> = {
      type,
      name: trimmedName,
      description: desc || null,
      coordinates,
      placeId: null,
    };

    suggest.mutate(
      { tripId: trip.id, point },
      {
        onSuccess: () => {
          setName('');
          setLat('');
          setLng('');
          setDescription('');
          setSent(true);
        },
        onError: () =>
          setSubmitError('Не удалось отправить предложение. Попробуйте ещё раз позже.'),
      },
    );
  };

  return (
    <View style={styles.wrap} testID="trip-suggest-form">
      <Text style={styles.heading}>Предложить место</Text>
      <Text style={styles.hint}>
        Организатор увидит ваше предложение и решит, добавить ли точку в маршрут.
      </Text>

      <View style={styles.chipRow}>
        {POINT_TYPES.map((option) => {
          const active = option === type;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setType(option)}
              style={[styles.typeChip, active && styles.typeChipActive]}
            >
              <Feather
                name={ROUTE_POINT_ICON_NAME[option] as never}
                size={13}
                color={active ? colors.textOnPrimary : colors.textSecondary}
              />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {ROUTE_POINT_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setSent(false);
        }}
        placeholder="Название точки"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-suggest-name"
      />
      <View style={styles.coordRow}>
        <TextInput
          value={lat}
          onChangeText={setLat}
          placeholder="Широта (lat)"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.coordInput]}
          testID="trip-suggest-lat"
        />
        <TextInput
          value={lng}
          onChangeText={setLng}
          placeholder="Долгота (lng)"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.coordInput]}
          testID="trip-suggest-lng"
        />
      </View>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Почему стоит заехать (по желанию)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-suggest-desc"
      />

      {submitError ? (
        <Text style={styles.error} testID="trip-suggest-error">
          {submitError}
        </Text>
      ) : null}
      {sent ? (
        <Text style={styles.success} testID="trip-suggest-success">
          Предложение отправлено организатору.
        </Text>
      ) : null}

      <Button
        label="Предложить"
        onPress={handleSuggest}
        loading={suggest.isPending}
        disabled={!name.trim() || suggest.isPending}
        fullWidth
        testID="trip-suggest-submit"
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    typeChipText: { fontSize: 13, color: colors.text },
    typeChipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
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
    coordRow: { flexDirection: 'row', gap: 8 },
    coordInput: { flex: 1 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    success: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  });

export default React.memo(TripSuggestPointForm);
