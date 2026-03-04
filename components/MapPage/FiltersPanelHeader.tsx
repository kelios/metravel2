import React from 'react';
import { Text, View } from 'react-native';
import MapIcon from './MapIcon';
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
}) => {
  return (
    <View style={styles.stickyTop} testID="filters-panel-header">
      {totalPoints > 0 && (
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleRow}>
            <MapIcon name="map" size={18} color={colors.primary} />
            <Text style={styles.compactTitle}>
              {totalPoints} {mode === 'radius' ? `мест • ${radiusValue || '60'} км` : 'мест'}
            </Text>
          </View>
          {isMobile && (
            <IconButton
              icon={<MapIcon name="close" size={20} color={colors.textMuted} />}
              label="Закрыть"
              onPress={onClose}
              size="sm"
            />
          )}
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
        tone={isMobile ? 'subtle' : 'default'}
        accessibilityLabel="Выбор режима поиска"
      />
      {mode === 'radius' && (
        <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
          Попробуйте режим «Маршрут» для построения пути между точками
        </Text>
      )}
    </View>
  );
};

export default React.memo(FiltersPanelHeader);
