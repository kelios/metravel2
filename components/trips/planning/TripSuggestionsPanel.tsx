// components/trips/planning/TripSuggestionsPanel.tsx
// Панель «Предложенные точки» (Sprint 13 / FE-trip-coedit): организатор видит
// предложения попутчиков и принимает/отклоняет каждое через useDecideSuggestion.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { PlannedTrip, TripSuggestion } from '@/api/plannedTrips';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import {
  useDecideSuggestion,
  useTripSuggestions,
} from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

function formatCoordinates(coordinates: [number, number] | null): string | null {
  if (!coordinates) return null;
  const [lng, lat] = coordinates;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function TripSuggestionsPanel({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const suggestionsQuery = useTripSuggestions(trip.id);
  const decide = useDecideSuggestion();

  const [decidingId, setDecidingId] = useState<number | null>(null);

  if (!trip.isOwner) {
    return null;
  }

  const suggestions = suggestionsQuery.data ?? [];
  const pending = suggestions.filter((s) => s.status === 'pending');
  const history = suggestions.filter((s) => s.status !== 'pending');

  const handleDecide = (suggestion: TripSuggestion, decision: 'approve' | 'reject') => {
    setDecidingId(suggestion.id);
    decide.mutate(
      { tripId: trip.id, suggestionId: suggestion.id, decision },
      { onSettled: () => setDecidingId(null) },
    );
  };

  const renderPoint = (suggestion: TripSuggestion) => {
    const { point } = suggestion;
    const coords = formatCoordinates(point.coordinates);
    return (
      <>
        <View style={styles.pointHead}>
          <View style={styles.pointIcon}>
            <Feather
              name={ROUTE_POINT_ICON_NAME[point.type] as never}
              size={16}
              color={colors.primaryDark}
            />
          </View>
          <Text style={styles.pointType}>{ROUTE_POINT_LABEL[point.type]}</Text>
        </View>
        <Text style={styles.pointName}>{point.name}</Text>
        {point.description ? (
          <Text style={styles.pointDescription}>{point.description}</Text>
        ) : null}
        {coords ? <Text style={styles.pointCoords}>{coords}</Text> : null}
      </>
    );
  };

  const renderPending = (suggestion: TripSuggestion) => {
    const busy = decidingId === suggestion.id && decide.isPending;
    return (
      <View
        key={suggestion.id}
        style={styles.row}
        testID={`trip-suggestion-${suggestion.id}`}
      >
        <Text style={styles.author}>{suggestion.author.name}</Text>
        {renderPoint(suggestion)}
        <View style={styles.actions}>
          <Button
            label="Принять"
            onPress={() => handleDecide(suggestion, 'approve')}
            variant="primary"
            loading={busy}
            disabled={busy}
            testID={`trip-suggestion-approve-${suggestion.id}`}
          />
          <Button
            label="Отклонить"
            onPress={() => handleDecide(suggestion, 'reject')}
            variant="outline"
            disabled={busy}
            testID={`trip-suggestion-reject-${suggestion.id}`}
          />
        </View>
      </View>
    );
  };

  const renderHistory = (suggestion: TripSuggestion) => (
    <View
      key={suggestion.id}
      style={[styles.row, styles.rowMuted]}
      testID={`trip-suggestion-${suggestion.id}`}
    >
      <View style={styles.historyHead}>
        <Text style={styles.author}>{suggestion.author.name}</Text>
        <Text
          style={[
            styles.statusBadge,
            suggestion.status === 'approved' ? styles.statusApproved : styles.statusRejected,
          ]}
        >
          {suggestion.status === 'approved' ? 'Принято' : 'Отклонено'}
        </Text>
      </View>
      {renderPoint(suggestion)}
    </View>
  );

  return (
    <View style={styles.wrap} testID="trip-suggestions-panel">
      <Text style={styles.heading}>Предложенные точки</Text>

      {suggestionsQuery.isLoading ? (
        <ActivityIndicator color={colors.primaryDark} />
      ) : (
        <>
          {pending.length ? (
            <View style={styles.list}>{pending.map(renderPending)}</View>
          ) : (
            <Text style={styles.hint}>Новых предложений нет.</Text>
          )}

          {history.length ? (
            <View style={styles.list}>{history.map(renderHistory)}</View>
          ) : null}
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    list: { gap: 8 },
    row: {
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    rowMuted: { backgroundColor: colors.surfaceMuted, opacity: 0.85 },
    author: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    pointHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pointIcon: { width: 22, alignItems: 'center' },
    pointType: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    pointName: { fontSize: 15, fontWeight: '600', color: colors.text },
    pointDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    pointCoords: { fontSize: 12, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    historyHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    statusBadge: { fontSize: 11, fontWeight: '700' },
    statusApproved: { color: colors.success },
    statusRejected: { color: colors.danger },
  });

export default React.memo(TripSuggestionsPanel);
