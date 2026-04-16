import React, { useMemo, useCallback } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MultiSelectField from '@/components/forms/MultiSelectField';
import MapIcon from './MapIcon';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import MapSearchInput from '@/components/MapPage/MapSearchInput';
import type { ThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { CATEGORY_ICONS } from './MapQuickFilters';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`;
  return `${count} мест`;
};

interface FiltersPanelRadiusSectionProps {
  colors: ThemedColors;
  styles: any;
  isMobile: boolean;
  filters: {
    categories: CategoryOption[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: CategoryOption[];
    radius: string;
    address: string;
    searchQuery?: string;
  };
  travelsData: { categoryName?: string; name?: string; address?: string }[];
  onFilterChange: (field: string, value: any) => void;
}

const FiltersPanelRadiusSection: React.FC<FiltersPanelRadiusSectionProps> = ({
  colors,
  styles,
  isMobile,
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

  const searchQuery = filterValue.searchQuery || '';

  const handleSearchChange = useCallback(
    (value: string) => {
      safeOnFilterChange('searchQuery', value);
    },
    [safeOnFilterChange]
  );

  // Count results matching search query
  const searchResultsCount = useMemo(() => {
    if (!searchQuery.trim()) return undefined;
    const q = searchQuery.toLowerCase().trim();
    return travelsData.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const address = (t.address || '').toLowerCase();
      const category = (t.categoryName || '').toLowerCase();
      return name.includes(q) || address.includes(q) || category.includes(q);
    }).length;
  }, [searchQuery, travelsData]);

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
          const qty = travelCategoriesCount[name] || 0;
          if (qty === 0) return null;
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

  const selectedCategoriesCount = Array.isArray(filterValue.categories)
    ? filterValue.categories.length
    : 0;
  const selectedCategoryNames = useMemo(
    () =>
      (Array.isArray(filterValue.categories) ? filterValue.categories : [])
        .map((cat) => {
          if (typeof cat === 'string') return cat;
          if (cat && typeof cat === 'object' && 'value' in cat) return String((cat as any).value);
          if (cat && typeof cat === 'object' && 'name' in cat) return String((cat as any).name);
          return '';
        })
        .filter(Boolean),
    [filterValue.categories]
  );
  const radiusResultCount = useMemo(() => {
    if (selectedCategoryNames.length === 0) return travelsData.length;
    const normalizedSelected = new Set(selectedCategoryNames.map((name) => name.toLowerCase().trim()));

    return travelsData.filter((travel) => {
      const categoryNames = String(travel.categoryName || '')
        .split(',')
        .map((entry) => entry.toLowerCase().trim())
        .filter(Boolean);
      return categoryNames.some((categoryName) => normalizedSelected.has(categoryName));
    }).length;
  }, [selectedCategoryNames, travelsData]);
  const hasSelectionSummary = Boolean(searchQuery.trim()) || selectedCategoryNames.length > 0;
  const categoryPreview = selectedCategoryNames.slice(0, 2).join(', ');
  const categorySummary = selectedCategoryNames.length > 2
    ? `${categoryPreview} +${selectedCategoryNames.length - 2}`
    : categoryPreview;

  return (
    <>
      {/* Поиск — легкий блок */}
      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>1</Text>
          <Text style={styles.lightStepTitle}>Поиск</Text>
          {searchQuery.trim() ? (
            <Text style={styles.lightStepBadge}>Есть запрос</Text>
          ) : (
            <Text style={styles.lightStepHint}>Не задан</Text>
          )}
        </View>
        <MapSearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Поиск мест по названию..."
          resultsCount={searchResultsCount}
          testID="map-filters-search"
        />
      </View>

      {/* Категории + радиус — легкий блок */}
      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>2</Text>
          <Text style={styles.lightStepTitle}>Что посмотреть + радиус</Text>
          <Text style={selectedCategoriesCount > 0 ? styles.lightStepBadge : styles.lightStepHint}>
            {selectedCategoriesCount > 0 ? `${selectedCategoriesCount} выбрано` : 'Все типы'}
          </Text>
        </View>
        {categoriesWithCount.length > 0 && (
          <CollapsibleSection
            title="Что посмотреть"
            badge={selectedCategoriesCount || undefined}
            defaultOpen={false}
            icon="map-pin"
            tone="flat"
          >
            {!isMobile ? (
              <Text style={styles.sectionHint}>Уточните поиск по типу мест</Text>
            ) : null}
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
            {selectedCategoriesCount > 0 && (
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

                  const iconName = typeof catValue === 'string' ? CATEGORY_ICONS[catValue] : undefined;

                  return (
                    <View key={catKey} style={styles.categoryChip}>
                      {iconName && <Feather name={iconName} size={12} color={colors.primary} />}
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
                {selectedCategoriesCount > 5 && (
                  <View style={styles.moreChip}>
                    <Text style={styles.moreChipText}>+{selectedCategoriesCount - 5}</Text>
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
            tone="flat"
          >
            <View style={styles.radiusQuickOptions}>
              {filters.radius.map((opt) => {
                const selected = String(opt.id) === String(filterValue.radius);
                return (
                  <View key={opt.id}>
                    <Pressable
                      testID={`radius-option-${String(opt.id)}`}
                      onPress={() => safeOnFilterChange('radius', opt.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.name} км`}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.radiusOptionButton,
                        selected && styles.radiusOptionButtonSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusOptionText,
                          selected && styles.radiusOptionTextSelected,
                        ]}
                      >
                        {opt.name}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text style={styles.radiusSelectionHint}>
              {radiusResultCount > 0
                ? `${getPlacesLabel(radiusResultCount)} попадает в выбранные условия.`
                : 'Под выбранные условия пока ничего не попадает.'}
            </Text>

          </CollapsibleSection>
        )}

        {hasSelectionSummary && (
          <View style={styles.filterSelectionSummary} testID="radius-selection-summary">
            <View style={styles.filterSelectionChips}>
              {searchQuery.trim() ? (
                <View style={styles.filterSelectionChip}>
                  <Feather name="search" size={12} color={colors.primary} />
                  <Text style={styles.filterSelectionChipText} numberOfLines={1}>
                    {searchQuery.trim()}
                  </Text>
                </View>
              ) : null}
              {selectedCategoryNames.length > 0 ? (
                <View style={styles.filterSelectionChip}>
                  <Feather name="grid" size={12} color={colors.primary} />
                  <Text style={styles.filterSelectionChipText} numberOfLines={1}>
                    {categorySummary}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </>
  );
};

export default React.memo(FiltersPanelRadiusSection);
