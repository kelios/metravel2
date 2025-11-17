// FiltersPanel.tsx
import React, {
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
  Dimensions,
} from 'react-native';
import MultiSelectField from '../MultiSelectField';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RadiusSelect from '@/components/MapPage/RadiusSelect';
import RoutePointControls from '@/components/MapPage/RoutePointControls';
import MapLegend from '@/components/MapPage/MapLegend';
import RouteStats from '@/components/MapPage/RouteStats';
import RouteHint from '@/components/MapPage/RouteHint';

const DEBOUNCE_MS = 300;

const COLORS = {
  bg: '#ffffff',
  card: '#f7f9fb',
  text: '#1b1f23',
  textMuted: '#667085',
  primary: '#2f7a7a',
  primarySoft: '#e6f2f2',
  border: '#e6e9ee',
  danger: '#ef5350',
  shadow: '#000',
};

const SEARCH_MODES = [
  { key: 'radius' as const, icon: 'my-location', label: 'Радиус' },
  { key: 'route' as const, icon: 'alt-route', label: 'Маршрут' },
];

const TRANSPORT_MODES = [
  { key: 'car' as const, icon: 'directions-car', label: 'Авто', emoji: '🚗' },
  { key: 'foot' as const, icon: 'directions-walk', label: 'Пешком', emoji: '🚶' },
  { key: 'bike' as const, icon: 'directions-bike', label: 'Велосипед', emoji: '🚴' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FiltersPanelProps {
  filters: {
    categories: { id: number; name: string }[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: string[];
    radius: string;
    address: string;
  };
  onFilterChange: (field: string, value: any) => void;
  resetFilters: () => void;
  travelsData: { categoryName?: string }[]; // Все данные для подсчета категорий
  filteredTravelsData?: { categoryName?: string }[]; // Отфильтрованные данные для отображения количества
  isMobile: boolean;
  closeMenu: () => void;
  mode: 'radius' | 'route';
  setMode: (m: 'radius' | 'route') => void;
  transportMode: 'car' | 'bike' | 'foot';
  setTransportMode: (m: 'car' | 'bike' | 'foot') => void;
  startAddress: string;
  endAddress: string;
  routeDistance: number | null;
  routePoints?: [number, number][];
  onRemoveRoutePoint?: (index: number) => void;
  onClearRoute?: () => void;
  routeHintDismissed?: boolean;
  onRouteHintDismiss?: () => void;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
                                                     filters,
                                                     filterValue,
                                                     onFilterChange,
                                                     resetFilters,
                                                     travelsData,
                                                     filteredTravelsData, // Отфильтрованные данные для отображения
                                                     isMobile,
                                                     closeMenu,
                                                     mode,
                                                     setMode,
                                                     transportMode,
                                                     setTransportMode,
                                                     startAddress,
                                                     endAddress,
                                                     routeDistance,
                                                     routePoints = [],
                                                     onRemoveRoutePoint,
                                                     onClearRoute,
                                                     routeHintDismissed = false,
                                                     onRouteHintDismiss,
                                                   }) => {
  const styles = useMemo(() => getStyles(isMobile), [isMobile]);

  // Компактная кнопка теперь внутри компонента — видит styles
  const CompactButton = React.useMemo(() => {
    return React.memo(({
                         onPress,
                         icon,
                         title,
                         color = COLORS.primary,
                         compact = false,
                         accessibilityLabel,
                       }: {
      onPress: () => void;
      icon: string;
      title?: string;
      color?: string;
      compact?: boolean;
      accessibilityLabel?: string;
    }) => (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title || icon}
        style={({ pressed }) => [
          styles.compactButton,
          { backgroundColor: color },
          pressed && { opacity: 0.9 },
          compact && styles.compactButtonSmall,
        ]}
        hitSlop={8}
      >
        <Icon name={icon} size={compact ? 16 : 18} color="#fff" />
        {title ? <Text style={styles.compactButtonText}>{title}</Text> : null}
      </Pressable>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles]); // зависимость — локальные styles

  // ——— Aggregations
  const travelCategoriesCount = useMemo(() => {
    const count: Record<string, number> = {};
    for (const t of travelsData) {
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
          // Safely handle cases where name might not be a string
          const name = typeof c?.name === 'string' ? c.name.trim() : String(c?.name || '').trim();
          if (!name) return null;
          const qty = travelCategoriesCount[name];
          if (!qty) return null;
          return {
            ...c,
            label: `${name} (${qty})`,
            value: name,
          };
        })
        .filter(Boolean) as { id: number; label: string; value: string }[],
    [filters.categories, travelCategoriesCount]
  );


  // ✅ ИСПРАВЛЕНИЕ: Удален неиспользуемый debounceTimer

  // ——— Handlers
  const handleSetMode = useCallback((m: 'radius' | 'route') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(m);
  }, [setMode]);

  const handleCategoryRemove = useCallback(
    (cat: string) => {
      onFilterChange('categories', filterValue.categories.filter((c) => c !== cat));
    },
    [filterValue.categories, onFilterChange]
  );

  const hasActiveFilters = useMemo(
    () => filterValue.categories.length > 0 || filterValue.radius !== '',
    [filterValue.categories.length, filterValue.radius]
  );

  return (
    <View style={styles.card}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>Фильтры</Text>
        <View style={styles.headerActions}>
          {hasActiveFilters && (
            <CompactButton
              onPress={resetFilters}
              icon="refresh"
              compact
              color={COLORS.danger}
              accessibilityLabel="Сбросить фильтры"
            />
          )}
          {isMobile && (
            <CompactButton
              onPress={closeMenu}
              icon="close"
              compact
              accessibilityLabel="Закрыть панель"
            />
          )}
        </View>
      </View>

      {/* Переключение режимов */}
      <View style={styles.modeTabs} accessibilityRole="tablist">
        {SEARCH_MODES.map(({ key, icon, label }) => {
          const active = mode === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.modeTab, active && styles.modeTabActive]}
              onPress={() => handleSetMode(key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon name={icon} size={18} color={active ? '#fff' : COLORS.textMuted} />
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Контент */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        {mode === 'radius' ? (
          <>
            {/* Категории */}
            {categoriesWithCount.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Категории</Text>
                <MultiSelectField
                  items={categoriesWithCount}
                  value={filterValue.categories}
                  onChange={(v) => onFilterChange('categories', v)}
                  labelField="label"
                  valueField="value"
                  placeholder="Выберите..."
                  compact
                  hideSelected
                />
                {filterValue.categories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsContainer}
                    contentContainerStyle={styles.chipsContent}
                  >
                    {filterValue.categories.slice(0, 5).map((cat) => (
                      <View key={cat} style={styles.categoryChip}>
                        <Text style={styles.categoryChipText} numberOfLines={1}>
                          {cat.split(' ')[0]}
                        </Text>
                        <Pressable onPress={() => handleCategoryRemove(cat)} hitSlop={8}>
                          <Icon name="close" size={14} color={COLORS.primary} />
                        </Pressable>
                      </View>
                    ))}
                    {filterValue.categories.length > 5 && (
                      <View style={styles.moreChip}>
                        <Text style={styles.moreChipText}>
                          +{filterValue.categories.length - 5}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Радиус */}
            {filters.radius.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Радиус поиска</Text>
                <RadiusSelect
                  value={filterValue.radius}
                  options={filters.radius}
                  onChange={(v) => onFilterChange('radius', v)}
                  compact
                />
              </View>
            )}
          </>
        ) : (
          <>
            {/* Транспорт */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Транспорт</Text>
              <View style={styles.transportTabs}>
                {TRANSPORT_MODES.map(({ key, label, emoji }) => {
                  const active = transportMode === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.transportTab, active && styles.transportTabActive]}
                      onPress={() => setTransportMode(key)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.transportEmoji}>{emoji}</Text>
                      <Text
                        style={[styles.transportTabText, active && styles.transportTabTextActive]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ✅ ОПТИМИЗАЦИЯ: Управление точками маршрута */}
            {routePoints.length > 0 && onRemoveRoutePoint && onClearRoute && (
              <RoutePointControls
                routePoints={routePoints}
                onRemovePoint={onRemoveRoutePoint}
                onClearRoute={onClearRoute}
              />
            )}

            {/* Информация о маршруте */}
            <View style={styles.routeInfo}>
              <View style={styles.routeItem}>
                <Text style={styles.routeLabel}>Старт:</Text>
                <Text style={styles.routeValue} numberOfLines={1}>
                  {startAddress || 'Не выбран'}
                </Text>
              </View>
              <View style={styles.routeItem}>
                <Text style={styles.routeLabel}>Финиш:</Text>
                <Text style={styles.routeValue} numberOfLines={1}>
                  {endAddress || 'Не выбран'}
                </Text>
              </View>
              {routeDistance != null && (
                <View style={styles.routeItem}>
                  <Text style={styles.routeLabel}>Дистанция:</Text>
                  <Text style={styles.routeDistance}>
                    {(routeDistance / 1000).toFixed(1)} км
                  </Text>
                </View>
              )}
            </View>

            {/* ✅ ИСПРАВЛЕНИЕ: Подсказка для режима маршрута - в боковой панели */}
            {mode === 'route' && !routeHintDismissed && onRouteHintDismiss && (
              <View style={styles.routeHintContainer}>
                <RouteHint
                  onDismiss={onRouteHintDismiss}
                  routePointsCount={routePoints.length}
                />
              </View>
            )}

            {/* ✅ РЕАЛИЗАЦИЯ: Статистика маршрута - используем отфильтрованные данные */}
            {mode === 'route' && routePoints.length >= 2 && routeDistance !== null && (
              <View style={styles.routeStatsContainer}>
                <RouteStats
                  distance={routeDistance}
                  pointsCount={(filteredTravelsData || travelsData).length}
                  mode={transportMode}
                />
              </View>
            )}
          </>
        )}

        {/* ✅ РЕАЛИЗАЦИЯ: Информация о найденных точках - показываем отфильтрованные данные */}
        {(filteredTravelsData || travelsData).length > 0 && (
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Icon name="place" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Найдено точек: <Text style={styles.infoBold}>
                  {(filteredTravelsData || travelsData).length}
                </Text>
              </Text>
            </View>
            {filterValue.radius && (
              <View style={styles.infoRow}>
                <Icon name="radio-button-unchecked" size={18} color={COLORS.textMuted} />
                <Text style={styles.infoText}>
                  Радиус поиска: <Text style={styles.infoBold}>{filterValue.radius} км</Text>
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ✅ ИСПРАВЛЕНИЕ: Легенда карты - внутри ScrollView после фильтров */}
        <MapLegend showRouteMode={mode === 'route'} />
      </ScrollView>

      {/* Быстрые действия (десктоп) */}
      {!isMobile && hasActiveFilters && (
        <View style={styles.footer}>
          <CompactButton
            onPress={resetFilters}
            icon="refresh"
            title="Сбросить"
            color={COLORS.danger}
          />
        </View>
      )}
    </View>
  );
};

// ——— Styles
const getStyles = (isMobile: boolean) => {
  const { width, height } = Dimensions.get('window');
  const panelWidth = isMobile ? Math.min(width - 24, 480) : 340;
  const panelMaxHeight = isMobile ? Math.round(height * 0.8) : 520;

  return StyleSheet.create({
    card: {
      backgroundColor: COLORS.bg,
      borderRadius: 14,
      padding: 12,
      width: panelWidth,
      maxWidth: '100%',
      flex: 1,
      shadowColor: COLORS.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 6,
      alignSelf: isMobile ? 'center' : 'flex-start',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text,
    },
    headerActions: {
      flexDirection: 'row',
    },
    modeTabs: {
      flexDirection: 'row',
      backgroundColor: '#f2f4f7',
      borderRadius: 10,
      padding: 4,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      paddingHorizontal: 10,
      marginHorizontal: 2,
    },
    modeTabActive: {
      backgroundColor: COLORS.primary,
    },
    modeTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textMuted,
      marginLeft: 6,
    },
    modeTabTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
      flexGrow: 1,
    },
    contentContainer: {
      paddingBottom: 8,
      flexGrow: 1,
    },
    section: {
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 6,
    },
    input: {
      height: 40,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: '#fbfcfe',
    },
    chipsContainer: {
      marginTop: 8,
    },
    chipsContent: {
      alignItems: 'center',
      paddingRight: 2,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      maxWidth: 112,
      marginRight: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.primary,
      flexShrink: 1,
      marginRight: 4,
    },
    moreChip: {
      backgroundColor: COLORS.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    moreChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.primary,
    },
    transportTabs: {
      flexDirection: 'row',
      backgroundColor: '#f2f4f7',
      borderRadius: 10,
      padding: 2,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    transportTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginHorizontal: 2,
      gap: 6,
    },
    transportTabActive: {
      backgroundColor: COLORS.primary,
    },
    transportEmoji: {
      fontSize: 18,
    },
    transportTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    transportTabTextActive: {
      color: '#fff',
    },
    routeInfo: {
      backgroundColor: COLORS.card,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    routeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    routeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textMuted,
      flex: 1,
    },
    routeValue: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.text,
      flex: 2,
      textAlign: 'right',
      marginLeft: 8,
    },
    routeDistance: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.primary,
    },
    compactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      minHeight: 36,
      marginLeft: 8,
    },
    compactButtonSmall: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      minHeight: 32,
    },
    compactButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
      marginLeft: 6,
    },
    footer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    infoBox: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    infoText: {
      fontSize: 13,
      color: COLORS.text,
      flex: 1,
    },
    infoBold: {
      fontWeight: '700',
      color: COLORS.primary,
    },
    routeHintContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
    routeStatsContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
  });
};

export default React.memo(FiltersPanel);
