// components/trips/PublicTripFilters.tsx
// Компактные фильтры каталога публичных поездок (#411): место / тип / статус.
// Значения собираются из текущего набора поездок, чтобы не хардкодить справочники до BE.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type {
  PublicTrip,
  PublicTripStatus,
  PublicTripsFilters,
} from '@/api/publicTrips';
import { TRIP_STATUS_LABEL } from '@/components/trips/tripFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trips: PublicTrip[];
  value: PublicTripsFilters;
  onChange: (next: PublicTripsFilters) => void;
  hasActive?: boolean;
  onReset?: () => void;
}

type FilterKey = keyof PublicTripsFilters;
type FilterOption = {
  value: string;
  label: string;
};

const STATUS_ORDER: PublicTripStatus[] = ['open', 'full', 'completed'];

function uniq(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b, 'ru-RU'),
  );
}

function PublicTripFilters({ trips, value, onChange, hasActive, onReset }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);

  const regions = useMemo(() => uniq(trips.map((t) => t.region)), [trips]);
  const types = useMemo(() => uniq(trips.map((t) => t.tripType)), [trips]);

  const filters = useMemo(
    () => [
      {
        key: 'status' as const,
        label: 'Статус',
        placeholder: 'Статус: все',
        options: STATUS_ORDER.map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] })),
      },
      {
        key: 'region' as const,
        label: 'Место',
        placeholder: 'Место: все',
        options: regions.map((r) => ({ value: r, label: r })),
      },
      {
        key: 'tripType' as const,
        label: 'Тип',
        placeholder: 'Тип: любой',
        options: types.map((t) => ({ value: t, label: t })),
      },
    ],
    [regions, types],
  );

  const setFilter = (key: FilterKey, nextValue: string) => {
    onChange({ ...value, [key]: nextValue || undefined });
    setOpenKey(null);
  };

  const activeFilter = filters.find((item) => item.key === openKey);

  return (
    <View style={styles.wrap} testID="trip-filters">
      <View style={styles.row}>
        {filters.map((filter) => {
          const selectedValue = value[filter.key] ?? '';
          const selectedLabel =
            filter.options.find((option) => option.value === selectedValue)?.label ??
            filter.placeholder;
          return (
            <FilterSelect
              key={filter.key}
              label={filter.label}
              placeholder={filter.placeholder}
              value={selectedValue}
              displayValue={selectedLabel}
              options={filter.options}
              isOpen={openKey === filter.key}
              onOpen={() => setOpenKey(filter.key)}
              onClose={() => setOpenKey(null)}
              onChange={(next) => setFilter(filter.key, next)}
              colors={colors}
              styles={styles}
              testID={`trip-filter-${filter.key}`}
            />
          );
        })}

        {hasActive && onReset ? (
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel="Сбросить фильтры"
            style={styles.resetButton}
            testID="trip-filter-reset"
          >
            <Feather name="x" size={15} color={colors.primaryDark} />
            <Text style={styles.resetText}>Сбросить</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS !== 'web' && activeFilter ? (
        <Modal
          visible={!!activeFilter}
          transparent
          animationType="fade"
          onRequestClose={() => setOpenKey(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setOpenKey(null)}
              accessibilityRole="button"
              accessibilityLabel="Закрыть фильтры"
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{activeFilter.label}</Text>
                <Pressable
                  onPress={() => setOpenKey(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                  hitSlop={8}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
              </View>
              <FilterOptionRow
                label={activeFilter.placeholder}
                selected={!value[activeFilter.key]}
                onPress={() => setFilter(activeFilter.key, '')}
                colors={colors}
                styles={styles}
              />
              {activeFilter.options.map((option) => (
                <FilterOptionRow
                  key={option.value}
                  label={option.label}
                  selected={value[activeFilter.key] === option.value}
                  onPress={() => setFilter(activeFilter.key, option.value)}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

type FilterSelectProps = {
  label: string;
  placeholder: string;
  value: string;
  displayValue: string;
  options: FilterOption[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (next: string) => void;
  colors: ThemedColors;
  styles: ReturnType<typeof createStyles>;
  testID: string;
};

function FilterSelect({
  label,
  placeholder,
  value,
  displayValue,
  options,
  isOpen,
  onOpen,
  onClose,
  onChange,
  colors,
  styles,
  testID,
}: FilterSelectProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.selectWrap}>
        <select
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          aria-label={label}
          data-testid={testID}
          style={{
            minHeight: 42,
            width: '100%',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 14,
            fontWeight: 600,
            padding: '0 34px 0 12px',
            outlineStyle: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <View style={styles.selectWrap}>
      <Pressable
        onPress={isOpen ? onClose : onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue}`}
        style={styles.nativeSelect}
        testID={testID}
      >
        <Text
          style={[styles.nativeSelectText, value ? styles.nativeSelectTextActive : null]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

type FilterOptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemedColors;
  styles: ReturnType<typeof createStyles>;
};

function FilterOptionRow({
  label,
  selected,
  onPress,
  colors,
  styles,
}: FilterOptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.optionRow, selected && styles.optionRowSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected ? <Feather name="check" size={17} color={colors.primaryDark} /> : null}
    </Pressable>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { flexShrink: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    selectWrap: {
      width: 138,
    },
    nativeSelect: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    nativeSelectText: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    nativeSelectTextActive: { color: colors.text },
    resetButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    resetText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryDark,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 18,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '80%',
      borderRadius: 14,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...(colors.shadows?.heavy as object),
    },
    modalHeader: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    optionRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    optionRowSelected: { backgroundColor: colors.primarySoft },
    optionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    optionTextSelected: { color: colors.primaryDark },
  });

export default React.memo(PublicTripFilters);
