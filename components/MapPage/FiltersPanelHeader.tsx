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

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`;
  return `${count} мест`;
};

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
  const summary =
    mode === 'radius'
      ? `${getPlacesLabel(totalPoints)} · радиус ${radiusValue || '60'} км`
      : 'Старт и финиш можно выбрать кликом по карте';
  const helper =
    mode === 'radius'
      ? 'Фильтры применяются сразу, без отдельной кнопки'
      : 'Сначала выберите транспорт, затем две точки маршрута';

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
      <View style={styles.modeSummaryRow}>
        <Feather
          name={mode === 'radius' ? 'target' : 'navigation'}
          size={13}
          color={colors.primary}
        />
        <Text style={styles.modeSummaryText} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Text style={styles.modeSummaryHint} numberOfLines={isMobile ? 2 : 1}>
        {helper}
      </Text>
    </View>
  );
};

export default React.memo(FiltersPanelHeader);
