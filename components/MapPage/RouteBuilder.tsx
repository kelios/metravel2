// components/MapPage/RouteBuilder.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import AddressSearch from '@/components/MapPage/AddressSearch';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { LatLng } from '@/types/coordinates';

interface RouteBuilderProps {
  startAddress: string;
  endAddress: string;
  onAddressSelect: (address: string, coords: LatLng, isStart: boolean) => void;
  onSwap?: () => void;
  onClear?: () => void;
  compact?: boolean;
}

const RouteBuilder: React.FC<RouteBuilderProps> = ({
  startAddress,
  endAddress,
  onAddressSelect,
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
    <View style={styles.routeBuilder} testID="route-builder">
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressInfo}>
          <Icon name="alt-route" size={18} color={colors.text} />
          <Text style={styles.progressText}>Маршрут {progress}</Text>
        </View>
        {onClear && hasAnyAddress && (
          <Pressable
            testID="route-clear"
            onPress={onClear}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Очистить маршрут"
          >
            <Icon name="refresh" size={18} color={colors.text} />
          </Pressable>
        )}
      </View>

      {/* Address inputs */}
      <View style={styles.addressContainer}>
        {/* Start address */}
        <View style={styles.addressRow}>
          <View style={styles.addressIcon}>
            <Icon name="trip-origin" size={20} color={colors.success} />
          </View>
          <View style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder="Старт"
              value={startAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, true)}
              enableCoordinateInput
            />
          </View>
        </View>

        {/* Swap button */}
        {onSwap && hasRoute && (
          <View style={styles.swapContainer}>
            <Pressable
              testID="route-swap"
              onPress={onSwap}
              style={styles.swapButton}
              accessibilityRole="button"
              accessibilityLabel="Поменять старт и финиш местами"
            >
              <Icon name="swap-vert" size={20} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* End address */}
        <View style={styles.addressRow}>
          <View style={styles.addressIcon}>
            <Icon name="location-on" size={20} color={colors.danger} />
          </View>
          <View style={styles.addressInputWrapper}>
            <AddressSearch
              placeholder="Финиш"
              value={endAddress}
              onAddressSelect={(addr, coords) => onAddressSelect(addr, coords, false)}
              enableCoordinateInput
            />
          </View>
        </View>
      </View>

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
    </View>
  );
};

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  routeBuilder: {
    gap: compact ? 8 : 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: compact ? 6 : 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 6 : 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  iconButton: {
    width: compact ? 28 : 32,
    height: compact ? 28 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 14 : 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressContainer: {
    gap: compact ? 8 : 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 10 : 12,
  },
  addressIcon: {
    width: compact ? 28 : 32,
    height: compact ? 28 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 14 : 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressInputWrapper: {
    flex: 1,
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: compact ? -6 : -8,
  },
  swapButton: {
    width: compact ? 32 : 36,
    height: compact ? 32 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: compact ? 16 : 18,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: compact ? 4 : 8,
  },
});

export default RouteBuilder;

