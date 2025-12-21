// FiltersPanel.tsx
import React, {
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
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
import AddressSearch from '@/components/MapPage/AddressSearch';
import ValidationMessage from '@/components/MapPage/ValidationMessage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import { RouteValidator } from '@/utils/routeValidator';

// ✅ ИСПРАВЛЕНИЕ: Используем единую палитру DESIGN_TOKENS вместо локальной COLORS
const COLORS = {
  bg: DESIGN_TOKENS.colors.surface,
  card: DESIGN_TOKENS.colors.mutedBackground,
  text: DESIGN_TOKENS.colors.text,
  textMuted: DESIGN_TOKENS.colors.textMuted,
  primary: DESIGN_TOKENS.colors.primary,
  primarySoft: DESIGN_TOKENS.colors.primarySoft,
  border: DESIGN_TOKENS.colors.border,
  danger: DESIGN_TOKENS.colors.danger,
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

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

interface FiltersPanelProps {
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
  routePoints?: RoutePoint[];
  onRemoveRoutePoint?: (id: string) => void;
  onClearRoute?: () => void;
  routeHintDismissed?: boolean;
  onRouteHintDismiss?: () => void;
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
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
                                                     onAddressSelect,
                                                   }) => {
  const windowWidth = Dimensions.get('window').width;
  const styles = useMemo(() => getStyles(isMobile, windowWidth), [isMobile, windowWidth]);
  
  // ✅ NEW: Validate route points
  const validation = useMemo(() => {
    if (mode === 'route' && routePoints && routePoints.length > 0) {
      return RouteValidator.validate(routePoints);
    }
    return { valid: true, errors: [], warnings: [] };
  }, [mode, routePoints]);

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
          globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
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
          // ✅ ИСПРАВЛЕНИЕ: Создаем чистый объект только с нужными полями, чтобы избежать рендеринга лишних свойств
          return {
            id: typeof c === 'object' && c !== null && 'id' in c ? (c as any).id || name : name,
            label: `${name} (${qty})`,
            value: name,
          };
        })
        .filter(Boolean) as { id: string | number; label: string; value: string }[],
    [filters.categories, travelCategoriesCount]
  );


  // ✅ ИСПРАВЛЕНИЕ: Удален неиспользуемый debounceTimer

  // ——— Handlers
  const handleSetMode = useCallback((m: 'radius' | 'route') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(m);
  }, [setMode]);

  const handleCategoryRemove = useCallback(
    (cat: CategoryOption) => {
      // ✅ ИСПРАВЛЕНИЕ: Обрабатываем случай, когда cat может быть объектом
      const catValue = typeof cat === 'string' 
        ? cat 
        : (cat && typeof cat === 'object' && 'value' in cat ? cat.value : (cat && typeof cat === 'object' && 'name' in cat ? cat.name : String(cat || '')));
      
      onFilterChange('categories', filterValue.categories.filter((c) => {
        if (typeof c === 'string') {
          return c !== catValue;
        } else if (c && typeof c === 'object') {
          const cValue = 'value' in c ? c.value : ('name' in c ? c.name : String(c || ''));
          return cValue !== catValue;
        }
        return true;
      }));
    },
    [filterValue.categories, onFilterChange]
  );

  const hasActiveFilters = useMemo(
    () => filterValue.categories.length > 0 || filterValue.radius !== '',
    [filterValue.categories.length, filterValue.radius]
  );

  return (
    <View style={styles.card}>
      {/* Заголовок - фиксированный */}
      <View style={styles.headerContainer}>
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
              <Pressable
                key={key}
                style={[
                  styles.modeTab, 
                  active && styles.modeTabActive,
                  globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                ]}
                onPress={() => handleSetMode(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Icon name={icon} size={18} color={active ? '#fff' : COLORS.textMuted} />
                <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
                  value={Array.isArray(filterValue.categories) 
                    ? filterValue.categories.map(cat => 
                        typeof cat === 'string' 
                          ? cat 
                          : (cat && typeof cat === 'object' && 'value' in cat ? cat.value : String(cat || ''))
                      )
                    : []}
                  onChange={(v: CategoryOption[]) => onFilterChange('categories', v)}
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
                    {filterValue.categories.slice(0, 5).map((cat) => {
                      // ✅ ИСПРАВЛЕНИЕ: Обрабатываем случай, когда cat может быть объектом с {id, name}
                      const catValue = typeof cat === 'string' 
                        ? cat 
                        : (cat && typeof cat === 'object' && 'name' in cat ? cat.name : String(cat || ''));
                      const catKey = typeof cat === 'string' 
                        ? cat 
                        : (cat && typeof cat === 'object' && 'id' in cat ? String(cat.id) : String(cat || ''));
                      const displayText = typeof catValue === 'string' ? catValue.split(' ')[0] : String(catValue || '');
                      
                      return (
                        <View key={catKey} style={styles.categoryChip}>
                          <Text style={styles.categoryChipText} numberOfLines={1}>
                            {displayText}
                          </Text>
                          <Pressable 
                            onPress={() => handleCategoryRemove(cat)} 
                            hitSlop={8}
                            style={globalFocusStyles.focusable} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            accessibilityRole="button"
                            accessibilityLabel="Удалить категорию"
                          >
                            {/* ✅ ИСПРАВЛЕНИЕ: Увеличен размер иконки */}
                            <Icon name="close" size={16} color={COLORS.primary} />
                          </Pressable>
                        </View>
                      );
                    })}
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
                <View style={styles.radiusQuickOptions}>
                  {filters.radius.map((opt) => {
                    const selected = String(opt.id) === String(filterValue.radius);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => onFilterChange('radius', opt.id)}
                        style={[
                          styles.radiusChip,
                          selected && styles.radiusChipActive,
                          globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Выбрать радиус: ${opt.name}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={styles.radiusChipText}>{opt.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Поиск адресов */}
            {onAddressSelect && (
              <View style={styles.section}>
                <AddressSearch
                  label="Точка старта"
                  placeholder="Введите адрес начала маршрута..."
                  value={startAddress}
                  onAddressSelect={(address, coords) => onAddressSelect(address, coords, true)}
                />
                <View style={{ height: 12 }} />
                <AddressSearch
                  label="Точка финиша"
                  placeholder="Введите адрес конца маршрута..."
                  value={endAddress}
                  onAddressSelect={(address, coords) => onAddressSelect(address, coords, false)}
                />
              </View>
            )}

            {/* ✅ NEW: Validation messages */}
            {!validation.valid && (
              <ValidationMessage type="error" messages={validation.errors} />
            )}
            {validation.warnings.length > 0 && (
              <ValidationMessage type="warning" messages={validation.warnings} />
            )}

            {/* Транспорт */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Транспорт</Text>
              <View style={styles.transportTabs}>
                {TRANSPORT_MODES.map(({ key, label, emoji }) => {
                  const active = transportMode === key;
                  return (
                    <Pressable
                      key={key}
                      style={[
                        styles.transportTab, 
                        active && styles.transportTabActive,
                        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                      ]}
                      onPress={() => setTransportMode(key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Выбрать транспорт: ${TRANSPORT_MODES.find(m => m.key === key)?.label}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.transportEmoji}>{emoji}</Text>
                      <Text
                        style={[styles.transportTabText, active && styles.transportTabTextActive]}
                      >
                        {label}
                      </Text>
                    </Pressable>
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
const getStyles = (isMobile: boolean, windowWidth: number) => {
  const panelWidth = isMobile ? Math.min(windowWidth - 24, 480) : 340;

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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    },
    headerContainer: {
      // Фиксированный контейнер для заголовка и табов
      marginBottom: 12,
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
      paddingHorizontal: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      marginHorizontal: 2,
      minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          // @ts-ignore
          ':hover': {
            backgroundColor: COLORS.primarySoft,
          },
        },
      }),
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: '#fbfcfe',
      shadowColor: '#1f1f1f',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    moreChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.primary,
    },
    radiusQuickOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    radiusChip: {
      paddingHorizontal: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      paddingVertical: 8, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
      backgroundColor: COLORS.card,
      minHeight: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          // @ts-ignore
          ':hover': {
            backgroundColor: COLORS.primarySoft,
          },
        },
      }),
    },
    radiusChipActive: {
      backgroundColor: COLORS.primarySoft,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    radiusChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.text,
    },
    transportTabs: {
      flexDirection: 'row',
      backgroundColor: '#f2f4f7',
      borderRadius: 10,
      padding: 2,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    transportTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      paddingHorizontal: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
      marginHorizontal: 2,
      gap: 6,
      minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          // @ts-ignore
          ':hover': {
            backgroundColor: COLORS.primarySoft,
          },
        },
      }),
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
      shadowColor: '#1f1f1f',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
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
      paddingHorizontal: 14, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      paddingVertical: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
      minHeight: 40, // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная высота для touch-целей
      marginLeft: 8,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          // @ts-ignore
          ':hover': {
            opacity: 0.9,
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    compactButtonSmall: {
      paddingHorizontal: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      paddingVertical: 8, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      minHeight: 36, // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная высота для touch-целей
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
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется отступ для разделения
    },
    infoBox: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
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
