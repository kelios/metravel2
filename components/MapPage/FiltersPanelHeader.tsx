import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import type { ThemedColors } from '@/hooks/useTheme';
import { formatPlaces } from '@/utils/pluralize';

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
  const summary =
    mode === 'radius'
      ? `${formatPlaces(totalPoints)} · радиус ${radiusValue || '60'} км`
      : 'Отметьте на карте старт и финиш';
  const helper =
    mode === 'radius'
      ? ''
      : 'Сначала выберите транспорт, затем две точки маршрута';
  const showCompactDetails = !isMobile;
  const compactSummary =
    mode === 'radius'
      ? `${formatPlaces(totalPoints)} · ${radiusValue || '60'} км`
      : 'Старт и финиш — на карте';

  return (
    <View style={styles.stickyTop} testID="filters-panel-header">
      {isMobile && (
        <View style={styles.compactMetaRow}>
          <View style={styles.compactMetaBadge}>
            <Feather
              name={mode === 'radius' ? 'target' : 'navigation'}
              size={12}
              color={colors.primary}
            />
            <Text style={styles.compactMetaText} numberOfLines={1}>
              {compactSummary}
            </Text>
          </View>
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
      {showCompactDetails && (
        <>
          <View style={styles.modeSummaryRow}>
            <Feather
              name={mode === 'radius' ? 'target' : 'navigation'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.modeSummaryText} numberOfLines={2}>
              {summary}
            </Text>
          </View>
          {helper ? (
            <Text style={styles.modeSummaryHint} numberOfLines={2}>
              {helper}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

export default React.memo(FiltersPanelHeader);
