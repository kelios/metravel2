import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import RouteBuilder from '@/components/MapPage/RouteBuilder';
import RoutingStatus from '@/components/MapPage/RoutingStatus';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import ValidationMessage from '@/components/MapPage/ValidationMessage';
import MapIcon from './MapIcon';
import { RouteValidator } from '@/utils/routeValidator';
import type { ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';
import type { RoutePoint } from '@/types/route';

const toRad = (deg: number) => (deg * Math.PI) / 180;

const haversineMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const estimateDurationSeconds = (
  meters: number,
  mode: 'car' | 'bike' | 'foot',
) => {
  const speedsKmh = { car: 60, bike: 20, foot: 5 };
  const speed = speedsKmh[mode] ?? 60;
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  const hours = meters / 1000 / speed;
  const seconds = Math.round(hours * 3600);
  return Number.isFinite(seconds) ? seconds : 0;
};

const TRANSPORT_MODES = [
  {
    key: 'car' as const,
    icon: 'directions-car',
    label: 'Авто',
    iconSource: 'material' as const,
  },
  {
    key: 'foot' as const,
    icon: 'directions-walk',
    label: 'Пешком',
    iconSource: 'material' as const,
  },
  {
    key: 'bike' as const,
    icon: 'directions-bike',
    label: 'Велосипед',
    iconSource: 'material' as const,
  },
];

interface FiltersPanelRouteSectionProps {
  colors: ThemedColors;
  styles: any;
  mode: 'radius' | 'route';
  transportMode: 'car' | 'bike' | 'foot';
  setTransportMode: (m: 'car' | 'bike' | 'foot') => void;
  startAddress: string;
  endAddress: string;
  routingLoading?: boolean;
  routingError?: string | boolean | null;
  routeDistance?: number | null;
  routeDuration?: number | null;
  routeElevationGain?: number | null;
  routeElevationLoss?: number | null;
  routePoints?: RoutePoint[];
  onRemoveRoutePoint?: (id: string) => void;
  onClearRoute?: () => void;
  swapStartEnd?: () => void;
  onAddressSelect?: (
    address: string,
    coords: LatLng,
    isStart: boolean,
  ) => void;
  onAddressClear?: (isStart: boolean) => void;
}

const FiltersPanelRouteSection: React.FC<FiltersPanelRouteSectionProps> = ({
  colors,
  styles,
  mode,
  transportMode,
  setTransportMode,
  startAddress,
  endAddress,
  routingLoading,
  routingError,
  routeDistance,
  routeDuration,
  routeElevationGain,
  routeElevationLoss,
  routePoints = [],
  onRemoveRoutePoint,
  onClearRoute,
  swapStartEnd,
  onAddressSelect,
  onAddressClear,
}) => {
  const routeStepState = {
    startSelected: !!routePoints[0],
    endSelected: !!routePoints[1],
  };

  const validation = useMemo(() => {
    if (mode === 'route' && routePoints.length > 0) {
      return RouteValidator.validate(routePoints);
    }
    return { valid: true, errors: [], warnings: [] };
  }, [mode, routePoints]);

  const transportOptions = useMemo(
    () =>
      TRANSPORT_MODES.map(({ key, label, icon, iconSource }) => ({
        key,
        label,
        icon,
        iconSource,
      })),
    [],
  );

  const hasTwoPoints = mode === 'route' && routePoints.length >= 2;
  const remainingPoints = Math.max(0, 2 - routePoints.length);
  const selectedTransportLabel =
    TRANSPORT_MODES.find((transport) => transport.key === transportMode)
      ?.label || 'Транспорт выбран';

  const fallbackDistanceMeters = useMemo(() => {
    if (!hasTwoPoints) return 0;
    let total = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const prev = routePoints[i - 1]?.coordinates;
      const next = routePoints[i]?.coordinates;
      if (!prev || !next) continue;
      if (
        !Number.isFinite(prev.lat) ||
        !Number.isFinite(prev.lng) ||
        !Number.isFinite(next.lat) ||
        !Number.isFinite(next.lng)
      ) {
        continue;
      }
      total += haversineMeters(
        { lat: prev.lat, lng: prev.lng },
        { lat: next.lat, lng: next.lng },
      );
    }
    return Number.isFinite(total) ? total : 0;
  }, [hasTwoPoints, routePoints]);

  const storeDistance = typeof routeDistance === 'number' ? routeDistance : 0;
  const storeDuration = typeof routeDuration === 'number' ? routeDuration : 0;
  const effectiveDistance =
    storeDistance > 0 ? storeDistance : fallbackDistanceMeters;
  const effectiveDuration =
    storeDuration > 0
      ? storeDuration
      : estimateDurationSeconds(effectiveDistance, transportMode);
  const isEstimated = !(storeDistance > 0 && storeDuration > 0);
  const shouldShowRouteStats =
    hasTwoPoints &&
    (Boolean(routingLoading) ||
      Boolean(routingError) ||
      effectiveDistance > 0 ||
      effectiveDuration > 0);

  return (
    <View style={[styles.section, styles.routeSectionCompact]}>
      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>1</Text>
          <Text style={styles.lightStepTitle}>Транспорт</Text>
          <Text style={styles.lightStepBadge}>{selectedTransportLabel}</Text>
        </View>
        <SegmentedControl
          options={transportOptions}
          value={transportMode}
          onChange={(key) => {
            setTransportMode(key as 'car' | 'bike' | 'foot');
          }}
          accessibilityLabel="Транспорт"
          compact
          dense
          noOuterMargins
          role="button"
          tone="subtle"
          iconOnly
        />
      </View>

      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>2</Text>
          <Text style={styles.lightStepTitle}>Точки маршрута</Text>
          {routeStepState.startSelected && routeStepState.endSelected ? (
            <View style={styles.lightCheckBadge}>
              <MapIcon name="check" size={12} color={colors.success} />
              <Text style={styles.lightCheckText}>Готово</Text>
            </View>
          ) : (
            <Text style={styles.lightStepHint}>Выберите точки</Text>
          )}
        </View>

        {onAddressSelect && (
          <RouteBuilder
            startAddress={startAddress}
            endAddress={endAddress}
            onAddressSelect={onAddressSelect}
            onAddressClear={onAddressClear}
            onSwap={swapStartEnd}
            onClear={onClearRoute}
            compact
          />
        )}

        {!hasTwoPoints && (
          <View style={styles.noPointsToast} testID="route-empty-state">
            <Text style={styles.noPointsTitle}>
              {routePoints.length === 0
                ? 'Сначала выберите старт и финиш'
                : 'Нужна ещё одна точка'}
            </Text>
            <Text style={styles.noPointsSubtitle}>
              {routePoints.length === 0
                ? 'Начните с адреса или отметьте первую точку на карте, затем добавьте место назначения.'
                : `Маршрут почти готов. Добавьте ещё ${remainingPoints} точку, чтобы запустить расчёт.`}
            </Text>
            {routePoints.length > 0 && onClearRoute ? (
              <View style={styles.noPointsActions}>
                <Button
                  label="Очистить маршрут"
                  onPress={onClearRoute}
                  accessibilityLabel="Очистить маршрут"
                  size="sm"
                  variant="outline"
                  style={styles.ctaButton}
                />
              </View>
            ) : null}
          </View>
        )}
      </View>

      {shouldShowRouteStats && (
        <View style={styles.lightStepBlock} testID="route-stats-block">
          <View style={styles.lightStepHeader}>
            <Text style={styles.lightStepNumber}>3</Text>
            <Text style={styles.lightStepTitle}>Итог маршрута</Text>
            {isEstimated && !routingLoading && !routingError ? (
              <Text style={styles.lightStepHint}>оценка</Text>
            ) : null}
          </View>
          <View testID="route-stats">
            <RoutingStatus
              isLoading={!!routingLoading}
              error={routingError || null}
              distance={effectiveDistance > 0 ? effectiveDistance : null}
              duration={effectiveDuration > 0 ? effectiveDuration : null}
              transportMode={transportMode}
              isEstimated={isEstimated}
              elevationGain={routeElevationGain ?? null}
              elevationLoss={routeElevationLoss ?? null}
              compact
            />
          </View>
        </View>
      )}

      {!onAddressSelect && mode === 'route' && routePoints.length > 0 && (
        <View style={styles.lightStepBlock}>
          <Text style={styles.lightSectionLabel}>Точки маршрута</Text>
          <View style={styles.lightPointsList} testID="route-points-list">
            {routePoints.map((p, index) => {
              const label =
                String(p?.address || '').trim() || `Точка ${index + 1}`;
              const canRemove =
                typeof onRemoveRoutePoint === 'function' && Boolean(p?.id);

              return (
                <View
                  key={String(p?.id ?? index)}
                  style={styles.lightPointRow}
                >
                  <View style={styles.lightPointDot}>
                    <Text style={styles.lightPointDotText}>{index + 1}</Text>
                  </View>
                  <Text
                    style={styles.lightPointLabel}
                    numberOfLines={1}
                    testID={`route-point-pill-${String(p?.id ?? index)}`}
                  >
                    {label}
                  </Text>
                  <IconButton
                    icon={
                      <MapIcon
                        name="close"
                        size={14}
                        color={colors.textMuted}
                      />
                    }
                    label={`Удалить точку: ${label}`}
                    size="sm"
                    disabled={!canRemove}
                    onPress={() => {
                      if (!canRemove) return;
                      onRemoveRoutePoint?.(String(p.id));
                    }}
                    style={[
                      styles.lightPointRemove,
                      !canRemove && styles.lightPointRemoveDisabled,
                    ]}
                    testID={`route-point-remove-${String(p?.id ?? index)}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!validation.valid && (
        <ValidationMessage type="error" messages={validation.errors} />
      )}
      {validation.warnings.length > 0 && (
        <ValidationMessage type="warning" messages={validation.warnings} />
      )}
    </View>
  );
};

export default React.memo(FiltersPanelRouteSection);
