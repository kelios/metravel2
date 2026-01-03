// FiltersPanel.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
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
import RoutePointControls from '@/components/MapPage/RoutePointControls';
import MapLegend from '@/components/MapPage/MapLegend';
import ValidationMessage from '@/components/MapPage/ValidationMessage';
import RoutingStatus from '@/components/MapPage/RoutingStatus';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import QuickActions from '@/components/MapPage/QuickActions';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import RouteBuilder from '@/components/MapPage/RouteBuilder';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import { RouteValidator } from '@/utils/routeValidator';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/src/types/mapUi';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';

// SEARCH_MODES теперь определены inline в SegmentedControl

const TRANSPORT_MODES = [
  { key: 'car' as const, icon: 'directions-car', label: 'Авто' },
  { key: 'foot' as const, icon: 'directions-walk', label: 'Пешком' },
  { key: 'bike' as const, icon: 'directions-bike', label: 'Велосипед' },
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
  swapStartEnd?: () => void;
  routeHintDismissed?: boolean;
  onRouteHintDismiss?: () => void;
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
  routingLoading?: boolean;
  routingError?: string | boolean | null;
  onBuildRoute?: () => void;
  mapUiApi?: MapUiApi | null;
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
                                                     swapStartEnd,
                                                     routeHintDismissed = false,
                                                     onRouteHintDismiss,
                                                     onAddressSelect,
                                                     routingLoading,
                                                     routingError,
                                                     onBuildRoute,
                                                     mapUiApi,
}) => {
  const windowWidth = Dimensions.get('window').width;
  const colors = useThemedColors();
  const styles = useMemo(
    () => getStyles(colors, isMobile, windowWidth) as any,
    [colors, isMobile, windowWidth],
  );
  const [legendOpen, setLegendOpen] = useState(false);
  const [hideNoPointsToast, setHideNoPointsToast] = useState(false);

  const canCenterOnUser = Boolean(mapUiApi?.capabilities?.canCenterOnUser);
  const canFitToResults = Boolean(mapUiApi?.capabilities?.canFitToResults);
  const canExportRoute = Boolean(mapUiApi?.capabilities?.canExportRoute);

  const [selectedBaseLayerId, setSelectedBaseLayerId] = useState<string>(
    WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled)?.id || WEB_MAP_BASE_LAYERS[0]?.id || 'osm'
  );
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const o of WEB_MAP_OVERLAY_LAYERS) {
      initial[o.id] = Boolean(o.defaultEnabled);
    }
    return initial;
  });

  useEffect(() => {
    if (!mapUiApi) return;
    try {
      mapUiApi.setBaseLayer(selectedBaseLayerId);
      for (const o of WEB_MAP_OVERLAY_LAYERS) {
        mapUiApi.setOverlayEnabled(o.id, Boolean(enabledOverlays[o.id]));
      }
    } catch {
      // noop
    }
  }, [mapUiApi, selectedBaseLayerId, enabledOverlays]);
  const increaseRadius = useCallback(() => {
    const options = filters.radius || [];
    const currentIdx = options.findIndex((opt) => String(opt.id) === String(filterValue.radius));
    const next = currentIdx >= 0 && currentIdx < options.length - 1 ? options[currentIdx + 1] : options[currentIdx] || options[options.length - 1];
    if (next?.id) onFilterChange('radius', next.id);
  }, [filters.radius, filterValue.radius, onFilterChange]);
  
  // ✅ NEW: Validate route points
  const validation = useMemo(() => {
    if (mode === 'route' && routePoints && routePoints.length > 0) {
      return RouteValidator.validate(routePoints);
    }
    return { valid: true, errors: [], warnings: [] };
  }, [mode, routePoints]);


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

  const _hasActiveFilters = useMemo(
    () => filterValue.categories.length > 0 || filterValue.radius !== '',
    [filterValue.categories.length, filterValue.radius]
  );

  const canBuildRoute = useMemo(
    () => mode === 'route' ? routePoints.length >= 2 : true,
    [mode, routePoints.length]
  );
  const ctaLabel = routingLoading
    ? 'Строим…'
    : routeDistance != null
      ? 'Пересчитать маршрут'
      : canBuildRoute
        ? 'Построить маршрут'
        : 'Добавьте старт и финиш';

  const totalPoints = useMemo(() => {
    const dataset = filteredTravelsData ?? travelsData;
    return Array.isArray(dataset) ? dataset.length : 0;
  }, [filteredTravelsData, travelsData]);

  // ——— UI helpers
  const routeStepState = {
    startSelected: !!routePoints[0],
    endSelected: !!routePoints[1],
  };

  const noPointsAlongRoute = mode === 'route' && routeDistance != null && (filteredTravelsData ?? travelsData).length === 0;

  // Автоскрытие подсказок после первого построенного маршрута
  useEffect(() => {
    if (routeDistance != null && !routeHintDismissed && onRouteHintDismiss) {
      onRouteHintDismiss();
    }
  }, [routeDistance, routeHintDismissed, onRouteHintDismiss]);

  return (
    <View style={styles.card} testID="filters-panel">
      {/* ✅ УЛУЧШЕНИЕ: Компактный header */}
      <View style={styles.stickyTop} testID="filters-panel-header">
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleRow}>
            <Icon name="map" size={18} color={colors.primary} />
            <Text style={styles.compactTitle}>
              {totalPoints} {mode === 'radius' ? `мест • ${filterValue.radius || '60'} км` : 'мест'}
            </Text>
          </View>
          {isMobile && (
            <Pressable
              testID="filters-panel-close-button"
              style={styles.closeButton}
              onPress={closeMenu}
              accessibilityRole="button"
              accessibilityLabel="Закрыть панель"
            >
              <Icon name="close" size={20} color={colors.text} />
            </Pressable>
          )}
        </View>

        {/* ✅ УЛУЧШЕНИЕ: Компактный SegmentedControl вместо больших табов */}
        <SegmentedControl
          options={[
            { key: 'radius', label: 'Радиус', icon: 'my-location' },
            { key: 'route', label: 'Маршрут', icon: 'alt-route' },
          ]}
          value={mode}
          onChange={(key) => handleSetMode(key as 'radius' | 'route')}
          accessibilityLabel="Выбор режима поиска"
        />

        {/* ✅ УЛУЧШЕНИЕ: RoutingStatus только в режиме маршрута и более компактный */}
        {mode === 'route' && (
          <View style={styles.statusCard} testID="routing-status">
            <RoutingStatus
              isLoading={!!routingLoading}
              error={routingError || null}
              distance={routeDistance}
              transportMode={transportMode}
            />
          </View>
        )}
      </View>

      {/* Контент */}
      <ScrollView
        testID="filters-panel-scroll"
        style={styles.content}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        {mode === 'radius' ? (
          <>
            {/* ✅ УЛУЧШЕНИЕ Фаза 2: Категории в CollapsibleSection */}
            {categoriesWithCount.length > 0 && (
              <CollapsibleSection
                title="Категории"
                badge={filterValue.categories.length || undefined}
                defaultOpen={filterValue.categories.length > 0}
                icon="category"
              >
                <Text style={styles.sectionHint}>Выберите подходящие тематики, чтобы сузить выдачу.</Text>
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
                            style={globalFocusStyles.focusable}
                            accessibilityRole="button"
                            accessibilityLabel="Удалить категорию"
                          >
                            <Icon name="close" size={16} color={colors.primary} />
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
              </CollapsibleSection>
            )}

            {/* ✅ УЛУЧШЕНИЕ Фаза 2: Радиус в CollapsibleSection */}
            {filters.radius.length > 0 && (
              <CollapsibleSection
                title="Радиус поиска"
                badge={`${filterValue.radius || '60'} км`}
                defaultOpen={true}
                icon="radio-button-unchecked"
              >
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
                          globalFocusStyles.focusable,
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
              </CollapsibleSection>
            )}
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Маршрут</Text>
              <Text style={styles.sectionHint}>Выберите старт и финиш на карте или через поиск, затем укажите транспорт.</Text>

              {/* ✅ УЛУЧШЕНИЕ Фаза 2: RouteBuilder вместо двух отдельных блоков */}
              {onAddressSelect && (
                <RouteBuilder
                  startAddress={startAddress}
                  endAddress={endAddress}
                  onAddressSelect={onAddressSelect}
                  onSwap={swapStartEnd}
                  onClear={onClearRoute}
                  compact={isMobile}
                />
              )}

              {/* Транспорт */}
              <View
                style={[
                  styles.section,
                  styles.sectionTight,
                  styles.transportSection,
                  !(routeStepState.startSelected && routeStepState.endSelected) && styles.sectionDisabled,
                ]}
              >
                <Text style={styles.sectionLabel}>Транспорт</Text>
                {!routeStepState.startSelected || !routeStepState.endSelected ? (
                  <Text style={styles.sectionHint}>Доступно после выбора старта и финиша</Text>
                ) : null}
                <View style={styles.transportTabs}>
                  {TRANSPORT_MODES.map(({ key, label, icon }) => {
                      const active = transportMode === key;
                      const disabledTransport = !(routeStepState.startSelected && routeStepState.endSelected);
                      return (
                        <Pressable
                          key={key}
                          style={[
                            styles.transportTab,
                            active && styles.transportTabActive,
                            disabledTransport && styles.transportTabDisabled,
                            globalFocusStyles.focusable,
                          ]}
                          onPress={() => {
                            if (disabledTransport) return;
                            setTransportMode(key);
                          }}
                          disabled={disabledTransport}
                          accessibilityRole="button"
                          accessibilityLabel={`Выбрать транспорт: ${TRANSPORT_MODES.find(m => m.key === key)?.label}`}
                          accessibilityState={{ selected: active, disabled: disabledTransport }}
                        >
                          <Icon
                            name={icon}
                            size={18}
                            color={active ? colors.textOnPrimary : colors.textMuted}
                            style={styles.transportIcon}
                          />
                          <Text
                            style={[
                              styles.transportTabText,
                              active && styles.transportTabTextActive,
                              disabledTransport && styles.transportTabTextDisabled,
                            ]}
                            accessibilityState={{ disabled: disabledTransport }}
                            accessibilityRole="text"
                            disabled={disabledTransport}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

              {/* ✅ Validation и warnings */}
              {!validation.valid && <ValidationMessage type="error" messages={validation.errors} />}
              {validation.warnings.length > 0 && <ValidationMessage type="warning" messages={validation.warnings} />}

              {noPointsAlongRoute && !hideNoPointsToast && (
                <View style={styles.noPointsToast} accessible accessibilityRole="text" testID="no-points-message">
                  <Text style={styles.noPointsTitle}>Маршрут построен</Text>
                  <Text style={styles.noPointsSubtitle}>
                    Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км.
                  </Text>
                  <View style={styles.noPointsActions}>
                    <Pressable
                      style={[styles.ctaButton, styles.ctaPrimary]}
                      onPress={increaseRadius}
                      accessibilityRole="button"
                      accessibilityLabel="Увеличить радиус"
                    >
                      <Text style={styles.ctaPrimaryText}>Увеличить радиус</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.ctaButton, styles.ctaOutline]}
                      onPress={() => setHideNoPointsToast(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Показать маршрут без точек"
                    >
                      <Text style={styles.ctaOutlineText}>Показать маршрут без точек</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ✅ RoutePointControls опционально, если нужен дополнительный контроль */}
              {routePoints.length > 0 && onRemoveRoutePoint && onClearRoute && (
                <RoutePointControls
                  routePoints={routePoints}
                  onRemovePoint={onRemoveRoutePoint}
                  onClearRoute={onClearRoute}
                />
              )}
            </View>
          </>
        )}

        {/* ✅ Аккордеон легенды */}
        <Pressable
          style={[styles.accordionHeader, globalFocusStyles.focusable]}
          onPress={() => setLegendOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Легенда карты"
          accessibilityState={{ expanded: legendOpen }}
        >
          <Text style={styles.accordionTitle}>Легенда карты</Text>
          <Icon name={legendOpen ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
        </Pressable>
        {legendOpen && <MapLegend showRouteMode={mode === 'route'} />}

        <CollapsibleSection title="Карта" icon="layers" defaultOpen={false}>
          <View style={styles.mapControlsRow}>
            <Pressable
              style={[styles.mapControlButton, globalFocusStyles.focusable, !mapUiApi && styles.mapControlDisabled]}
              onPress={() => mapUiApi?.zoomIn()}
              disabled={!mapUiApi}
              accessibilityRole="button"
              accessibilityLabel="Увеличить масштаб"
              accessibilityState={{ disabled: !mapUiApi }}
            >
              <Icon name="add" size={18} color={colors.text} />
              <Text style={styles.mapControlText}>Zoom +</Text>
            </Pressable>
            <Pressable
              style={[styles.mapControlButton, globalFocusStyles.focusable, !mapUiApi && styles.mapControlDisabled]}
              onPress={() => mapUiApi?.zoomOut()}
              disabled={!mapUiApi}
              accessibilityRole="button"
              accessibilityLabel="Уменьшить масштаб"
              accessibilityState={{ disabled: !mapUiApi }}
            >
              <Icon name="remove" size={18} color={colors.text} />
              <Text style={styles.mapControlText}>Zoom -</Text>
            </Pressable>
            <Pressable
              style={[
                styles.mapControlButton,
                globalFocusStyles.focusable,
                (!mapUiApi || !canCenterOnUser) && styles.mapControlDisabled,
              ]}
              onPress={() => {
                if (!mapUiApi || !canCenterOnUser) return;
                mapUiApi.centerOnUser();
              }}
              disabled={!mapUiApi || !canCenterOnUser}
              accessibilityRole="button"
              accessibilityLabel="Моё местоположение"
              accessibilityState={{ disabled: !mapUiApi || !canCenterOnUser }}
            >
              <Icon name="my-location" size={18} color={colors.text} />
              <Text style={styles.mapControlText}>Я</Text>
            </Pressable>
            <Pressable
              style={[
                styles.mapControlButton,
                globalFocusStyles.focusable,
                (!mapUiApi || !canFitToResults) && styles.mapControlDisabled,
              ]}
              onPress={() => mapUiApi?.fitToResults()}
              disabled={!mapUiApi || !canFitToResults}
              accessibilityRole="button"
              accessibilityLabel="Показать все результаты на карте"
              accessibilityState={{ disabled: !mapUiApi || !canFitToResults }}
            >
              <Icon name="zoom-out-map" size={18} color={colors.text} />
              <Text style={styles.mapControlText}>Все</Text>
            </Pressable>
          </View>

          {mode === 'route' ? (
            <View style={styles.mapControlsRow}>
              <Pressable
                style={[
                  styles.mapControlButton,
                  globalFocusStyles.focusable,
                  (!mapUiApi || !canBuildRoute || !canExportRoute) && styles.mapControlDisabled,
                ]}
                onPress={() => mapUiApi?.exportGpx()}
                disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
                accessibilityRole="button"
                accessibilityLabel="Скачать маршрут в формате GPX"
                accessibilityState={{ disabled: !mapUiApi || !canBuildRoute || !canExportRoute }}
              >
                <Icon name="download" size={18} color={colors.text} />
                <Text style={styles.mapControlText}>GPX</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.mapControlButton,
                  globalFocusStyles.focusable,
                  (!mapUiApi || !canBuildRoute || !canExportRoute) && styles.mapControlDisabled,
                ]}
                onPress={() => mapUiApi?.exportKml()}
                disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
                accessibilityRole="button"
                accessibilityLabel="Скачать маршрут в формате KML"
                accessibilityState={{ disabled: !mapUiApi || !canBuildRoute || !canExportRoute }}
              >
                <Icon name="download" size={18} color={colors.text} />
                <Text style={styles.mapControlText}>KML</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.mapLayersSection}>
            <Text style={styles.sectionLabel}>Слой карты</Text>
            <View style={styles.mapLayersRow}>
              {WEB_MAP_BASE_LAYERS.map((l) => {
                const active = selectedBaseLayerId === l.id;
                return (
                  <Pressable
                    key={l.id}
                    style={[
                      styles.layerChip,
                      active && styles.layerChipActive,
                      globalFocusStyles.focusable,
                      !mapUiApi && styles.mapControlDisabled,
                    ]}
                    onPress={() => {
                      setSelectedBaseLayerId(l.id);
                      mapUiApi?.setBaseLayer(l.id);
                    }}
                    disabled={!mapUiApi}
                    accessibilityRole="button"
                    accessibilityLabel={`Выбрать базовый слой: ${l.title}`}
                    accessibilityState={{ selected: active, disabled: !mapUiApi }}
                  >
                    <Text style={[styles.layerChipText, active && styles.layerChipTextActive]}>{l.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.mapLayersSection}>
            <Text style={styles.sectionLabel}>Оверлеи</Text>
            <View style={styles.mapLayersRow}>
              {WEB_MAP_OVERLAY_LAYERS.map((o) => {
                const enabled = Boolean(enabledOverlays[o.id]);
                return (
                  <Pressable
                    key={o.id}
                    style={[
                      styles.layerChip,
                      enabled && styles.layerChipActive,
                      globalFocusStyles.focusable,
                      !mapUiApi && styles.mapControlDisabled,
                    ]}
                    onPress={() => {
                      const next = !enabled;
                      setEnabledOverlays((prev) => ({ ...prev, [o.id]: next }));
                      mapUiApi?.setOverlayEnabled(o.id, next);
                    }}
                    disabled={!mapUiApi}
                    accessibilityRole="button"
                    accessibilityLabel={`${enabled ? 'Выключить' : 'Включить'} оверлей: ${o.title}`}
                    accessibilityState={{ selected: enabled, disabled: !mapUiApi }}
                  >
                    <Text style={[styles.layerChipText, enabled && styles.layerChipTextActive]}>
                      {o.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </CollapsibleSection>

        {/* ✅ УЛУЧШЕНИЕ: QuickActions для быстрого доступа */}
        <QuickActions
          onReset={_hasActiveFilters ? resetFilters : undefined}
          onFitBounds={totalPoints > 0 && mapUiApi ? () => mapUiApi.fitToResults() : undefined}
          totalPoints={totalPoints}
          hasFilters={_hasActiveFilters}
        />
      </ScrollView>

      {/* Sticky footer CTA */}
      <View style={styles.stickyFooter} testID="filters-panel-footer">
        {!canBuildRoute && mode === 'route' && (
          <Text style={styles.helperText}>
            Добавьте старт и финиш — кнопка «Построить маршрут» станет активной
          </Text>
        )}
        <View style={styles.footerButtons}>
          <Pressable
            testID="filters-reset-button"
            style={[
              styles.ctaButton,
              styles.ctaOutline,
              mode === 'route' && !routePoints.length && styles.ctaDisabled,
            ]}
            onPress={() => {
              if (mode === 'route' && !routePoints.length) return;
              resetFilters();
            }}
            disabled={mode === 'route' && !routePoints.length}
            accessibilityRole="button"
            accessibilityLabel="Сбросить"
            accessibilityState={{ disabled: mode === 'route' && !routePoints.length }}
          >
            <Text style={styles.ctaOutlineText}>Сбросить</Text>
          </Pressable>

          {onBuildRoute && mode === 'route' && (
            <Pressable
              testID="filters-build-route-button"
              style={[
                styles.ctaButton,
                styles.ctaPrimary,
                (!canBuildRoute || routingLoading) && styles.ctaDisabled,
              ]}
              onPress={() => {
                if (!canBuildRoute || routingLoading) return;
                onBuildRoute();
              }}
              disabled={!canBuildRoute || routingLoading}
              accessibilityRole="button"
              accessibilityLabel="Построить маршрут"
              accessibilityState={{ disabled: !canBuildRoute || routingLoading }}
            >
              <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

// ——— Styles
const getStyles = (colors: ThemedColors, isMobile: boolean, windowWidth: number) => {
  const panelWidth = isMobile ? Math.max(Math.min(windowWidth - 24, 480), 280) : '100%';
  const windowHeight = Dimensions.get('window').height;

  return (StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      width: panelWidth,
      maxWidth: '100%',
      height: '100%',
      maxHeight: windowHeight, // RN: maxHeight должен быть числом/DimensionValue, не CSS-строкой
      display: 'flex',
      flexDirection: 'column',
      shadowColor: (colors.shadows as any)?.shadowColor ?? DESIGN_TOKENS.shadowsNative.light.shadowColor,
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
    stickyTop: {
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backgroundColor: colors.surface,
            paddingTop: 4,
          } as any)
        : null),
    },
    // ✅ УЛУЧШЕНИЕ: Компактный header стили
    compactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    compactTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    compactTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: colors.surface,
      flexShrink: 0,
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
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      minHeight: 36,
    },
    headerActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    modeTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
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
    },
    modeTabActive: {
      backgroundColor: colors.primary,
    },
    modeTabTextCol: {
      marginLeft: 6,
      flex: 1,
    },
    modeTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    modeTabTextActive: {
      color: colors.textOnPrimary,
    },
    modeTabHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    modeTabHintActive: {
      color: colors.textOnPrimary,
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    counterBadge: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
    },
    counterLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
    counterHint: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    counterValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    modeHelper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    modeHelperText: {
      fontSize: 12,
      color: colors.textMuted,
      flex: 1,
    },
    content: {
      flex: 1,
      flexGrow: 1,
    },
    contentContainer: {
      paddingBottom: 100, // ✅ ИСПРАВЛЕНИЕ: Увеличен отступ снизу для прокрутки до конца
      flexGrow: 1,
    },
    section: {
      marginBottom: 12,
    },
    sectionCard: {
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 10,
      ...DESIGN_TOKENS.shadowsNative.light,
    },
    dualInputRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'stretch',
    },
    separator: {
      width: 1,
      backgroundColor: colors.border,
    },
    transportSection: {
      marginTop: 4,
    },
    sectionTight: {
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    input: {
      height: 40,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      ...DESIGN_TOKENS.shadowsNative.light,
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
      backgroundColor: colors.primarySoft,
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
      color: colors.primary,
      flexShrink: 1,
      marginRight: 4,
    },
    moreChip: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    moreChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
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
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      minHeight: 36, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    },
    radiusChipActive: {
      backgroundColor: colors.primarySoft,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    radiusChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    transportTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
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
    },
    transportTabActive: {
      backgroundColor: colors.primary,
    },
    transportIcon: {
      marginBottom: 4,
    },
    transportTabText: {
      fontSize: 13,
      fontWeight: '700', // ✅ УЛУЧШЕНИЕ: Увеличен вес шрифта для лучшей читаемости
      color: colors.text, // ✅ УЛУЧШЕНИЕ: Изменен цвет на более контрастный
    },
    transportTabTextActive: {
      color: colors.textOnPrimary,
      fontWeight: '800', // ✅ УЛУЧШЕНИЕ: Еще более жирный шрифт для активного состояния
    },
    routeInfo: {
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
      ...DESIGN_TOKENS.shadowsNative.light,
    },
    routeInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    routePill: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routePillLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 4,
    },
    routePillValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    routePillDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
    routeDistanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
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
      color: colors.textMuted,
      flex: 1,
    },
    routeValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      flex: 2,
      textAlign: 'right',
      marginLeft: 8,
    },
    routeDistance: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
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
    },
    compactButtonSmall: {
      paddingHorizontal: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      paddingVertical: 8, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
      minHeight: 36, // ✅ ИСПРАВЛЕНИЕ: Увеличена минимальная высота для touch-целей
    },
    compactButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
      marginLeft: 6,
    },
    footer: {
      marginTop: 8,
      paddingTop: 8,
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется отступ для разделения
    },
    infoBox: {
      backgroundColor: colors.primarySoft,
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
      color: colors.text,
      fontWeight: '700',
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    infoItem: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },
    infoBold: {
      fontWeight: '700',
      color: colors.primary,
    },
    routeHintContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
    routeStatsContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
    stepper: {
      marginTop: 4,
      marginBottom: 12,
      gap: 8,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepItemDone: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeStart: {
      backgroundColor: colors.success,
    },
    stepBadgeEnd: {
      backgroundColor: colors.danger,
    },
    stepBadgeTransport: {
      backgroundColor: colors.primary,
    },
    stepBadgeText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 12,
    },
    stepContent: {
      flex: 1,
      gap: 2,
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    stepSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    routeBuilt: {
      marginTop: 6,
      padding: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    routeBuiltTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: 4,
    },
    routeBuiltMeta: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    noPointsToast: {
      marginTop: 12,
      padding: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    noPointsTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    noPointsSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },
    noPointsActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    stepBlock: {
      padding: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      gap: 8,
    },
    stepHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepBlockTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    stepInlineHint: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '700',
    },
    addressToggle: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: 4,
    },
    addressToggleText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    sectionDisabled: {
      opacity: 0.6,
    },
    transportTabDisabled: {
      opacity: 0.5,
    },
    transportTabTextDisabled: {
      color: colors.textMuted,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    },
    actionGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      minHeight: 40,
    },
    actionGhostText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    statusCard: {
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderRadius: 10,
      padding: 10,
      ...DESIGN_TOKENS.shadowsNative.light,
    },
    swapButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    swapButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    accordionHeader: {
      marginTop: 4,
      marginBottom: 6,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accordionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },

    mapControlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    mapControlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mapControlDisabled: {
      opacity: 0.45,
    },
    mapControlText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    mapLayersSection: {
      marginTop: 12,
    },
    mapLayersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    layerChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: '100%',
    },
    layerChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    layerChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    layerChipTextActive: {
      color: colors.textOnPrimary,
    },
    stickyFooter: {
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            bottom: 0,
            backgroundColor: colors.surface,
            paddingTop: 8,
            paddingBottom: 4,
          } as any)
        : {
            paddingTop: 8,
          }),
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    ctaButton: {
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: Platform.OS === 'web' ? undefined : 1,
    },
    ctaOutline: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    ctaOutlineText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    ctaPrimary: {
      backgroundColor: colors.primary,
    },
    ctaPrimaryText: {
      color: colors.textOnPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    ctaDisabled: {
      opacity: 0.6,
    },
    helperText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
  }) as any);
};

export default React.memo(FiltersPanel);
