// ListTravel.tsx
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    lazy,
    Suspense,
} from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    Platform,
    Pressable,
    NativeScrollEvent,
    NativeSyntheticEvent,
    RefreshControl,
    Animated,
    Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import FiltersComponent from "./FiltersComponent";
import RenderTravelItem from "./RenderTravelItem";
import SearchAndFilterBar from "./SearchAndFilterBar";
import ConfirmDialog from "../ConfirmDialog";
import UIButton from '@/components/ui/Button';
import HeroSection from "./HeroSection";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';

// Ленивая загрузка объединенного компонента с табами
// @ts-ignore - Dynamic imports are supported in runtime
const RecommendationsTabs = lazy(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        return new Promise<{ default: React.ComponentType<any> }>(resolve => {
            (window as any).requestIdleCallback(() => {
                // @ts-ignore
                import('./RecommendationsTabs').then(module => {
                    resolve(module);
                });
            }, { timeout: 2000 });
        });
    }
    // @ts-ignore
    return import('./RecommendationsTabs');
});

import { deleteTravel, fetchTravels } from "@/src/api/travelsApi";
import { fetchFilters, fetchFiltersCountry } from "@/src/api/misc";
import { Travel } from "@/src/types/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TravelListSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import CategoryChips from "@/components/CategoryChips";
import ActiveFiltersBadge from "./ActiveFiltersBadge";
import ProgressIndicator from "@/components/ProgressIndicator";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

// @ts-ignore - Dynamic imports are supported in runtime
const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

// ✅ АРХИТЕКТУРА: Импорт констант, типов, утилит и хуков
import { 
  PER_PAGE, 
  PERSONALIZATION_VISIBLE_KEY, 
  WEEKLY_HIGHLIGHTS_VISIBLE_KEY,
  RECOMMENDATIONS_VISIBLE_KEY,
  MAX_VISIBLE_CATEGORIES,
  FLATLIST_CONFIG,
  FLATLIST_CONFIG_MOBILE,
} from "./utils/listTravelConstants";
import { useListTravelVisibility } from "./hooks/useListTravelVisibility";
import { useListTravelFilters } from "./hooks/useListTravelFilters";
import { useListTravelData } from "./hooks/useListTravelData";
import { useListTravelExport } from "./hooks/useListTravelExport";
import { calculateColumns, isMobile as checkIsMobile, calculateCategoriesWithCount } from "./utils/listTravelHelpers";
import type { FilterState } from "./utils/listTravelTypes";

// ✅ УЛУЧШЕНИЕ: Улучшенный skeleton для рекомендаций
const RecommendationsPlaceholder = () => (
  <View style={styles.recommendationsLoader}>
    <View style={styles.recommendationsSkeleton}>
      <View style={styles.recommendationsSkeletonHeader}>
        <View style={styles.recommendationsSkeletonTitle} />
        <View style={styles.recommendationsSkeletonTabs} />
      </View>
      <View style={styles.recommendationsSkeletonContent}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.recommendationsSkeletonCard} />
        ))}
      </View>
    </View>
  </View>
);

const pluralizeTravels = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'путешествие';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'путешествия';
  return 'путешествий';
};

/* ===== Small local component: Export bar ===== */
export const ExportBar = memo(function ExportBar({
                       isMobile,
                       selectedCount,
                       allCount,
                       onToggleSelectAll,
                       onClearSelection,
                       onPreview,
                       onSave,
                       onSettings,
                       isGenerating,
                       progress,
                       settingsSummary,
                       hasSelection,
                   }: {
    isMobile: boolean;
    selectedCount: number;
    allCount: number;
    onToggleSelectAll: () => void;
    onClearSelection: () => void;
    onPreview: () => void;
    onSave: () => void;
    onSettings: () => void;
    isGenerating?: boolean;
    progress?: number;
    settingsSummary: string;
    hasSelection: boolean;
}) {
    const selectionText = selectedCount
      ? `Выбрано ${selectedCount} ${pluralizeTravels(selectedCount)}`
      : 'Выберите путешествия для экспорта';

    return (
      <View style={styles.exportBar}>
          <View style={styles.exportBarInfo}>
            <Text style={styles.exportBarInfoTitle}>{selectionText}</Text>
            <Text style={styles.exportBarInfoSubtitle}>
              {hasSelection ? `Настройки: ${settingsSummary}` : 'Выберите хотя бы одно путешествие, чтобы включить кнопки'}
            </Text>
            <View style={styles.exportBarInfoActions}>
              <Pressable onPress={onToggleSelectAll} accessibilityRole="button">
                <Text style={styles.linkButton}>
                  {selectedCount === allCount && allCount > 0 ? "Снять выделение" : "Выбрать все"}
                </Text>
              </Pressable>
              {hasSelection && (
                <Pressable onPress={onClearSelection} accessibilityRole="button">
                  <Text style={styles.linkButton}>Очистить выбор</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={[styles.exportBarButtons, isMobile && styles.exportBarButtonsMobile]}>
            <UIButton
              label={isGenerating ? `Генерация... ${progress || 0}%` : (isMobile ? "Сохранить PDF" : "Сохранить PDF")}
              onPress={onSave}
              disabled={!hasSelection || isGenerating}
            />
          </View>

          {isGenerating && Platform.OS === "web" && (
            <View style={styles.progressWrapper}>
              <ProgressIndicator
                progress={progress ?? 0}
                stage={(progress ?? 0) < 30 ? 'Подготовка данных...' : 
                       (progress ?? 0) < 60 ? 'Генерация содержимого...' :
                       (progress ?? 0) < 90 ? 'Обработка изображений...' : 
                       'Создание PDF...'}
                message={(progress ?? 0) < 30 ? 'Проверка выбранных путешествий' :
                         (progress ?? 0) < 60 ? 'Формирование макета' :
                         (progress ?? 0) < 90 ? 'Оптимизация изображений' :
                         'Финальная обработка'}
                showPercentage={true}
              />
            </View>
          )}
      </View>
    );
});

const MemoizedFilters = memo(FiltersComponent);
const MemoizedTravelItem = memo(RenderTravelItem);

interface ListTravelProps {
    onTogglePersonalization?: () => void;
    onToggleWeeklyHighlights?: () => void;
    isPersonalizationVisible?: boolean;
    isWeeklyHighlightsVisible?: boolean;
}

function ListTravel({
    onTogglePersonalization,
    onToggleWeeklyHighlights,
    isPersonalizationVisible: externalPersonalizationVisible,
    isWeeklyHighlightsVisible: externalWeeklyHighlightsVisible,
}: ListTravelProps = {}) {
    // ✅ АРХИТЕКТУРА: Использование кастомного хука для видимости
    const {
        isPersonalizationVisible,
        isWeeklyHighlightsVisible,
        isInitialized,
        handleTogglePersonalization,
        handleToggleWeeklyHighlights,
    } = useListTravelVisibility({
        externalPersonalizationVisible,
        externalWeeklyHighlightsVisible,
        onTogglePersonalization,
        onToggleWeeklyHighlights,
    });

    const { width } = useWindowDimensions();
    const route = useRoute();
    const router = useRouter();

    const params = useLocalSearchParams<{ user_id?: string }>();
    const user_id = params.user_id;

    const isMeTravel = (route as any).name === "metravel";
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export";

    const isMobile = checkIsMobile(width);
    const columns = useMemo(() => {
        // ✅ ОПТИМИЗАЦИЯ: Используем оптимизированную функцию расчета колонок
        return calculateColumns(width);
    }, [width]);

    const listKey = useMemo(() => `grid-${columns}`, [columns]);

    const [recommendationsReady, setRecommendationsReady] = useState(Platform.OS !== 'web');
    const [isRecommendationsVisible, setIsRecommendationsVisible] = useState<boolean>(false);
    const [recommendationsVisibilityInitialized, setRecommendationsVisibilityInitialized] = useState(false);

    // ✅ ИСПРАВЛЕНИЕ: Загружаем сохраненное состояние видимости рекомендаций
    useEffect(() => {
        const loadRecommendationsVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    const saved = sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
                    // По умолчанию на web не показываем блок рекомендаций, пока пользователь явно не включит его.
                    // Если сохранено 'true' или любой другой непустой флаг, считаем, что пользователь уже включал блок.
                    if (saved === 'true') {
                        setIsRecommendationsVisible(true);
                        setRecommendationsReady(true);
                    } else {
                        setIsRecommendationsVisible(false);
                    }
                } else {
                    const saved = await AsyncStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
                    // На native оставляем прежний дефолт: если явно не выключено, считаем видимым.
                    if (saved === 'false') {
                        setIsRecommendationsVisible(false);
                    } else {
                        setIsRecommendationsVisible(true);
                        setRecommendationsReady(true);
                    }
                }
            } catch (error) {
                console.error('Error loading recommendations visibility:', error);
            } finally {
                setRecommendationsVisibilityInitialized(true);
            }
        };
        
        loadRecommendationsVisibility();
    }, []);

    // ✅ ИСПРАВЛЕНИЕ: Сохраняем состояние видимости рекомендаций при изменении и запускаем ленивую загрузку блока
    const handleRecommendationsVisibilityChange = useCallback((visible: boolean) => {
        setIsRecommendationsVisible(visible);

        // При первом включении рекомендаций инициируем загрузку тяжёлого блока
        if (visible && !recommendationsReady) {
            setRecommendationsReady(true);
        }
        
        // Сохраняем в storage
        const saveVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    // На web явно сохраняем "true" / "false", чтобы различать включенный и выключенный блок.
                    sessionStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
                } else {
                    if (visible) {
                        await AsyncStorage.removeItem(RECOMMENDATIONS_VISIBLE_KEY);
                    } else {
                        await AsyncStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, 'false');
                    }
                }
            } catch (error) {
                console.error('Error saving recommendations visibility:', error);
            }
        };
        
        saveVisibility();
    }, [recommendationsReady]);

    const queryClient = useQueryClient();

    /* Auth flags: используем AuthContext, который уже учитывает наличие токена */
    const { userId, isSuperuser: isSuper } = useAuth();

    /* Top-bar state */
    const [search, setSearch] = useState("");
    const debSearch = useDebouncedValue(search, 400);

    const onMomentumRef = useRef(false);
    const lastEndReachedAtRef = useRef<number>(0);
    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollOffsetRef = useRef<number>(0);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    /* Filters options */
    const { data: rawOptions } = useQuery({
        queryKey: ["filter-options"],
        queryFn: async () => {
            const [base, countries] = await Promise.all([
                fetchFilters(),
                fetchFiltersCountry(),
            ]);
            return { ...base, countries };
        },
        staleTime: 10 * 60 * 1000,
    });

    // ✅ ИСПРАВЛЕНИЕ: Преобразуем данные из API в формат FilterOptions
    const options = useMemo((): import('./utils/listTravelTypes').FilterOptions | undefined => {
        if (!rawOptions) return undefined;
        
        const transformed: import('./utils/listTravelTypes').FilterOptions = {
            countries: rawOptions.countries || [],
        };

        // Преобразуем строковые массивы в объекты с id и name
        const stringArrayFields = ['categories', 'categoryTravelAddress', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay'] as const;
        
        stringArrayFields.forEach(field => {
            const value = (rawOptions as any)[field];
            if (Array.isArray(value) && value.length > 0) {
                // ✅ ИСПРАВЛЕНИЕ: Обрабатываем как строки, так и объекты
                (transformed as any)[field] = value.map((item: any) => {
                    // Если уже объект с id и name, возвращаем как есть
                    if (typeof item === 'object' && item !== null && 'id' in item && 'name' in item) {
                        return item;
                    }
                    // Если строка, создаем объект
                    return {
                        id: String(item),
                        name: String(item),
                    };
                });
            } else if (Array.isArray(value) && value.length === 0) {
                // ✅ ИСПРАВЛЕНИЕ: Сохраняем пустые массивы
                (transformed as any)[field] = [];
            }
        });

        return transformed;
    }, [rawOptions]);

    const {
        filter,
        queryParams,
        resetFilters,
        onSelect,
        applyFilter,
        handleToggleCategory,
    } = useListTravelFilters({
        options,
        isMeTravel,
        isExport,
        isTravelBy,
        userId,
        user_id,
    });


    const isQueryEnabled = useMemo(
      () => (isMeTravel || isExport ? !!userId : true),
      [isMeTravel, isExport, userId]
    );

    // Если для страницы требуется конкретный пользователь ("Мои путешествия" или экспорт),
    // то до загрузки userId блокируем основной запрос.
    const isUserIdLoading = (isMeTravel || isExport) && !userId;
    
    const {
        data: travels,
        total,
        hasMore,
        isLoading,
        isFetching,
        isError,
        status,
        isInitialLoading,
        isNextPageLoading,
        isEmpty,
        refetch,
        handleEndReached,
        handleRefresh,
        isRefreshing,
    } = useListTravelData({
        queryParams,
        search: debSearch,
        isQueryEnabled,
    });

    const categoriesWithCount = useMemo(
      () => calculateCategoriesWithCount(travels, options?.categories as any).slice(0, MAX_VISIBLE_CATEGORIES),
      [travels, options?.categories]
    );

    /* Delete */
    const handleDelete = useCallback(async () => {
        if (!deleteId) return;
        try {
            await deleteTravel(String(deleteId));
            setDelete(null);
            queryClient.invalidateQueries({ queryKey: ["travels"] });
            // ✅ УЛУЧШЕНИЕ: Показываем успешное сообщение
            if (Platform.OS === 'web') {
                // Можно добавить Toast здесь, если нужно
            }
        } catch (error) {
            // ✅ BUG-002: Обработка ошибок при удалении
            // ✅ UX-001: Улучшенные сообщения об ошибках
            let errorMessage = 'Не удалось удалить путешествие.';
            let errorDetails = 'Попробуйте позже.';
            
            if (error instanceof Error) {
                if (error.message.includes('timeout') || error.message.includes('время ожидания')) {
                    errorMessage = 'Превышено время ожидания';
                    errorDetails = 'Проверьте подключение к интернету и попробуйте снова.';
                } else if (error.message.includes('network') || error.message.includes('сеть')) {
                    errorMessage = 'Проблема с подключением';
                    errorDetails = 'Проверьте подключение к интернету и попробуйте снова.';
                } else if (error.message.includes('404') || error.message.includes('не найдено')) {
                    errorMessage = 'Путешествие не найдено';
                    errorDetails = 'Возможно, оно уже было удалено.';
                } else if (error.message.includes('403') || error.message.includes('доступ')) {
                    errorMessage = 'Нет доступа';
                    errorDetails = 'У вас нет прав для удаления этого путешествия.';
                } else {
                    errorDetails = error.message;
                }
            }
            
            if (Platform.OS === 'web') {
                alert(`${errorMessage}\n\n${errorDetails}`);
            } else {
                // Для мобильных используем Alert из react-native
                Alert.alert(errorMessage, errorDetails);
            }
            // Не закрываем диалог при ошибке, чтобы пользователь мог попробовать снова
        }
    }, [deleteId, queryClient]);

    /* Selection for export */
    const exportState = useListTravelExport(travels, { ownerName: userId });
    const {
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        isSelected,
        hasSelection,
        selectionCount,
        pdfExport,
        lastSettings,
        handleSaveWithSettings,
        handlePreviewWithSettings,
        settingsSummary,
    } = exportState;

    const selectionLabel = hasSelection
      ? `Выбрано ${selectionCount} ${pluralizeTravels(selectionCount)}`
      : 'Выберите путешествия для экспорта';
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsModalMode, setSettingsModalMode] = useState<'save' | 'preview'>('save');

    /* Render item */
    const renderItem = useCallback(
      ({ item, index }: any) => (
        <MemoizedTravelItem
          item={item}
          index={index}
          isMobile={isMobile}
          isSuperuser={isSuper}
          isMetravel={isMeTravel}
          onDeletePress={setDelete}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={isSelected(item.id)}
          onToggle={() => toggleSelect(item)}
        />
      ),
      [isMobile, isSuper, isMeTravel, isExport, isSelected, toggleSelect]
    );

    const keyExtractor = useCallback((item: any) => String(item.id), []);

    // ✅ ОПТИМИЗАЦИЯ: Динамическая конфигурация виртуализации на основе устройства
    const listVirtualization = useMemo(() => {
      const config = isMobile ? FLATLIST_CONFIG_MOBILE : FLATLIST_CONFIG;
      
      // Адаптируем под количество колонок
      const initial = Math.max(config.INITIAL_NUM_TO_RENDER, columns * 2);
      const batch = Math.max(config.MAX_TO_RENDER_PER_BATCH, columns * 3);
      const window = config.WINDOW_SIZE;
      
      return {
        initial,
        batch,
        window,
        updateCellsBatchingPeriod: config.UPDATE_CELLS_BATCHING_PERIOD,
      };
    }, [columns, isMobile]);

    /* Loading helpers */
    const hasAnyItems = travels.length > 0;
    
    const showInitialLoading = isInitialLoading || isUserIdLoading;
    const showNextPageLoading = isNextPageLoading;
    const showEmptyState = !isUserIdLoading && isEmpty;

    const handleListEndReached = useCallback(() => {
        if (onMomentumRef.current) return;
        if (!hasAnyItems) return; // ✅ FIX: Без элементов не запускаем пагинацию, чтобы не пропускать первую страницу фильтра

        const now = Date.now();
        // Простая защита от слишком частых вызовов onEndReached на web/мобильных
        if (now - lastEndReachedAtRef.current < 800) {
            return;
        }
        lastEndReachedAtRef.current = now;

        handleEndReached();
    }, [handleEndReached, hasAnyItems]);

    const onMomentumBegin = useCallback(() => {
        onMomentumRef.current = false;
    }, []);
    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
        if (contentSize.height <= layoutMeasurement.height * 1.05) {
            onMomentumRef.current = true;
        }
        if (Platform.OS === 'web') {
            const offsetY = contentOffset.y;
            scrollY.setValue(offsetY);
            lastScrollOffsetRef.current = offsetY;
            try {
                window.sessionStorage.setItem('travel-list-scroll', String(offsetY));
            } catch (error) {}
        }
    }, [scrollY]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!flatListRef.current) return;
        try {
            const stored = window.sessionStorage.getItem('travel-list-scroll');
            if (!stored) return;
            const value = Number(stored);
            if (!Number.isFinite(value) || value <= 0) return;
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: value, animated: false });
            });
        } catch (error) {}
    }, [flatListRef]);

    const displayData = travels;

    // ✅ UX УЛУЧШЕНИЕ: Подсчитываем количество активных фильтров
    const activeFiltersCount = useMemo(() => {
      let count = 0;
      
      if (filter.categories && filter.categories.length > 0) {
        count += filter.categories.length;
      }
      if (filter.transports && filter.transports.length > 0) {
        count += filter.transports.length;
      }
      if (filter.categoryTravelAddress && filter.categoryTravelAddress.length > 0) {
        count += filter.categoryTravelAddress.length;
      }
      if (filter.companions && filter.companions.length > 0) {
        count += filter.companions.length;
      }
      if (filter.complexity && filter.complexity.length > 0) {
        count += filter.complexity.length;
      }
      if (filter.month && filter.month.length > 0) {
        count += filter.month.length;
      }
      if (filter.over_nights_stay && filter.over_nights_stay.length > 0) {
        count += filter.over_nights_stay.length;
      }
      if (filter.year) {
        count += 1;
      }
      if (filter.moderation !== undefined) {
        count += 1;
      }
      if (debSearch && debSearch.trim().length > 0) {
        count += 1;
      }
      
      return count;
    }, [filter, debSearch]);

    // ✅ UX УЛУЧШЕНИЕ: Генерируем красивое сообщение для пустого состояния
    const getEmptyStateMessage = useMemo(() => {
      if (!showEmptyState) return null;
      
      const activeFilters: string[] = [];

      // Определяем активные фильтры
      if (filter.categories && filter.categories.length > 0) {
        const categoryNames = (options?.categories || [])
          .filter((cat: any) => filter.categories?.includes(cat.id))
          .map((cat: any) => cat.name)
          .slice(0, 2);
        if (categoryNames.length > 0) {
          activeFilters.push(`категории "${categoryNames.join('", "')}"${categoryNames.length < (filter.categories?.length || 0) ? ' и другие' : ''}`);
        }
      }
      
      if (filter.transports && filter.transports.length > 0) {
        const transportNames = (options?.transports || [])
          .filter((t: any) => {
            const transportId = String(t.id);
            return filter.transports?.some((fid: any) => String(fid) === transportId);
          })
          .map((t: any) => t.name)
          .slice(0, 2);
        if (transportNames.length > 0) {
          activeFilters.push(`транспорт "${transportNames.join('", "')}"${transportNames.length < (filter.transports?.length || 0) ? ' и другой' : ''}`);
        }
      }
      
      if (filter.categoryTravelAddress && filter.categoryTravelAddress.length > 0) {
        const objectNames = (options?.categoryTravelAddress || [])
          .filter((obj: any) => {
            const objId = String(obj.id);
            return filter.categoryTravelAddress?.some((fid: any) => String(fid) === objId);
          })
          .map((obj: any) => obj.name)
          .slice(0, 2);
        if (objectNames.length > 0) {
          activeFilters.push(`объекты "${objectNames.join('", "')}"${objectNames.length < (filter.categoryTravelAddress?.length || 0) ? ' и другие' : ''}`);
        }
      }
      
      if (filter.companions && filter.companions.length > 0) {
        activeFilters.push('спутники');
      }
      
      if (filter.complexity && filter.complexity.length > 0) {
        activeFilters.push('сложность');
      }
      
      if (filter.month && filter.month.length > 0) {
        activeFilters.push('месяц');
      }
      
      if (filter.over_nights_stay && filter.over_nights_stay.length > 0) {
        activeFilters.push('ночлег');
      }
      
      if (filter.year) {
        activeFilters.push(`год ${filter.year}`);
      }

      if (debSearch) {
        activeFilters.push(`поиск "${debSearch}"`);
      }

      if (activeFilters.length === 0) {
        return {
          icon: 'inbox',
          title: 'Пока нет путешествий',
          description: 'Путешествия появятся здесь, когда будут добавлены.',
          variant: 'empty' as const,
        };
      }

      // Формируем красивое описание
      let description = '';
      if (activeFilters.length === 1) {
        description = `По фильтру ${activeFilters[0]} ничего не найдено.`;
      } else if (activeFilters.length === 2) {
        description = `По фильтрам ${activeFilters[0]} и ${activeFilters[1]} ничего не найдено.`;
      } else {
        const lastFilter = activeFilters[activeFilters.length - 1];
        const otherFilters = activeFilters.slice(0, -1).join(', ');
        description = `По фильтрам ${otherFilters} и ${lastFilter} ничего не найдено.`;
      }

      description += ' Попробуйте изменить параметры поиска или выбрать другие фильтры.';

      return {
        icon: 'search',
        title: 'Ничего не найдено',
        description,
        variant: 'search' as const,
      };
    }, [showEmptyState, filter, options, debSearch]);

    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Сайдбар с фильтрами (только на десктопе) */}
            {!isMobile && (
              <View style={styles.sidebar}>
                {/* Фильтры без поиска */}
                <MemoizedFilters
                  filters={options || {}}
                  filterValue={filter}
                  onSelectedItemsChange={onSelect}
                  handleApplyFilters={(newFilter: FilterState) => applyFilter(newFilter)}
                  resetFilters={resetFilters}
                  isSuperuser={isSuper}
                  closeMenu={undefined}
                  search={undefined}
                  setSearch={undefined}
                  onToggleRecommendations={undefined}
                  isRecommendationsVisible={undefined}
                  hasFilters={Object.keys(queryParams).length > 0}
                  resultsCount={total}
                  onClearAll={() => {
                    setSearch('');
                    resetFilters();
                  }}
                />
              </View>
            )}

            {/* Основной контент */}
            <View style={styles.main}>
              {/* Поиск для веб-версии - в основном контенте, как на картинке */}
              {!isMobile && (
                <View style={styles.searchSectionMain}>
                  <SearchAndFilterBar
                    search={search}
                    setSearch={setSearch}
                    onToggleFilters={undefined}
                    onToggleRecommendations={() => handleRecommendationsVisibilityChange(!isRecommendationsVisible)}
                    isRecommendationsVisible={isRecommendationsVisible}
                    hasFilters={Object.keys(queryParams).length > 0}
                    resultsCount={total}
                    activeFiltersCount={activeFiltersCount}
                    onClearAll={() => {
                      setSearch('');
                      resetFilters();
                    }}
                  />
                </View>
              )}

              {/* Поиск для мобильной версии */}
              {isMobile && (
                <View style={styles.searchSection}>
                  <SearchAndFilterBar
                    search={search}
                    setSearch={setSearch}
                    onToggleFilters={() => setShowFilters(true)}
                    onToggleRecommendations={() => handleRecommendationsVisibilityChange(!isRecommendationsVisible)}
                    isRecommendationsVisible={isRecommendationsVisible}
                    hasFilters={Object.keys(queryParams).length > 0}
                    resultsCount={total}
                    activeFiltersCount={activeFiltersCount}
                    onClearAll={() => {
                      setSearch('');
                      resetFilters();
                    }}
                  />
                </View>
              )}

              {/* Скелетон загрузки */}
              {showInitialLoading && (
                <TravelListSkeleton count={PER_PAGE} />
              )}

              {/* Ошибка */}
              {isError && (
                <EmptyState
                  icon="alert-circle"
                  title="Ошибка загрузки"
                  description="Не удалось загрузить путешествия."
                  variant="error"
                  action={{
                    label: "Повторить",
                    onPress: () => refetch(),
                  }}
                />
              )}

              {/* Список путешествий */}
              <FlatList
                key={listKey}
                ref={flatListRef}
                data={displayData}
                extraData={displayData.length}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                numColumns={columns}
                columnWrapperStyle={columns > 1 ? { 
                    gap: isMobile ? spacing.sm : spacing.md, // ✅ АДАПТИВНОСТЬ: Меньше gap на мобильных
                    justifyContent: 'flex-start',
                } : undefined}
                contentContainerStyle={[
                  styles.listContent,
                  isMobile && styles.listContentMobile, // ✅ АДАПТИВНОСТЬ: Отдельные стили для мобильных
                ]}
                onEndReached={handleListEndReached}
                onEndReachedThreshold={isMobile ? FLATLIST_CONFIG_MOBILE.ON_END_REACHED_THRESHOLD : FLATLIST_CONFIG.ON_END_REACHED_THRESHOLD}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onMomentumScrollBegin={onMomentumBegin}
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                  showEmptyState && getEmptyStateMessage ? (
                    <EmptyState
                      icon={getEmptyStateMessage.icon}
                      title={getEmptyStateMessage.title}
                      description={getEmptyStateMessage.description}
                      variant={getEmptyStateMessage.variant}
                      action={
                        (debSearch || Object.keys(queryParams).length > 0) ? {
                          label: activeFiltersCount > 0 ? `Сбросить фильтры (${activeFiltersCount})` : "Сбросить фильтры",
                          onPress: () => {
                            setSearch('');
                            resetFilters();
                          },
                        } : undefined
                      }
                    />
                  ) : null
                }
                ListFooterComponent={
                  showNextPageLoading ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator size="small" />
                    </View>
                  ) : null
                }
                ListHeaderComponent={
                  !isMeTravel && !isExport ? (
                    <View>
                      {/* Рекомендации */}
                      {isRecommendationsVisible === true && recommendationsVisibilityInitialized && recommendationsReady && (
                        <Suspense fallback={<RecommendationsPlaceholder />}>
                          <RecommendationsTabs 
                            onVisibilityChange={handleRecommendationsVisibilityChange}
                          />
                        </Suspense>
                      )}

                      {/* Категории */}
                      {categoriesWithCount.length > 0 && (
                        <View style={styles.categoriesSectionMain}>
                          <Text style={styles.categoriesTitle}>Популярные категории</Text>
                          <CategoryChips
                            categories={categoriesWithCount}
                            selectedCategories={filter.categories || []}
                            onToggleCategory={handleToggleCategory}
                            maxVisible={isMobile ? 6 : 8}
                            showIcons={!isMobile}
                          />
                        </View>
                      )}
                    </View>
                  ) : null
                }
                initialNumToRender={listVirtualization.initial}
                maxToRenderPerBatch={listVirtualization.batch}
                windowSize={listVirtualization.window}
                updateCellsBatchingPeriod={listVirtualization.updateCellsBatchingPeriod}
                removeClippedSubviews={Platform.OS !== 'web'}
                getItemLayout={Platform.OS !== 'web' ? undefined : (data, index) => ({
                  length: isMobile ? 320 : 360,
                  offset: (isMobile ? 320 : 360) * index,
                  index,
                })}
              />
            </View>
          </View>
        </View>

            {/* Модальное окно фильтров для мобильной версии */}
        {isMobile && (
          <Modal
            visible={showFilters}
            animationType="slide"
            onRequestClose={() => setShowFilters(false)}
          >
            <MemoizedFilters
              filters={options || {}}
              filterValue={filter}
              onSelectedItemsChange={onSelect}
              handleApplyFilters={(newFilter: FilterState) => {
                applyFilter(newFilter);
                setShowFilters(false);
              }}
              resetFilters={resetFilters}
              isSuperuser={isSuper}
              closeMenu={() => setShowFilters(false)}
              search={search}
              setSearch={setSearch}
              onToggleRecommendations={() => handleRecommendationsVisibilityChange(!isRecommendationsVisible)}
              isRecommendationsVisible={isRecommendationsVisible}
              hasFilters={Object.keys(queryParams).length > 0}
              resultsCount={total}
              onClearAll={() => {
                setSearch('');
                resetFilters();
              }}
            />
          </Modal>
        )}

          <ConfirmDialog
            visible={!!deleteId}
            onClose={() => setDelete(null)}
            onConfirm={handleDelete}
            title="Удаление"
            message="Удалить это путешествие?"
          />

          {isExport && Platform.OS === 'web' && (
            <ExportBar
              isMobile={isMobile}
              selectedCount={selectionCount}
              allCount={displayData.length}
              onToggleSelectAll={toggleSelectAll}
              onClearSelection={clearSelection}
              onPreview={() => {
                setSettingsModalMode('preview');
                setShowSettingsModal(true);
              }}
              onSave={() => {
                setSettingsModalMode('save');
                setShowSettingsModal(true);
              }}
              onSettings={() => {
                setSettingsModalMode('save');
                setShowSettingsModal(true);
              }}
              isGenerating={pdfExport.isGenerating}
              progress={pdfExport.progress}
              settingsSummary={settingsSummary}
              hasSelection={hasSelection}
            />
          )}

          {/* Модальное окно настроек фотоальбома (только web) */}
          {isExport && Platform.OS === "web" && (
            <Suspense fallback={null}>
              <BookSettingsModalLazy
                visible={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onSave={handleSaveWithSettings}
                onPreview={handlePreviewWithSettings}
                defaultSettings={lastSettings}
                travelCount={selectionCount}
                userName={userId || undefined}
                mode={settingsModalMode}
              />
            </Suspense>
          )}

          {/* ✅ УЛУЧШЕНИЕ: Кнопка "Наверх" для длинных страниц */}
          {Platform.OS === 'web' && (
            <ScrollToTopButton
              flatListRef={flatListRef}
              scrollY={scrollY}
              threshold={400}
            />
          )}
      </SafeAreaView>
    );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
	root: { 
		flex: 1, 
		// Прозрачный фон: даём глобальной карте из RootLayout мягко просвечивать
		backgroundColor: 'transparent',
	},
    container: {
        flex: 1,
        ...(Platform.OS === "web" && { alignItems: "stretch" }),
    },
    content: {
        flex: 1,
        flexDirection: Platform.select({ 
            ios: 'column',
            android: 'column',
            web: 'row',
            default: 'column',
        }),
    },
    sidebar: {
        width: Platform.select({ 
            ios: '100%',
            android: '100%',
            web: '260px', // ✅ ОПТИМИЗАЦИЯ: Уменьшено для большего пространства контента
            default: '100%',
        }) as any,
        backgroundColor: palette.surface,
        borderRightWidth: Platform.select({ 
            ios: StyleSheet.hairlineWidth,
            android: StyleSheet.hairlineWidth,
            web: 1,
            default: 0,
        }),
        borderColor: palette.border,
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.soft,
                position: "sticky" as any,
                top: 0,
                alignSelf: "flex-start",
                maxHeight: "100vh" as any,
                paddingTop: spacing.sm,
                overflowY: "auto" as any,
                zIndex: 10,
            },
        }),
    },
    main: {
        flex: 1,
        backgroundColor: 'transparent',
        ...Platform.select({
            default: {
                paddingHorizontal: spacing.xs, // ✅ ОПТИМИЗАЦИЯ: Меньше отступы на мобильных
                paddingTop: spacing.xs,
                paddingBottom: 0,
            },
            web: {
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: 0,
            },
        }),
        ...(Platform.OS === "web" && {
            maxWidth: 1200, // ✅ ОПТИМИЗАЦИЯ: Уменьшено для лучшей читаемости (3 колонки)
            marginHorizontal: "auto" as any,
            width: "100%",
        }),
    },
    searchSection: {
        marginTop: Platform.select({
            ios: 0,
            android: 0,
            web: spacing.md,
            default: 0,
        }),
        marginBottom: Platform.select({
            ios: spacing.xs,
            android: spacing.xs,
            web: spacing.lg,
            default: spacing.xs,
        }),
        paddingHorizontal: Platform.select({
            ios: 0,
            android: 0,
            web: 0,
            default: 0,
        }),
    },
    searchSectionMain: {
        marginBottom: spacing.md, // ✅ ОПТИМИЗАЦИЯ: Добавлен отступ для лучшего разделения
        paddingHorizontal: 0,
    },
    // ✅ ДИЗАЙН: Секция категорий с улучшенными отступами
    categoriesSectionMain: {
        marginTop: Platform.select({
            default: spacing.xs, // ✅ ОПТИМИЗАЦИЯ: Меньше отступ на мобильных
            web: spacing.md,
        }),
        marginBottom: Platform.select({
            default: spacing.sm, // ✅ ОПТИМИЗАЦИЯ: Меньше отступ на мобильных
            web: spacing.lg,
        }),
        paddingVertical: Platform.select({
            default: spacing.xs,
            web: spacing.sm,
        }),
    },
    categoriesTitle: {
        fontSize: Platform.select({
            default: 14,
            web: 15,
        }),
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: palette.text,
        marginBottom: Platform.select({
            default: spacing.sm,
            web: spacing.md,
        }),
        ...Platform.select({
            web: {
                fontFamily: DESIGN_TOKENS.typography.fontFamily,
            },
        }),
    },
    loader: {
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    footerLoader: {
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 20,
    },
    status: { marginTop: 40, textAlign: "center", fontSize: 16, color: palette.textMuted },
    list: { gap: spacing.md },
    listContent: {
        padding: Platform.select({
            default: spacing.xs,
            web: spacing.sm,
        }),
        gap: spacing.md,
        paddingBottom: spacing.xl,
    },
    // ✅ АДАПТИВНОСТЬ: Отдельные стили для мобильных устройств
    listContentMobile: {
        padding: 4,
        gap: spacing.sm,
        paddingBottom: spacing.lg,
    },
    columnWrapper: { gap: spacing.md, justifyContent: "space-between" },
    exportBar: {
        gap: spacing.sm,
        padding: spacing.md,
        borderTopWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        shadowColor: "#0f172a",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 8,
    },
    exportBarInfo: {
        gap: spacing.xs,
    },
    exportBarInfoTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: palette.text,
    },
    exportBarInfoSubtitle: {
        fontSize: 13,
        color: palette.textMuted,
    },
    exportBarInfoActions: {
        flexDirection: "row",
        gap: spacing.sm,
        flexWrap: "wrap",
    },
    exportBarButtons: {
        flexDirection: "row",
        gap: spacing.sm,
        flexWrap: "wrap",
    },
    exportBarButtonsMobile: {
        flexDirection: "column",
    },
    linkButton: {
        color: palette.primary,
        fontSize: 13,
        fontWeight: "600",
    },
    progressWrapper: {
        height: 4,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.sm,
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        backgroundColor: palette.accent,
    },
    recommendationsLoader: {
        paddingVertical: spacing.lg,
        alignItems: "center",
    },
    recommendationsSkeleton: {
        width: "100%",
        paddingHorizontal: spacing.md,
        gap: spacing.md,
    },
    recommendationsSkeletonHeader: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    recommendationsSkeletonTitle: {
        height: 24,
        width: 200,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.sm,
    },
    recommendationsSkeletonTabs: {
        height: 32,
        width: 300,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
    },
    recommendationsSkeletonContent: {
        flexDirection: "row",
        gap: spacing.md,
        flexWrap: "wrap",
    },
    recommendationsSkeletonCard: {
        width: Platform.select({
            default: "100%",
            web: "calc(33.333% - 12px)" as any,
        }),
        height: 200,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
    },
});

export default memo(ListTravel);
