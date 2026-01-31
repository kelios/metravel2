import React, { useMemo, useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import MultiSelectField from '../MultiSelectField';
import MapIcon from './MapIcon';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import type { ThemedColors } from '@/hooks/useTheme';
import Chip from '@/components/ui/Chip';
import IconButton from '@/components/ui/IconButton';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

interface FiltersPanelRadiusSectionProps {
  colors: ThemedColors;
  styles: any;
  filters: {
    categories: CategoryOption[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: CategoryOption[];
    radius: string;
    address: string;
  };
  travelsData: { categoryName?: string }[];
  onFilterChange: (field: string, value: any) => void;
}

const FiltersPanelRadiusSection: React.FC<FiltersPanelRadiusSectionProps> = ({
  colors,
  styles,
  filters,
  filterValue,
  travelsData,
  onFilterChange,
}) => {
  const safeOnFilterChange = useCallback(
    (field: string, value: any) => {
      if (typeof onFilterChange !== 'function') return;
      onFilterChange(field, value);
    },
    [onFilterChange]
  );

  const travelCategoriesCount = useMemo(() => {
    const count: Record<string, number> = {};
    const dataset = Array.isArray(travelsData) ? travelsData : [];
    for (const t of dataset) {
      if (!t.categoryName) continue;
      t.categoryName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((cat) => {
          count[cat] = (count[cat] || 0) + 1;
        });
    }
    return count;
  }, [travelsData]);

  const categoriesWithCount = useMemo(
    () =>
      filters.categories
        .map((c) => {
          const name =
            typeof c === 'string'
              ? c.trim()
              : typeof c?.name === 'string'
                ? c.name.trim()
                : typeof c?.value === 'string'
                  ? c.value.trim()
                  : String(c || '').trim();
          if (!name) return null;
          const qty = travelCategoriesCount[name];
          if (!qty) return null;
          return {
            id: typeof c === 'object' && c !== null && 'id' in c ? (c as any).id || name : name,
            label: `${name} (${qty})`,
            value: name,
          };
        })
        .filter(Boolean) as { id: string | number; label: string; value: string }[],
    [filters.categories, travelCategoriesCount]
  );

  const handleCategoryRemove = useCallback(
    (cat: CategoryOption) => {
      const catValue =
        typeof cat === 'string'
          ? cat
          : cat && typeof cat === 'object' && 'value' in cat
            ? cat.value
            : cat && typeof cat === 'object' && 'name' in cat
              ? cat.name
              : String(cat || '');

      safeOnFilterChange(
        'categories',
        filterValue.categories.filter((c) => {
          if (typeof c === 'string') {
            return c !== catValue;
          } else if (c && typeof c === 'object') {
            const cValue = 'value' in c ? c.value : 'name' in c ? c.name : String(c || '');
            return cValue !== catValue;
          }
          return true;
        })
      );
    },
    [filterValue.categories, safeOnFilterChange]
  );

  return (
    <>
      {categoriesWithCount.length > 0 && (
        <CollapsibleSection
          title="Категории"
          badge={filterValue.categories.length || undefined}
          defaultOpen={filterValue.categories.length > 0}
          icon="grid"
        >
          <Text style={styles.sectionHint}>Выберите подходящие тематики, чтобы сузить выдачу.</Text>
          <MultiSelectField
            items={categoriesWithCount}
            value={(Array.isArray(filterValue.categories)
              ? filterValue.categories
                  .map((cat) => {
                    if (typeof cat === 'string') return cat;
                    if (cat && typeof cat === 'object' && 'value' in cat) return String((cat as any).value);
                    return null;
                  })
                  .filter((v): v is string => v !== null && v !== undefined)
              : []) as string[]}
            onChange={(v) => safeOnFilterChange('categories', v)}
            labelField="label"
            valueField="value"
            placeholder="Выберите..."
            compact
          />
          {filterValue.categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsContainer}
              contentContainerStyle={styles.chipsContent}
            >
              {filterValue.categories.slice(0, 5).map((cat) => {
                const catValue =
                  typeof cat === 'string'
                    ? cat
                    : cat && typeof cat === 'object' && 'name' in cat
                      ? cat.name
                      : String(cat || '');
                const catKey =
                  typeof cat === 'string'
                    ? cat
                    : cat && typeof cat === 'object' && 'id' in cat
                      ? String(cat.id)
                      : String(cat || '');
                const displayText = typeof catValue === 'string' ? catValue.split(' ')[0] : String(catValue || '');

                return (
                  <View key={catKey} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText} numberOfLines={1}>
                      {displayText}
                    </Text>
                    <IconButton
                      icon={<MapIcon name="close" size={16} color={colors.primary} />}
                      label="Удалить категорию"
                      size="sm"
                      onPress={() => handleCategoryRemove(cat)}
                      style={styles.categoryChipIconButton}
                    />
                  </View>
                );
              })}
              {filterValue.categories.length > 5 && (
                <View style={styles.moreChip}>
                  <Text style={styles.moreChipText}>+{filterValue.categories.length - 5}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </CollapsibleSection>
      )}

      {filters.radius.length > 0 && (
        <CollapsibleSection
          title="Радиус поиска"
          badge={`${filterValue.radius || DEFAULT_RADIUS_KM} км`}
          defaultOpen={true}
          icon="radio"
        >
          <View style={styles.radiusQuickOptions}>
            {filters.radius.map((opt) => {
              const selected = String(opt.id) === String(filterValue.radius);
              return (
                <View key={opt.id}>
                  <Chip
                    label={opt.name}
                    selected={selected}
                    onPress={() => safeOnFilterChange('radius', opt.id)}
                    testID={`radius-option-${String(opt.id)}`}
                  />
                </View>
              );
            })}
          </View>
        </CollapsibleSection>
      )}
    </>
  );
};

export default React.memo(FiltersPanelRadiusSection);
