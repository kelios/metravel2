import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapIcon from './MapIcon';
import RouteBuilder from '@/components/MapPage/RouteBuilder';
import ValidationMessage from '@/components/MapPage/ValidationMessage';
import { RouteValidator } from '@/utils/routeValidator';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';

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
  routePoints?: RoutePoint[];
  onRemoveRoutePoint?: (id: string) => void;
  onClearRoute?: () => void;
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
  routePoints = [],
  onRemoveRoutePoint,
  onClearRoute,
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
          onClear={onClearRoute}
          compact
        />
      )}

      {mode === 'route' && routePoints.length > 2 && (
        <View style={styles.routePointsList} testID="route-points-list">
          {routePoints.slice(1, -1).map((p, index) => {
            const label = String(p?.address || '').trim() || `Точка ${index + 2}`;
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
