import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AddressSearch from '@/components/MapPage/AddressSearch';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';
import MapIcon from './MapIcon';
import IconButton from '@/components/ui/IconButton';
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
              onPress={onSwap}
              style={styles.swapActionButton}
            />
          )}
          {onClear && (
            <IconButton
              testID="route-clear"
              icon={<MapIcon name="close" size={compact ? 16 : 18} color={colors.textMuted} />}
              label={i18nT('map:components.MapPage.RouteBuilder.ochistit_marshrut_c7535487')}
              size={compact ? 'sm' : 'md'}
              onPress={onClear}
              style={styles.iconButton}
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

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  routeBuilder: {
    gap: compact ? 4 : 12,
  },
  iconButton: {
    width: compact ? 26 : 32,
    height: compact ? 26 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 13 : 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 0,
    borderColor: 'transparent',
    marginHorizontal: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
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
  swapActionButton: {
    width: compact ? 26 : 32,
    height: compact ? 26 : 32,
    borderRadius: compact ? 13 : 16,
    marginHorizontal: 0,
    backgroundColor: colors.primarySoft,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
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
