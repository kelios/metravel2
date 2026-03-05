import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
  totalPoints: _totalPoints,
  mode,
  radiusValue: _radiusValue,
  onClose,
  onModeChange,
}) => {
  const summary = mode === 'radius' ? 'Радиусный режим' : 'Режим маршрута';

  return (
    <View style={styles.stickyTop} testID="filters-panel-header">
      {isMobile && (
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {summary}
          </Text>
          <IconButton
            icon={<Feather name="x" size={16} color={colors.textMuted} />}
            label="Закрыть"
            onPress={onClose}
            size="sm"
            style={styles.compactMetaCloseButton}
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
        dense
        noOuterMargins
        tone={isMobile ? 'subtle' : 'default'}
        accessibilityLabel="Выбор режима поиска"
      />
    </View>
  );
};

export default React.memo(FiltersPanelHeader);
