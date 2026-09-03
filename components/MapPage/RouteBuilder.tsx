import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AddressSearch from '@/components/MapPage/AddressSearch';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';
import MapIcon from './MapIcon';
import IconButton, { ICON_BUTTON_TOUCH_TARGET_BY_SIZE } from '@/components/ui/IconButton';
import { translate as i18nT } from '@/i18n'


interface RouteBuilderProps {
  startAddress: string;
  endAddress: string;
  onAddressSelect: (address: string, coords: LatLng, isStart: boolean) => void;
  onAddressClear?: (isStart: boolean) => void;
  onSwap?: () => void;
  onClear?: () => void;
  compact?: boolean;
}

const RouteBuilder: React.FC<RouteBuilderProps> = ({
  startAddress,
  endAddress,
  onAddressSelect,
  onAddressClear,
  onSwap,
  onClear,
  compact = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, compact), [colors, compact]);

  // Видимый круг обеих кнопок ряда — один размер; тач-таргет даёт IconButton (#1739).
  const actionVisualSize = ACTION_VISUAL_SIZE(compact);

  const hasRoute = Boolean(startAddress && endAddress);
  const hasAnyAddress = Boolean(startAddress || endAddress);

  return (
    <View style={styles.routeBuilder} testID="route-builder">
      {hasAnyAddress && (
        <View style={styles.actionsRow}>
          {onSwap && hasRoute && (
            <IconButton
              testID="route-swap"
              icon={<MapIcon name="swap-vert" size={compact ? 16 : 18} color={colors.primaryDark} />}
              label={i18nT('map:components.MapPage.RouteBuilder.pomenyat_start_i_finish_mestami_1bd61586')}
              size={compact ? 'sm' : 'md'}
              visualSize={actionVisualSize}
              onPress={onSwap}
              visualStyle={styles.swapActionSurface}
            />
          )}
          {onClear && (
            <IconButton
              testID="route-clear"
              icon={<MapIcon name="close" size={compact ? 16 : 18} color={colors.textMuted} />}
              label={i18nT('map:components.MapPage.RouteBuilder.ochistit_marshrut_c7535487')}
              size={compact ? 'sm' : 'md'}
              visualSize={actionVisualSize}
              onPress={onClear}
              visualStyle={styles.clearActionSurface}
            />
          )}
        </View>
      )}

      <View style={styles.addressContainer}>
        <View style={styles.addressRow}>
          <View style={[styles.addressIcon, styles.startIcon]}>
            <MapIcon name="trip-origin" size={compact ? 14 : 16} color={colors.textOnDark} />
          </View>
          <View style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder={i18nT('map:components.MapPage.RouteBuilder.start_73c944ad')}
              value={startAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, true)}
              enableCoordinateInput
              onClear={() => onAddressClear?.(true)}
              dense={compact}
            />
          </View>
        </View>

        <View style={styles.connectorContainer}>
          <View style={styles.connectorLine} />
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.addressIcon, styles.endIcon]}>
            <MapIcon name="location-on" size={compact ? 14 : 16} color={colors.textOnDark} />
          </View>
          <View style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder={i18nT('map:components.MapPage.RouteBuilder.finish_693a48bc')}
              value={endAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, false)}
              enableCoordinateInput
              onClear={() => onAddressClear?.(false)}
              dense={compact}
            />
          </View>
        </View>
      </View>

      {!startAddress && (
        <Text style={styles.hint} testID="route-hint-start">
          {i18nT('map:components.MapPage.RouteBuilder.kosnites_karty_ili_vvedite_adres_starta_f1abce46')}</Text>
      )}
      {Boolean(startAddress) && !endAddress && (
        <Text style={styles.hint} testID="route-hint-end">
          {i18nT('map:components.MapPage.RouteBuilder.teper_vyberite_tochku_finisha_82361621')}</Text>
      )}
    </View>
  );
};

/**
 * Ряд действий держит вертикальный запас под рамку тач-таргета кнопок: рамка
 * IconButton в режиме `visualSize` вынесена в отрицательные поля, а на native
 * тап доходит до потомка только внутри границ родителя — без паддинга верхняя
 * и нижняя полоски рамки были бы мёртвыми (#1739, тот же эффект у
 * MapMobileTopOverlay). Видимые круги при этом не двигаются.
 */
const ACTION_VISUAL_SIZE = (compact: boolean) => (compact ? 26 : 32);
const actionFrameInset = (compact: boolean) =>
  (ICON_BUTTON_TOUCH_TARGET_BY_SIZE[compact ? 'sm' : 'md'] - ACTION_VISUAL_SIZE(compact)) / 2;

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  routeBuilder: {
    gap: compact ? 4 : 12,
  },
  // Видимые круги «очистить»/«поменять» прежние (26/32), тач-таргет — рамка
  // 44/48 самого IconButton в режиме `visualSize` (#1739); размер здесь не задаётся.
  clearActionSurface: {
    backgroundColor: colors.backgroundSecondary,
  },
  addressContainer: {
    gap: 0,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 8 : 12,
  },
  addressIcon: {
    width: compact ? 22 : 28,
    height: compact ? 22 : 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 11 : 14,
    zIndex: 2,
  },
  startIcon: {
    backgroundColor: colors.success,
  },
  endIcon: {
    backgroundColor: colors.danger,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: compact ? 4 : 8,
    marginBottom: compact ? 2 : 8,
    paddingVertical: actionFrameInset(compact),
  },
  addressInputWrapper: {
    flex: 1,
  },
  connectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: compact ? 8 : 16,
    marginLeft: compact ? 10 : 13,
    position: 'relative',
  },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: colors.borderLight,
    borderRadius: 1,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  swapActionSurface: {
    backgroundColor: colors.primarySoft,
  },
  hint: {
    fontSize: compact ? 10 : 11,
    color: colors.textMuted,
    fontStyle: 'normal',
    paddingHorizontal: compact ? 0 : 8,
    paddingTop: compact ? 2 : 0,
  },
});

export default React.memo(RouteBuilder);
