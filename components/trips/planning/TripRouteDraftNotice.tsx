// components/trips/planning/TripRouteDraftNotice.tsx
// #3298, #3416 п.1: форма новой поездки может прийти с точками маршрута — из плана ассистента или из
// карточки материала. Поездка создаётся первым запросом, точки сохраняются вторым — тем же, что у
// конструктора маршрута (`useUpdateTripRoute`). Здесь — этот второй шаг и строка о нём в форме.
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips';
import Button from '@/components/ui/Button';
import { useUpdateTripRoute } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT, translatePlural } from '@/i18n';

export interface TripRouteDraftSave {
  /** Сколько точек придёт в маршрут; ноль — у формы нет черновика маршрута. */
  count: number;
  /** Поездка создана: сохранить точки и сообщить форме, что можно открывать поездку. */
  finish: (trip: PlannedTrip) => void;
  /** Поездка уже создана, а точки не сохранились: повторная отправка формы создала бы вторую поездку. */
  createdTrip: PlannedTrip | null;
  pending: boolean;
  retry: () => void;
  /** Открыть созданную поездку без точек. */
  skip: () => void;
}

/**
 * Второй шаг создания поездки с черновиком маршрута. Без точек `finish` сразу отдаёт поездку форме —
 * поведение формы без черновика не меняется. `routeSaved` у `onCreated` говорит экрану, можно ли удалять
 * сохранённый черновик плана.
 */
export function useTripRouteDraftSave(
  routeDraft: readonly RoutePoint[] | undefined,
  onCreated: ((trip: PlannedTrip, routeSaved: boolean) => void) | undefined,
): TripRouteDraftSave {
  const updateRoute = useUpdateTripRoute();
  const [createdTrip, setCreatedTrip] = useState<PlannedTrip | null>(null);
  const count = routeDraft?.length ?? 0;

  const finish = useCallback(
    (trip: PlannedTrip) => {
      if (!routeDraft?.length) {
        onCreated?.(trip, true);
        return;
      }
      // Полный PUT заменяет маршрут: точки, которые уже есть у созданной поездки (стартовая), остаются первыми.
      updateRoute.mutate(
        { tripId: trip.id, route: [...(trip.route ?? []), ...routeDraft] },
        {
          onSuccess: (saved) => onCreated?.(saved, true),
          onError: () => setCreatedTrip(trip),
        },
      );
    },
    [onCreated, routeDraft, updateRoute],
  );

  const retry = useCallback(() => {
    if (createdTrip) finish(createdTrip);
  }, [createdTrip, finish]);
  const skip = useCallback(() => {
    if (createdTrip) onCreated?.(createdTrip, false);
  }, [createdTrip, onCreated]);

  return { count, finish, createdTrip, pending: updateRoute.isPending, retry, skip };
}

/** Строка формы о точках, которые встанут в маршрут; после сбоя сохранения — повтор и вход в поездку без точек. */
export function TripRouteDraftNotice({ save }: { save: TripRouteDraftSave }) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!save.count) return null;
  if (!save.createdTrip) {
    return (
      <Text style={styles.hint} testID="trip-create-route-draft">
        {translatePlural('tripsStatic:tripCreate.routeDraftHint', save.count)}
      </Text>
    );
  }
  return (
    <View style={styles.failed} testID="trip-create-route-draft-failed" accessibilityLiveRegion="polite">
      <Text style={styles.error}>{i18nT('tripsStatic:tripCreate.routeDraftFailed')}</Text>
      <View style={styles.actions}>
        <Button
          label={i18nT('tripsStatic:tripCreate.routeDraftRetry')}
          onPress={save.retry}
          loading={save.pending}
          disabled={save.pending}
          size="sm"
          testID="trip-create-route-draft-retry"
        />
        <Button
          label={i18nT('tripsStatic:tripCreate.routeDraftSkip')}
          onPress={save.skip}
          variant="ghost"
          size="sm"
          disabled={save.pending}
          testID="trip-create-route-draft-skip"
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    failed: { gap: 8 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
