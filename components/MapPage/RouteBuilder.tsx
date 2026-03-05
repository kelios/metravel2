// components/MapPage/RouteBuilder.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AddressSearch from '@/components/MapPage/AddressSearch';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';
import MapIcon from './MapIcon';
import IconButton from '@/components/ui/IconButton';

const SafeView: React.FC<React.ComponentProps<typeof View>> = ({ children, ...props }) => {
  return (
    <View {...props}>
      {React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
          return <Text key={index}>{child}</Text>;
        }
        return child;
      })}
    </View>
  );
};

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
    <SafeView style={styles.routeBuilder} testID="route-builder">
      {/* Action buttons - только когда есть адреса */}
      {hasAnyAddress && (
        <SafeView style={styles.actionsRow}>
          {onSwap && hasRoute && (
            <IconButton
              testID="route-swap"
              icon={<MapIcon name="swap-vert" size={compact ? 16 : 18} color={colors.primary} />}
              label="Поменять местами"
              size={compact ? 'sm' : 'md'}
              onPress={onSwap}
              showTooltip={false}
              style={styles.swapActionButton}
            />
          )}
          {onClear && (
            <IconButton
              testID="route-clear"
              icon={<MapIcon name="refresh" size={compact ? 16 : 18} color={colors.textMuted} />}
              label="Очистить"
              size={compact ? 'sm' : 'md'}
              onPress={onClear}
              showTooltip={false}
              style={styles.iconButton}
            />
          )}
        </SafeView>
      )}

      {/* Address inputs */}
      <SafeView style={styles.addressContainer}>
        {/* Start address */}
        <SafeView style={styles.addressRow}>
          <SafeView style={[styles.addressIcon, styles.startIcon]}>
            <MapIcon name="trip-origin" size={compact ? 14 : 16} color="#fff" />
          </SafeView>
          <SafeView style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder="Старт"
              value={startAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, true)}
              enableCoordinateInput
              onClear={() => onAddressClear?.(true)}
              dense={compact}
            />
          </SafeView>
        </SafeView>

        {/* Visual connector line between start and end */}
        <SafeView style={styles.connectorContainer}>
          <SafeView style={styles.connectorLine} />
        </SafeView>

        {/* End address */}
        <SafeView style={styles.addressRow}>
          <SafeView style={[styles.addressIcon, styles.endIcon]}>
            <MapIcon name="location-on" size={compact ? 14 : 16} color="#fff" />
          </SafeView>
          <SafeView style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder="Финиш"
              value={endAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, false)}
              enableCoordinateInput
              onClear={() => onAddressClear?.(false)}
              dense={compact}
            />
          </SafeView>
        </SafeView>
      </SafeView>

      {/* Hints */}
      {!startAddress && (
        <Text style={styles.hint} testID="route-hint-start">
          Кликните на карте или введите адрес старта
        </Text>
      )}
      {startAddress && !endAddress && (
        <Text style={styles.hint} testID="route-hint-end">
          Теперь выберите точку финиша
        </Text>
      )}
    </SafeView>
  );
};

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  routeBuilder: {
    gap: compact ? 6 : 12,
  },
  iconButton: {
    width: compact ? 28 : 32,
    height: compact ? 28 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 14 : 16,
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
    gap: compact ? 10 : 12,
  },
  addressIcon: {
    width: compact ? 24 : 28,
    height: compact ? 24 : 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 12 : 14,
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
    gap: compact ? 6 : 8,
    marginBottom: compact ? 4 : 8,
  },
  addressInputWrapper: {
    flex: 1,
  },
  connectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: compact ? 10 : 16,
    marginLeft: compact ? 11 : 13,
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
    width: compact ? 28 : 32,
    height: compact ? 28 : 32,
    borderRadius: compact ? 14 : 16,
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
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'normal',
    paddingHorizontal: compact ? 0 : 8,
    paddingTop: compact ? 4 : 0,
  },
});

export default React.memo(RouteBuilder);
