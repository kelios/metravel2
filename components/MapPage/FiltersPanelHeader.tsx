import React from 'react';
import { Text, View } from 'react-native';
import MapIcon from './MapIcon';
import RoutingStatus from '@/components/MapPage/RoutingStatus';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import type { ThemedColors } from '@/hooks/useTheme';

interface FiltersPanelHeaderProps {
  colors: ThemedColors;
  styles: any;
  isMobile: boolean;
  totalPoints: number;
  mode: 'radius' | 'route';
  radiusValue: string;
  onClose: () => void;
  onModeChange: (nextMode: 'radius' | 'route') => void;
  routingLoading?: boolean;
  routingError?: string | boolean | null;
  routeDistance: number | null;
  transportMode: 'car' | 'bike' | 'foot';
}

const FiltersPanelHeader: React.FC<FiltersPanelHeaderProps> = ({
  colors,
  styles,
  isMobile,
  totalPoints,
  mode,
  radiusValue,
  onClose,
  onModeChange,
  routingLoading,
  routingError,
  routeDistance,
  transportMode,
}) => {
  return (
    <View style={styles.stickyTop} testID="filters-panel-header">
      {isMobile && totalPoints > 0 && (
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleRow}>
            <MapIcon name="map" size={18} color={colors.primary} />
            <Text style={styles.compactTitle}>
              {totalPoints} {mode === 'radius' ? `мест • ${radiusValue || '60'} км` : 'мест'}
            </Text>
          </View>
          <IconButton
            icon={<MapIcon name="close" size={20} color={colors.textMuted} />}
            label="Закрыть"
            onPress={onClose}
            size="sm"
          />
        </View>
      )}
      <SegmentedControl
        options={[
          { key: 'radius', label: 'Радиус', icon: 'my-location' },
          { key: 'route', label: 'Маршрут', icon: 'alt-route' },
        ]}
        value={mode}
        onChange={(key) => onModeChange(key as 'radius' | 'route')}
        compact={isMobile}
        accessibilityLabel="Выбор режима поиска"
      />

      {mode === 'route' && (!!routingLoading || !!routingError || (routeDistance != null && routeDistance > 0)) && (
        <View style={styles.statusCard} testID="routing-status">
          <RoutingStatus
            isLoading={!!routingLoading}
            error={routingError || null}
            distance={routeDistance}
            transportMode={transportMode}
          />
        </View>
      )}
    </View>
  );
};

export default React.memo(FiltersPanelHeader);
