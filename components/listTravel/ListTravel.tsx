// ListTravel.tsx
import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'
import { useRoute } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import RenderTravelItem from './RenderTravelItem'
import StickySearchBar from '@/components/mainPage/StickySearchBar'
import ModernFilters from './ModernFilters'
import ConfirmDialog from '../ConfirmDialog'
import UIButton from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { fetchAllFiltersOptimized } from '@/src/api/miscOptimized'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { TravelListSkeleton } from '@/components/SkeletonLoader'
import EmptyState from '@/components/EmptyState'
import CategoryChips from '@/components/CategoryChips'
import ProgressIndicator from '@/components/ProgressIndicator'
import ScrollToTopButton from '@/components/ScrollToTopButton'
// ✅ АРХИТЕКТУРА: Импорт констант, типов, утилит и хуков
import {
  BREAKPOINTS,
  FLATLIST_CONFIG,
  FLATLIST_CONFIG_MOBILE,
  MAX_VISIBLE_CATEGORIES,
  PER_PAGE,
  RECOMMENDATIONS_VISIBLE_KEY
} from './utils/listTravelConstants'
import { useListTravelVisibility } from './hooks/useListTravelVisibility'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { useListTravelExport } from './hooks/useListTravelExport'
import { calculateCategoriesWithCount, calculateColumns, isMobile as checkIsMobile } from './utils/listTravelHelpers'

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

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

// Simple delete function implementation
const deleteTravel = async (id: string): Promise<void> => {
    const URLAPI = process.env.EXPO_PUBLIC_API_URL || '';
    const response = await fetch(`${URLAPI}/api/travels/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error(`Failed to delete travel: ${response.statusText}`);
    }
};

// @ts-ignore - Dynamic imports are supported in runtime
const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

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
      <View style={[styles.exportBar, Platform.OS === 'web' && isMobile && styles.exportBarMobileWeb]}>
          <View style={styles.exportBarInfo}>
            <Text style={styles.exportBarInfoTitle as any}>{selectionText}</Text>
            <Text style={styles.exportBarInfoSubtitle as any}>
              {hasSelection ? `Настройки: ${settingsSummary}` : 'Выберите хотя бы одно путешествие, чтобы включить кнопки'}
            </Text>
            <View style={styles.exportBarInfoActions}>
              <Pressable onPress={onToggleSelectAll} accessibilityRole="button">
                <Text style={styles.linkButton as any}>
                  {selectedCount === allCount && allCount > 0 ? "Снять выделение" : "Выбрать все"}
                </Text>
              </Pressable>
              {hasSelection && (
                <Pressable onPress={onClearSelection} accessibilityRole="button">
                  <Text style={styles.linkButton as any}>Очистить выбор</Text>
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

    const { width, height } = useWindowDimensions();
    const route = useRoute();
    const router = useRouter();
    const pathname = usePathname();

    const params = useLocalSearchParams<{ user_id?: string }>();
    const user_id = params.user_id;

    const isMeTravel = (route as any).name === "metravel";
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export" || pathname?.includes('/export');

    // ✅ АДАПТИВНОСТЬ: Определяем устройство и ориентацию
    const isMobile = checkIsMobile(width);
    const isTablet = useMemo(() => width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP, [width]);
    const isPortrait = height > width;

    const columns = useMemo(() => {
        // ✅ ОПТИМИЗАЦИЯ: Используем оптимизированную функцию расчета колонок с учетом ориентации
        const baseColumns = calculateColumns(width);
        // На планшете в портретной ориентации используем меньше колонок для лучшей читаемости
        if (isTablet && isPortrait && baseColumns > 2) {
            return 2;
        }
        return baseColumns;
    }, [width, isTablet, isPortrait]);

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
    const saveScrollTimeoutRef = useRef<number | null>(null);
    const lastScrollOffsetRef = useRef<number>(0);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    /* Filters options - оптимизированный запрос с кэшированием */
    const { data: rawOptions } = useQuery({
        queryKey: ["filter-options"],
        queryFn: fetchAllFiltersOptimized,
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

    // ✅ АДАПТИВНОСТЬ: Количество видимых категорий зависит от устройства
    const maxVisibleCategories = useMemo(() => {
      if (isMobile) return 6;
      if (isTablet) return 8;
      return MAX_VISIBLE_CATEGORIES;
    }, [isMobile, isTablet]);

    const categoriesWithCount = useMemo(
      () => calculateCategoriesWithCount(travels, options?.categories as any).slice(0, maxVisibleCategories),
      [travels, options?.categories, maxVisibleCategories]
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

    // ✅ КРИТИЧНО: ItemSeparator создает вертикальные отступы между карточками
    // ПРОБЛЕМА: marginBottom на карточке НЕ РАБОТАЕТ в FlatList (конфликт с gap в columnWrapperStyle)
    // РЕШЕНИЕ: Используем ItemSeparatorComponent для явного контроля отступов
    // 
    // ВАЖНО: В браузере Platform всегда = 'web', поэтому используем width для определения мобильных
    // 
    // Значения:
    // - Mobile (< 768px): 20px между карточками
    // - Desktop (>= 768px): 24px между карточками
    const ItemSeparator = useCallback(() => {
      const separatorHeight = width < 768 ? 20 : 24;
      return <View style={{ height: separatorHeight }} />;
    }, [width]);

    // ✅ ОПТИМИЗАЦИЯ: Динамическая конфигурация виртуализации на основе устройства и viewport
    const listVirtualization = useMemo(() => {
      const config = isMobile ? FLATLIST_CONFIG_MOBILE : FLATLIST_CONFIG;

      // ✅ A1.1: Расчет на основе высоты viewport для оптимального количества элементов
      const estimatedItemHeight = isMobile ? 280 : 320;
      const itemsPerScreen = Math.ceil(height / estimatedItemHeight);
      const itemsPerRow = columns;
      const rowsPerScreen = Math.ceil(itemsPerScreen / itemsPerRow);
      
      // Адаптируем под количество колонок и размер экрана
      const initial = Math.max(rowsPerScreen * itemsPerRow, config.INITIAL_NUM_TO_RENDER);
      const batch = Math.max(Math.ceil(rowsPerScreen * 1.5) * itemsPerRow, config.MAX_TO_RENDER_PER_BATCH);
      
      // ✅ A1.1: Адаптивный windowSize в зависимости от устройства
      let windowSize: number = config.WINDOW_SIZE;
      if (isMobile) {
        windowSize = 5; // Меньше для экономии памяти
      } else if (isTablet) {
        windowSize = 7;
      } else {
        windowSize = 10; // Больше для desktop для плавного скролла
      }

      return {
        initial,
        batch,
        window: windowSize,
        updateCellsBatchingPeriod: config.UPDATE_CELLS_BATCHING_PERIOD,
      };
    }, [columns, isMobile, isTablet, height]);

    // ✅ B1.1: Улучшенные адаптивные отступы с плавными переходами
    const contentPadding = useMemo(() => {
      if (width < 360) return 16;  // XS: Увеличено для маленьких экранов
      if (width < 480) return 20; // SM: iPhone SE и подобные - увеличено!
      if (width < 768) return 20; // Mobile: Стандартные телефоны
      if (width < 1024) return 20; // Tablet
      if (width < 1440) return 24; // Desktop
      if (width < 1920) return 32; // Large Desktop
      return 40; // XXL
    }, [width]);

    // ✅ B1.1: Улучшенные отступы между карточками
    const gapSize = useMemo(() => {
      if (width < 360) return 8;  // XS
      if (width < 480) return 10; // SM
      if (width < 768) return 12; // Mobile
      if (width < 1024) return 14; // Tablet
      return 16; // Desktop+
    }, [width]);

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
    
    // ✅ A1.2: Оптимизированный обработчик прокрутки с улучшенным debounce и requestIdleCallback
    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
        
        // Проверка для автоматической подгрузки
        if (contentSize.height <= layoutMeasurement.height * 1.05) {
            onMomentumRef.current = true;
        }
        
        // Сохранение позиции скролла только для web с оптимизацией
        if (Platform.OS === 'web') {
            const offsetY = contentOffset.y;
            
            // ✅ A1.2: Увеличен порог до 200px для web, 150px для mobile
            const threshold = isMobile ? 150 : 200;
            
            if (Math.abs(offsetY - lastScrollOffsetRef.current) > threshold) {
                // Отменяем предыдущий таймер
                if (saveScrollTimeoutRef.current) {
                    clearTimeout(saveScrollTimeoutRef.current);
                }
                
                // ✅ A1.2: Увеличен debounce до 500ms для снижения нагрузки
                saveScrollTimeoutRef.current = setTimeout(() => {
                    // ✅ A1.2: Используем requestIdleCallback для записи в storage
                    const saveToStorage = () => {
                        try {
                            window.sessionStorage.setItem('travel-list-scroll', String(offsetY));
                            lastScrollOffsetRef.current = offsetY;
                        } catch (error) {
                            // Игнорируем ошибки sessionStorage
                        }
                    };
                    
                    if ('requestIdleCallback' in window) {
                        (window as any).requestIdleCallback(saveToStorage, { timeout: 1000 });
                    } else {
                        saveToStorage();
                    }
                }, 500) as any; // Debounce 500ms
            }
        }
    }, [isMobile]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!flatListRef.current) return;
        
        // Defer scroll restoration to prevent layout thrashing
        const restoreScroll = () => {
            try {
                const stored = window.sessionStorage.getItem('travel-list-scroll');
                if (!stored) return;
                const value = Number(stored);
                if (!Number.isFinite(value) || value <= 0) return;
                
                // Use single requestAnimationFrame for better performance
                requestAnimationFrame(() => {
                    flatListRef.current?.scrollToOffset({ offset: value, animated: false });
                });
            } catch (error) {}
        };
        
        // Use setTimeout to ensure DOM is ready
        const timeoutId = setTimeout(restoreScroll, 100);
        
        return () => clearTimeout(timeoutId);
    }, []);

    const displayData = travels;

    // ✅ UX УЛУЧШЕНИЕ: Подсчитываем количество активных фильтров с мемоизацией
    const activeFiltersCount = useMemo(() => {
      let count = 0;
      
      // Оптимизированный подсчет через reduce
      const filterKeys = [
        'categories',
        'transports', 
        'categoryTravelAddress',
        'companions',
        'complexity',
        'month',
        'over_nights_stay'
      ] as const;
      
      filterKeys.forEach(key => {
        const value = filter[key];
        if (Array.isArray(value) && value.length > 0) {
          count += value.length;
        }
      });
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

    // ✅ АРХИТЕКТУРА: Централизованная конфигурация групп фильтров для переиспользования в десктоп и мобильной версии
    const filterGroups = useMemo(() => [
      // На странице travelsby страна всегда Беларуси, поэтому отдельный фильтр по странам прячем
      ...(!isTravelBy ? [
        {
          key: 'countries',
          title: 'Страны',
          options: (options?.countries || []).map((country: any) => ({
            id: String(country.country_id ?? country.id),
            name: country.title_ru || country.name,
          })),
          multiSelect: true,
          icon: 'globe',
        },
      ] : []),
      {
        key: 'categories',
        title: 'Категории',
        options: (options?.categories || []).map((cat: any) => ({
          id: String(cat.id),
          name: cat.name,
          count: undefined,
        })),
        multiSelect: true,
        icon: 'tag',
      },
      {
        key: 'transports',
        title: 'Транспорт',
        options: (options?.transports || []).map((t: any) => ({
          id: String(t.id),
          name: t.name,
        })),
        multiSelect: true,
        icon: 'truck',
      },
      {
        key: 'categoryTravelAddress',
        title: 'Объекты',
        options: (options?.categoryTravelAddress || []).map((obj: any) => ({
          id: String(obj.id),
          name: obj.name,
        })),
        multiSelect: true,
        icon: 'map-pin',
      },
      {
        key: 'companions',
        title: 'Спутники',
        options: (options?.companions || []).map((c: any) => ({
          id: String(c.id),
          name: c.name,
        })),
        multiSelect: true,
        icon: 'users',
      },
      {
        key: 'complexity',
        title: 'Сложность',
        options: (options?.complexity || []).map((item: any) => ({
          id: String(item.id),
          name: item.name,
        })),
        multiSelect: true,
        icon: 'activity',
      },
      {
        key: 'month',
        title: 'Месяц',
        options: (options?.month || []).map((item: any) => ({
          id: String(item.id),
          name: item.name,
        })),
        multiSelect: true,
        icon: 'calendar',
      },
      {
        key: 'over_nights_stay',
        title: 'Ночлег',
        options: (options?.over_nights_stay || []).map((item: any) => ({
          id: String(item.id),
          name: item.name,
        })),
        multiSelect: true,
        icon: 'moon',
      },
    ], [options, isTravelBy]);

    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.container}>
          <View style={[styles.content, Platform.OS === 'web' && isMobile && styles.contentMobile]}>
            {!isMobile && (
              <View style={styles.sidebar}>
                <ModernFilters
                  filterGroups={filterGroups}
                  selectedFilters={filter as any}
                  onFilterChange={(groupKey, optionId) => {
                    const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v));
                    const normalizedId = String(optionId);
                    const newValues = currentValues.includes(normalizedId)
                      ? currentValues.filter((id) => id !== normalizedId)
                      : [...currentValues, normalizedId];
                    onSelect(groupKey, newValues);
                  }}
                  onClearAll={() => {
                    setSearch('');
                    resetFilters();
                  }}
                  resultsCount={total}
                  year={filter.year}
                  onYearChange={(value) => onSelect('year', value)}
                  showModeration={isSuper}
                  moderationValue={filter.moderation}
                  onToggleModeration={() => {
                    const next = filter.moderation === 0 ? undefined : 0;
                    onSelect('moderation', next);
                  }}
                />
              </View>
            )}

            <View style={[styles.main, Platform.OS === 'web' && isMobile && styles.mainMobile]}>
              {/* Поиск - StickySearchBar: одинаковый вид для десктопа и мобайла */}
              <View style={[styles.searchSectionMain, { paddingHorizontal: contentPadding }]}>
                <StickySearchBar
                  search={search}
                  onSearchChange={setSearch}
                  onFiltersPress={() => setShowFilters(true)}
                  onToggleRecommendations={() => handleRecommendationsVisibilityChange(!isRecommendationsVisible)}
                  isRecommendationsVisible={isRecommendationsVisible}
                  hasActiveFilters={activeFiltersCount > 0}
                  resultsCount={total}
                  activeFiltersCount={activeFiltersCount}
                  onClearAll={() => {
                    setSearch('');
                    resetFilters();
                  }}
                />
              </View>

              {/* Скелетон загрузки */}
              {showInitialLoading && (
                <TravelListSkeleton count={PER_PAGE} columns={columns} />
              )}

              {/* Ошибка */}
              {isError && !showInitialLoading && (
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
              {!showInitialLoading && (
              <FlatList
                key={listKey}
                ref={flatListRef}
                data={displayData}
                extraData={displayData.length}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                numColumns={columns}
                ItemSeparatorComponent={ItemSeparator} // ✅ Separator для вертикальных отступов
                columnWrapperStyle={columns > 1 ? {
                    justifyContent: 'flex-start',
                    gap: gapSize, // ✅ Используем gap для отступов между колонками
                } : undefined}
                contentContainerStyle={[
                  styles.listContent,
                  {
                    // ✅ ВАЖНО: paddingHorizontal для отступов слева/справа
                    paddingHorizontal: contentPadding,
                    // ✅ ВАЖНО: paddingTop для отступа от панели поиска
                    paddingTop: contentPadding + 8, // +8px дополнительно для воздуха
                    // 🔍 DEBUG: Временный background для проверки отступов (удалить после теста)
                    // backgroundColor: 'rgba(255, 0, 0, 0.1)',
                  },
                  isMobile && styles.listContentMobile, // ✅ АДАПТИВНОСТЬ: Отдельные стили для мобильных
                  isExport && {
                    paddingBottom: isMobile ? 200 : isTablet ? 180 : 150
                  }, // ✅ АДАПТИВНОСТЬ: Отступ для панели экспорта + нижнее меню
                ]}
                onEndReached={handleListEndReached}
                onEndReachedThreshold={isMobile ? FLATLIST_CONFIG_MOBILE.ON_END_REACHED_THRESHOLD : FLATLIST_CONFIG.ON_END_REACHED_THRESHOLD}
                onScroll={onScroll}
                scrollEventThrottle={Platform.select({ ios: 16, android: 32, web: 32 })}
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
                            selectedCategories={(filter.categories || []).map(String)}
                            onToggleCategory={handleToggleCategory}
                            maxVisible={maxVisibleCategories}
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
                removeClippedSubviews={false} // ✅ Отключено для предотвращения мерцания и скачков при загрузке
                getItemLayout={undefined}
                maintainVisibleContentPosition={
                  Platform.OS !== 'web' ? {
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                  } : undefined
                } // ✅ Предотвращает скачки при обновлении данных
              />
              )}
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
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
              <ModernFilters
                filterGroups={filterGroups}
                selectedFilters={filter as any}
                onFilterChange={(groupKey, optionId) => {
                  const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v));
                  const normalizedId = String(optionId);
                  const newValues = currentValues.includes(normalizedId)
                    ? currentValues.filter((id) => id !== normalizedId)
                    : [...currentValues, normalizedId];
                  onSelect(groupKey, newValues);
                }}
                onClearAll={() => {
                  setSearch('');
                  resetFilters();
                }}
                resultsCount={total}
                year={filter.year}
                onYearChange={(value) => onSelect('year', value)}
                showModeration={isSuper}
                moderationValue={filter.moderation}
                onToggleModeration={() => {
                  const next = filter.moderation === 0 ? undefined : 0;
                  onSelect('moderation', next);
                }}
                onClose={() => setShowFilters(false)}
                onApply={() => setShowFilters(false)}
              />
            </SafeAreaView>
          </Modal>
        )}

          <ConfirmDialog
            visible={!!deleteId}
            onClose={() => setDelete(null)}
            onConfirm={handleDelete}
            title="Удаление"
            message="Удалить это путешествие?"
          />

          {isExport && (
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
    backgroundColor: '#f5f5f5', // ✅ Светло-серый фон для контраста с белыми карточками
    // ✅ ИСПРАВЛЕНИЕ: Учитываем safe area для iOS
    ...Platform.select({
      web: {
        paddingBottom: 'env(safe-area-inset-bottom)' as any,
      },
    }),
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1600,
    marginHorizontal: 'auto',
    width: '100%',
    ...Platform.select({
      web: {
        minHeight: '100vh' as any,
      },
    }),
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: Platform.select({ default: 16, web: 32 }),
    gap: Platform.select({ default: 0, web: 40 }),
  },
  // Компактный верхний отступ и gap для мобильной ширины на web
  contentMobile: {
    paddingTop: 12,
    gap: 16,
  },
  sidebar: {
    width: Platform.select({ default: 260, web: 300 }),
    paddingRight: 0,
    paddingLeft: Platform.select({ default: spacing.sm, web: 20 }),
    borderRightWidth: 0,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        alignSelf: 'flex-start',
        maxHeight: '100vh' as any,
        overflowY: 'auto' as any,
      },
    }),
  },
  main: {
    flex: 1,
    paddingHorizontal: Platform.select({ default: 0, web: 32 }), // Убран padding на мобильных
    paddingRight: Platform.select({ default: 0, web: 40 }),
    minWidth: 0,
  },
  // Жёсткое переопределение для мобильной ширины на web
  mainMobile: {
    // ✅ ВАЖНО: Убираем padding от main (32px) чтобы не было двойных отступов
    // Отступы управляются через contentPadding (20px) в:
    // - searchSectionMain (панель поиска)
    // - contentContainerStyle (FlatList карточки)
    paddingHorizontal: 0,
    paddingRight: 0,
  },
  searchSection: {
    paddingHorizontal: Platform.select({ default: spacing.xs, web: spacing.sm }), // Минимальный padding на мобильных
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchSectionMain: {
    marginBottom: 16,
    // ✅ ВАЖНО: paddingHorizontal управляется через contentPadding в inline стиле
    // Это гарантирует одинаковые отступы для поиска и карточек
  },
  categoriesSectionMain: {
    marginTop: Platform.select({ default: spacing.md, web: 20 }),
    marginBottom: Platform.select({ default: spacing.lg, web: 32 }),
    paddingVertical: Platform.select({ default: spacing.sm, web: 16 }),
  },
  categoriesTitle: {
    fontSize: Platform.select({ default: 15, web: 17 }),
    fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    color: '#0f172a',
    marginBottom: Platform.select({ default: spacing.sm, web: 16 }),
    letterSpacing: -0.3,
    paddingHorizontal: Platform.select({ default: spacing.xs, web: 0 }),
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily as any,
      },
    }),
  } as any,
  loader: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Platform.select({ default: spacing.xl, web: 40 }),
  },
  footerLoader: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Platform.select({ default: spacing.md, web: spacing.lg }),
  },
  status: { 
    marginTop: spacing.xl, 
    textAlign: "center", 
    fontSize: Platform.select({ default: 14, web: 16 }), 
    color: palette.textMuted,
  },
  list: { 
    gap: Platform.select({ default: spacing.sm, web: spacing.md }),
  },
  listContent: {
    // ✅ ВАЖНО: Уменьшен paddingBottom для мобильных (футер фиксированный внизу)
    paddingBottom: 40, // Мобильное значение по умолчанию (было 100/120)
    backgroundColor: 'transparent', // Прозрачный, чтобы видеть фон root
    ...Platform.select({
      web: {
        maxWidth: 1400,
        marginHorizontal: 'auto',
      } as any,
    }),
  },
  listContentMobile: {
    // ✅ ВАЖНО: Минимальный paddingBottom для мобильных (футер внизу экрана)
    // Высота футера ~60px + небольшой отступ = 80px
    paddingBottom: 80,
    // paddingHorizontal уже установлен через contentPadding
    backgroundColor: 'transparent', // Прозрачный, чтобы видеть фон root
  },
  columnWrapper: { 
    gap: Platform.select({ default: 16, web: 20 }), // ✅ Увеличен gap для большего пространства
    justifyContent: "flex-start",
  },
  exportBar: {
    gap: spacing.xs,
    padding: Platform.select({ default: spacing.sm, web: spacing.md }),
    paddingBottom: Platform.select({ default: 70, web: 24 }), // отступ для нижнего меню/футера
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderLight,
    backgroundColor: palette.surface,
    position: Platform.select({ default: 'absolute' as any, web: 'fixed' as any }),
    bottom: Platform.select({ default: 60, web: 67 }),
    left: 0,
    right: 0,
    zIndex: 999, // ✅ АДАПТИВНОСТЬ: Под нижним меню, но над контентом
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 -2px 12px rgba(15, 23, 42, 0.08)',
      },
    }),
  },
  exportBarMobileWeb: {
    bottom: 55,
    paddingBottom: Platform.select({ default: 20, web: 24 }),
    padding: spacing.sm,
  },
  exportBarInfo: {
    gap: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  exportBarInfoTitle: {
    fontSize: Platform.select({ default: 14, web: 15 }),
    fontWeight: "700",
    color: palette.text,
    letterSpacing: -0.2,
  },
  exportBarInfoSubtitle: {
    fontSize: Platform.select({ default: 11, web: 12 }),
    color: palette.textMuted,
    lineHeight: Platform.select({ default: 14, web: 16 }),
  },
  exportBarInfoActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  exportBarButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    alignItems: 'center',
  },
  exportBarButtonsMobile: {
    flexDirection: "column",
    width: '100%',
  },
  linkButton: {
    color: palette.primary,
    fontSize: Platform.select({ default: 12, web: 13 }),
    fontWeight: "600",
    ...Platform.select({
      web: {
        cursor: 'pointer',
        textDecorationLine: 'underline',
      },
    }),
  },
  progressWrapper: {
    height: 4,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressBar: {
    height: "100%",
    backgroundColor: palette.accent,
    borderRadius: radii.sm,
  },
  recommendationsLoader: {
    paddingVertical: Platform.select({ default: spacing.md, web: spacing.lg }),
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationsSkeleton: {
    width: "100%",
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
    gap: Platform.select({ default: spacing.sm, web: spacing.md }),
  },
  recommendationsSkeletonHeader: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  recommendationsSkeletonTitle: {
    height: Platform.select({ default: 20, web: 24 }),
    width: Platform.select({ default: 160, web: 200 }),
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.sm,
  },
  recommendationsSkeletonTabs: {
    height: Platform.select({ default: 28, web: 32 }),
    width: Platform.select({ default: 240, web: 300 }),
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
  },
  recommendationsSkeletonContent: {
    flexDirection: "row",
    gap: Platform.select({ default: spacing.sm, web: spacing.md }),
    flexWrap: "wrap",
  },
  recommendationsSkeletonCard: {
    width: Platform.select({
      default: "100%",
      web: "calc(33.333% - 12px)" as any,
    }),
    height: Platform.select({ default: 180, web: 200 }),
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
  },
  sidebarExtraFilters: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.borderLight,
    gap: spacing.xs,
  },
  yearFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  yearFilterLabel: {
    fontSize: Platform.select({ default: 12, web: 12 }),
    color: palette.textMuted,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  yearFilterInput: {
    flexBasis: 78,
    maxWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
    borderColor: palette.borderLight,
    backgroundColor: palette.surfaceMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  moderationRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  moderationLabel: {
    fontSize: 12,
    color: palette.textMuted,
  },
});

export default memo(ListTravel);
