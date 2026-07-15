import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import type { ThemedColors } from '@/hooks/useTheme';
import { formatPlaces } from '@/utils/pluralize';
import { DEFAULT_RADIUS_KM, formatRadiusLabel } from '@/constants/mapConfig';
import { translate as i18nT } from '@/i18n'


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
      ? i18nT('map:components.MapPage.FiltersPanelHeader.value1_radius_value2_1c755c38', { value1: formatPlaces(totalPoints), value2: formatRadiusLabel(radiusValue || DEFAULT_RADIUS_KM) })
      : i18nT('map:components.MapPage.FiltersPanelHeader.otmette_na_karte_start_i_finish_2e7d3bff');
  const helper =
    mode === 'radius'
      ? ''
      : i18nT('map:components.MapPage.FiltersPanelHeader.snachala_vyberite_transport_zatem_dve_tochki_cffd2316');
  const showCompactDetails = !isMobile;
  const compactSummary =
    mode === 'radius'
      ? `${formatPlaces(totalPoints)} · ${formatRadiusLabel(radiusValue || DEFAULT_RADIUS_KM)}`
      : i18nT('map:components.MapPage.FiltersPanelHeader.start_i_finish_na_karte_ff77106b');

  return (
    <View style={styles.stickyTop} testID="filters-panel-header">
      {isMobile && (
        <View style={styles.compactMetaRow}>
          <View style={styles.compactMetaBadge}>
            <Feather
              name={mode === 'radius' ? 'target' : 'navigation'}
              size={12}
              color={colors.primaryDark}
            />
            <Text style={styles.compactMetaText} numberOfLines={1}>
              {compactSummary}
            </Text>
          </View>
          <IconButton
            icon={<Feather name="x" size={16} color={colors.textMuted} />}
            label={i18nT('map:components.MapPage.FiltersPanelHeader.zakryt_52463818')}
            onPress={onClose}
            size="sm"
            style={styles.compactMetaCloseButton}
          />
        </View>
      )}
      <SegmentedControl
        options={[
          { key: 'radius', label: i18nT('map:components.MapPage.FiltersPanelHeader.radius_997f6970'), icon: 'my-location' },
          { key: 'route', label: i18nT('map:components.MapPage.FiltersPanelHeader.marshrut_d5387756'), icon: 'alt-route' },
        ]}
        value={mode}
        onChange={(key) => onModeChange(key as 'radius' | 'route')}
        compact={isMobile}
        dense
        noOuterMargins
        tone={isMobile ? 'subtle' : 'default'}
        accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelHeader.vybor_rezhima_poiska_e0ed2ce4')}
      />
      {showCompactDetails && (
        <>
          <View style={styles.modeSummaryRow}>
            <Feather
              name={mode === 'radius' ? 'target' : 'navigation'}
              size={13}
              color={colors.primaryDark}
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
