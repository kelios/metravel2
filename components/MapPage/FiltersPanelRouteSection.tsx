import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapIcon from './MapIcon';
import RouteBuilder from '@/components/MapPage/RouteBuilder';
import ValidationMessage from '@/components/MapPage/ValidationMessage';
import { RouteValidator } from '@/utils/routeValidator';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import RoutingStatus from '@/components/MapPage/RoutingStatus';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';

const toRad = (deg: number) => (deg * Math.PI) / 180;

const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const estimateDurationSeconds = (meters: number, mode: 'car' | 'bike' | 'foot') => {
  const speedsKmh = { car: 60, bike: 20, foot: 5 };
  const speed = speedsKmh[mode] ?? 60;
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  const hours = (meters / 1000) / speed;
  const seconds = Math.round(hours * 3600);
  return Number.isFinite(seconds) ? seconds : 0;
};

const TRANSPORT_MODES = [
  { key: 'car' as const, icon: 'directions-car', label: 'Авто' },
  { key: 'foot' as const, icon: 'directions-walk', label: 'Пешком' },
  { key: 'bike' as const, icon: 'directions-bike', label: 'Велосипед' },
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
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
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
    if (mode === 'route' && routePoints && routePoints.length > 0) {
      return RouteValidator.validate(routePoints);
    }
    return { valid: true, errors: [], warnings: [] };
  }, [mode, routePoints]);

  const transportOptions = useMemo(
    () =>
      TRANSPORT_MODES.map(({ key, label, icon }) => ({
        key,
        label,
        icon,
      })),
    []
  );

  const isTransportDisabled = !(routeStepState.startSelected && routeStepState.endSelected);
  const hasTwoPoints = mode === 'route' && routePoints.length >= 2;

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
      total += haversineMeters({ lat: prev.lat, lng: prev.lng }, { lat: next.lat, lng: next.lng });
    }
    return Number.isFinite(total) ? total : 0;
  }, [hasTwoPoints, routePoints]);

  const storeDistance = typeof routeDistance === 'number' ? routeDistance : 0;
  const storeDuration = typeof routeDuration === 'number' ? routeDuration : 0;
  const effectiveDistance = storeDistance > 0 ? storeDistance : fallbackDistanceMeters;
  const effectiveDuration = storeDuration > 0 ? storeDuration : estimateDurationSeconds(effectiveDistance, transportMode);
  const isEstimated = !(storeDistance > 0 && storeDuration > 0);
  const shouldShowRouteStats =
    hasTwoPoints &&
    (Boolean(routingLoading) ||
      Boolean(routingError) ||
      effectiveDistance > 0 ||
      effectiveDuration > 0);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Маршрут</Text>
      <Text style={styles.sectionHint}>
        Выберите старт и финиш на карте или через поиск, затем укажите транспорт.
      </Text>

      <View
        style={[
          styles.section,
          styles.sectionTight,
          styles.transportSection,
          !(routeStepState.startSelected && routeStepState.endSelected) && styles.sectionDisabled,
        ]}
      >
        <Text style={styles.sectionLabel}>Транспорт</Text>
        {!routeStepState.startSelected || !routeStepState.endSelected ? (
          <Text style={styles.sectionHint}>Доступно после выбора старта и финиша</Text>
        ) : null}
        <View style={[styles.transportTabs, isTransportDisabled && styles.transportTabsDisabled]}>
          <SegmentedControl
            options={transportOptions}
            value={transportMode}
            onChange={(key) => {
              if (isTransportDisabled) return;
              setTransportMode(key as 'car' | 'bike' | 'foot');
            }}
            accessibilityLabel="Транспорт"
            compact
            disabled={isTransportDisabled}
            role="button"
          />
        </View>
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

      {shouldShowRouteStats && (
        <View style={styles.routeStatsContainer} testID="route-stats">
          <RoutingStatus
            isLoading={!!routingLoading}
            error={routingError || null}
            distance={effectiveDistance > 0 ? effectiveDistance : null}
            duration={effectiveDuration > 0 ? effectiveDuration : null}
            transportMode={transportMode}
            isEstimated={isEstimated}
            elevationGain={routeElevationGain ?? null}
            elevationLoss={routeElevationLoss ?? null}
          />
        </View>
      )}

      {!onAddressSelect && mode === 'route' && routePoints.length > 0 && (
        <View style={styles.routePointsList} testID="route-points-list">
          {routePoints.map((p, index) => {
            const label = String(p?.address || '').trim() || `Точка ${index + 1}`;
            const canRemove = typeof onRemoveRoutePoint === 'function' && Boolean(p?.id);
            return (
              <View key={String(p?.id ?? index)} style={styles.routePointRow}>
                <View style={styles.routePointPill} testID={`route-point-pill-${String(p?.id ?? index)}`}>
                  <Text style={styles.routePointPillText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                <IconButton
                  icon={<MapIcon name="close" size={18} color={colors.textOnDark} />}
                  label={`Удалить точку: ${label}`}
                  size="sm"
                  disabled={!canRemove}
                  onPress={() => {
                    if (!canRemove) return;
                    onRemoveRoutePoint?.(String(p.id));
                  }}
                  style={[styles.routePointRemoveBtn, !canRemove && styles.routePointRemoveBtnDisabled]}
                  testID={`route-point-remove-${String(p?.id ?? index)}`}
                />
              </View>
            );
          })}
        </View>
      )}

      {!validation.valid && <ValidationMessage type="error" messages={validation.errors} />}
      {validation.warnings.length > 0 && <ValidationMessage type="warning" messages={validation.warnings} />}
    </View>
  );
};

export default React.memo(FiltersPanelRouteSection);
