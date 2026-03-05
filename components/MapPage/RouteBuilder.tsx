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

  const progress = useMemo(() => {
    let step = 0;
    if (startAddress) step++;
    if (endAddress) step++;
    return `${step}/2`;
  }, [startAddress, endAddress]);

  const hasRoute = Boolean(startAddress && endAddress);
  const hasAnyAddress = Boolean(startAddress || endAddress);

  return (
    <SafeView style={styles.routeBuilder} testID="route-builder">
      {/* Progress header */}
      <SafeView style={styles.progressHeader}>
        <SafeView style={styles.progressInfo}>
          <MapIcon name="alt-route" size={18} color={colors.text} />
          <Text style={styles.progressText}>Маршрут {progress}</Text>
        </SafeView>
        <SafeView style={styles.progressActions}>
          {onSwap && hasRoute && (
            <IconButton
              testID="route-swap"
              icon={<MapIcon name="swap-vert" size={compact ? 16 : 18} color={colors.primary} />}
              label="Поменять старт и финиш местами"
              size={compact ? 'sm' : 'md'}
              onPress={onSwap}
              showTooltip={false}
              style={styles.swapActionButton}
            />
          )}
          {onClear && hasAnyAddress && (
            <IconButton
              testID="route-clear"
              icon={<MapIcon name="refresh" size={compact ? 16 : 18} color={colors.text} />}
              label="Очистить маршрут"
              size={compact ? 'sm' : 'md'}
              onPress={onClear}
              showTooltip={false}
              style={styles.iconButton}
            />
          )}
        </SafeView>
      </SafeView>

      {/* Address inputs */}
      <SafeView style={styles.addressContainer}>
        {/* Start address */}
        <SafeView style={styles.addressRow}>
          <SafeView style={styles.addressIcon}>
            <MapIcon name="trip-origin" size={compact ? 16 : 20} color={colors.success} />
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
          <SafeView style={styles.addressIcon}>
            <MapIcon name="location-on" size={compact ? 16 : 20} color={colors.danger} />
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
    gap: compact ? 4 : 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: compact ? 4 : 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 4 : 8,
  },
  progressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 4 : 6,
  },
  progressText: {
    fontSize: compact ? 13 : 14,
    fontWeight: '600',
    color: colors.text,
  },
  iconButton: {
    width: compact ? 24 : 32,
    height: compact ? 24 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 12 : 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    width: compact ? 24 : 32,
    height: compact ? 24 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 12 : 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  addressInputWrapper: {
    flex: 1,
  },
  connectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: compact ? 16 : 24,
    marginLeft: compact ? 11 : 15,
    position: 'relative',
  },
  connectorLine: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
    borderRadius: 1,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  swapActionButton: {
    width: compact ? 24 : 32,
    height: compact ? 24 : 32,
    borderRadius: compact ? 12 : 16,
    marginHorizontal: 0,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'normal',
    paddingHorizontal: compact ? 4 : 8,
  },
});

export default React.memo(RouteBuilder);
