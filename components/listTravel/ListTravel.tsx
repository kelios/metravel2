// ListTravel.tsx
import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
  View,
  ViewStyle,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'
import { useRoute } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import RenderTravelItem from './RenderTravelItem'
import SidebarFilters from './SidebarFilters'
import RightColumn from './RightColumn'
import StickySearchBar from '@/components/mainPage/StickySearchBar'
import ConfirmDialog from '../ConfirmDialog'
import UIButton from '@/components/ui/Button'
import { LIGHT_MODERN_DESIGN_TOKENS as TOKENS } from '@/constants/lightModernDesignTokens';
import { useAuth } from '@/context/AuthContext'
import { fetchAllFiltersOptimized } from '@/src/api/miscOptimized'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { TravelListSkeleton } from '@/components/SkeletonLoader'
import EmptyState from '@/components/EmptyState'
import ProgressIndicator from '@/components/ProgressIndicator'
import type { Travel } from '@/src/types/types'
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
import { calculateCategoriesWithCount, calculateColumns, isMobile, getContainerPadding } from './utils/listTravelHelpers'

// Define styles at the top level before any component definitions
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
    // Современный минималистичный layout
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    height: '100%',
  },
  rootMobile: {
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: TOKENS.spacing.lg,
    paddingTop: TOKENS.spacing.lg,
    paddingBottom: TOKENS.spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  contentMobile: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.md,
  },
  sidebar: {
    width: 320,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: TOKENS.colors.border,
    backgroundColor: TOKENS.colors.surface,
    paddingHorizontal: TOKENS.spacing.lg,
    paddingTop: TOKENS.spacing.lg,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
  },
  listContainer: {
    paddingHorizontal: TOKENS.spacing.lg,
    paddingTop: TOKENS.spacing.lg,
    paddingBottom: TOKENS.spacing.lg,
  },
  listContainerMobile: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.md,
  },
  exportBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.colors.surface,
    borderRadius: TOKENS.radii.md,
    padding: TOKENS.spacing.md,
    marginBottom: TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.border,
    ...(Platform.OS === 'web'
      ? ({ shadowColor: TOKENS.colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 } as const)
      : TOKENS.shadowsNative.subtle),
  },
  exportBarMobileWeb: {
    marginHorizontal: -TOKENS.spacing.xs,
    marginBottom: TOKENS.spacing.sm,
  },
  exportBarInfo: {
    flex: 1,
    marginRight: TOKENS.spacing.md,
  },
  exportBarInfoTitle: {
    fontSize: TOKENS.typography.sizes.lg,
    fontWeight: TOKENS.typography.weights.semibold,
    color: TOKENS.colors.text,
    marginBottom: TOKENS.spacing.xs,
  },
  exportBarInfoSubtitle: {
    fontSize: TOKENS.typography.sizes.sm,
    color: TOKENS.colors.textSecondary,
    marginBottom: TOKENS.spacing.sm,
  },
  exportBarInfoActions: {
    flexDirection: 'row',
    gap: TOKENS.spacing.sm,
  },
  linkButton: {
    fontSize: TOKENS.typography.sizes.sm,
    color: TOKENS.colors.primary,
    textDecorationLine: 'underline',
  },
  exportBarButtons: {
    flexDirection: 'row',
    gap: TOKENS.spacing.sm,
  },
  exportBarButtonsMobile: {
    flexDirection: 'column',
    width: '100%',
  },
  progressWrapper: {
    marginTop: TOKENS.spacing.sm,
  },
  recommendationsLoader: {
    marginTop: TOKENS.spacing.lg,
    padding: TOKENS.spacing.md,
    backgroundColor: TOKENS.colors.surface,
    borderRadius: TOKENS.radii.md,
    alignItems: 'center',
  },
  recommendationsSkeleton: {
    width: '100%',
  },
  recommendationsSkeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: TOKENS.spacing.md,
  },
  recommendationsSkeletonTitle: {
    width: 120,
    height: 20,
    backgroundColor: TOKENS.colors.skeleton,
    borderRadius: TOKENS.radii.sm,
  },
  recommendationsSkeletonTabs: {
    flexDirection: 'row',
    gap: TOKENS.spacing.sm,
  },
  recommendationsSkeletonContent: {
    flexDirection: 'row',
    gap: TOKENS.spacing.sm,
  },
  recommendationsSkeletonCard: {
    flex: 1,
    height: 80,
    backgroundColor: TOKENS.colors.skeleton,
    borderRadius: TOKENS.radii.sm,
  },
  // ✅ RIGHT COLUMN: Основной контейнер правой части
  rightColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
    ...(Platform.OS === 'web' ? ({ paddingTop: TOKENS.spacing.lg } as const) : null),
  },
  rightColumnMobile: {
    width: '100%',
  },
  // ✅ SEARCH HEADER: Прикрепленный заголовок поиска
  searchHeader: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: TOKENS.colors.surface,
    ...(Platform.OS === 'web'
      ? ({ shadowColor: TOKENS.colors.border, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 } as const)
      : TOKENS.shadowsNative.subtle),
  },
  // ✅ CARDS CONTAINER: Прокручиваемый контейнер для карточек
  cardsContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    // Горизонтальные отступы задаются динамически через contentPadding, чтобы избежать лишних белых полей
    paddingTop: TOKENS.spacing.lg,
    paddingBottom: TOKENS.spacing.md,
  },
  cardsContainerMobile: {
    paddingBottom: 0,
  },
  // ✅ CARDS GRID: Flexbox layout for both platforms
  cardsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  resultsCount: {
    marginBottom: TOKENS.spacing.lg,
  },
  resultsCountText: {
    fontSize: TOKENS.typography.sizes.md,
    fontWeight: TOKENS.typography.weights.medium,
    color: TOKENS.colors.text,
  },
  footerLoader: {
    paddingVertical: TOKENS.spacing.lg,
    alignItems: 'center',
  },
});

// Ленивая загрузка RecommendationsTabs без requestIdleCallback (устраняем тайпинги)
const RecommendationsTabs = lazy(() => import('./RecommendationsTabs'));

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
const ExportBar = memo(function ExportBar({
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
    isPersonalizationVisible: externalPersonalizationVisible,
    onToggleWeeklyHighlights,
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
    // На всех платформах считаем устройство "мобильным", если ширина меньше MOBILE breakpoint
    const isMobileDevice = isMobile(width);
    // Планшет: от MOBILE до TABLET_LANDSCAPE, всё, что шире, считаем десктопом (3 колонки)
    const isTablet = width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP;
    const isDesktop = !isMobileDevice && !isTablet;
    const isPortrait = height > width;

    // ✅ ОПТИМИЗАЦИЯ: Базовое количество колонок для логики (от общей ширины окна)
    // На десктопе всегда 3 колонки, на планшетах/мобилках рассчитываем динамически
    const baseColumns = isDesktop ? 3 : calculateColumns(width);
    const columns = isTablet && isPortrait && baseColumns > 2 ? 2 : baseColumns;

    const gapSize = width < 360 ? 12 : width < 480 ? 14 : width < 768 ? 16 : width < 1024 ? 18 : width < 1440 ? 24 : 32;

    const cardsGridDynamicStyle = useMemo(() => {
      const styleArray: ViewStyle[] = [styles.cardsGrid]

      if (Platform.OS === 'web') {
        styleArray.push({
          gap: gapSize,
          rowGap: gapSize,
          columnGap: gapSize,
        })
      } else {
        styleArray.push({
          marginHorizontal: -(gapSize / 2),
        })
      }

      return styleArray
    }, [gapSize]);

    // ✅ ОПТИМИЗАЦИЯ: Стабильные адаптивные отступы и ширина правой колонки
    // На мобильном layout используем полную ширину, на десктопе вычитаем ширину sidebar
    const effectiveWidth = isMobileDevice ? width : width - 320; // 320px ~ ширина sidebar

    const contentPadding = useMemo(() => {
      // ✅ ОПТИМИЗАЦИЯ: Используем стабильные breakpoints для избежания лишних перерасчетов
      if (effectiveWidth < 360) return 16;  // XS: компактные устройства
      if (effectiveWidth < 480) return 12; // SM: чуть уже карточки на очень маленьких телефонах
      if (effectiveWidth < 768) return 12; // Mobile: стандартные телефоны — синхронизировано
      if (effectiveWidth < 1024) return 20; // Tablet
      if (effectiveWidth < 1440) return 24; // Desktop
      if (effectiveWidth < 1920) return 32; // Large Desktop
      return 40; // XXL
    }, [effectiveWidth]); // ✅ ОПТИМИЗАЦИЯ: Только эффективная ширина в зависимостях

    const gridColumns = useMemo(() => {
      if (isMobileDevice) {
        return calculateColumns(width, isPortrait ? 'portrait' : 'landscape');
      }

      if (!isTablet || !isPortrait) {
        return 3;
      }

      return calculateColumns(width, 'portrait');
    }, [isMobileDevice, isTablet, isPortrait, width]);

    const [recommendationsReady, setRecommendationsReady] = useState(Platform.OS !== 'web');
    const [isRecommendationsVisible, setIsRecommendationsVisible] = useState<boolean>(false);
    const [recommendationsVisibilityInitialized, setRecommendationsVisibilityInitialized] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadRecommendationsVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    const stored = sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
                    const visible = stored !== 'false';
                    if (!isMounted) return;
                    setIsRecommendationsVisible(visible);
                    if (visible) {
                        setRecommendationsReady(true);
                    }
                } else {
                    const stored = await AsyncStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
                    if (!isMounted) return;
                    const visible = stored !== 'false';
                    setIsRecommendationsVisible(visible);
                    if (visible) {
                        setRecommendationsReady(true);
                    }
                }
            } catch (error) {
                console.error('Error loading recommendations visibility:', error);
            } finally {
                if (isMounted) {
                    setRecommendationsVisibilityInitialized(true);
                }
            }
        };

        loadRecommendationsVisibility();

        return () => {
            isMounted = false;
        };
    }, []);

    // ✅ ИСПРАВЛЕНИЕ: Сохраняем состояние видимости рекомендаций при изменении и запускаем ленивую загрузку блока
    const handleRecommendationsVisibilityChange = useCallback((visible: boolean) => {
        if (!recommendationsVisibilityInitialized) {
            return;
        }

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
    }, [recommendationsReady, recommendationsVisibilityInitialized]);

    const queryClient = useQueryClient();

    /* Auth flags: используем AuthContext, который уже учитывает наличие токена */
    const { userId, isSuperuser: isSuper } = useAuth();

    /* Top-bar state */
    const [search, setSearch] = useState("");
    const debSearch = useDebouncedValue(search, 400);

    const onMomentumRef = useRef(false);
    const lastEndReachedAtRef = useRef<number>(0);
    const scrollY = useRef<number>(0);
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

    // ✅ ОПТИМИЗАЦИЯ: Упрощенная трансформация данных - убраны тяжелые операции
    const options = useMemo((): import('./utils/listTravelTypes').FilterOptions | undefined => {
        if (!rawOptions) return undefined;

        // ✅ ОПТИМИЗАЦИЯ: Прямое копирование без сложных трансформаций
        return {
            countries: rawOptions.countries || [],
            categories: rawOptions.categories || [],
            transports: rawOptions.transports || [],
            categoryTravelAddress: rawOptions.categoryTravelAddress || [],
            companions: rawOptions.companions || [],
            complexity: rawOptions.complexity || [],
            month: rawOptions.month || [],
            over_nights_stay: rawOptions.over_nights_stay || [],
        };
    }, [rawOptions]); // ✅ ОПТИМИЗАЦИЯ: Только rawOptions в зависимостях

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
      if (isMobileDevice) return 6;
      if (isTablet) return 8;
      return MAX_VISIBLE_CATEGORIES;
    }, [isMobileDevice, isTablet]);

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

    useEffect(() => {
        if (!deleteId) return;

        const title = 'Удалить путешествие?';
        const message = 'Это действие нельзя отменить.';

        if (Platform.OS === 'web') {
            const ok = typeof (globalThis as any).confirm === 'function'
                ? (globalThis as any).confirm(`${title}\n\n${message}`)
                : true;

            if (ok) {
                handleDelete();
            } else {
                setDelete(null);
            }
            return;
        }

        Alert.alert(title, message, [
            {
                text: 'Отмена',
                style: 'cancel',
                onPress: () => setDelete(null),
            },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => handleDelete(),
            },
        ]);
    }, [deleteId, handleDelete]);

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

    const renderTravelListItem = useCallback(
      (travel: Travel, index: number) => (
        <MemoizedTravelItem
          item={travel}
          index={index}
          isMobile={isMobileDevice}
          isSuperuser={isSuper}
          isMetravel={isMeTravel}
          onDeletePress={setDelete}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={isSelected(travel.id)}
          onToggle={() => toggleSelect(travel)}
        />
      ),
      [isMobileDevice, isSuper, isMeTravel, isExport, setDelete, isSelected, toggleSelect]
    );

    const selectionLabel = hasSelection
      ? `Выбрано ${selectionCount} ${pluralizeTravels(selectionCount)}`
      : 'Выберите путешествия для экспорта';
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsModalMode, setSettingsModalMode] = useState<'save' | 'preview'>('save');


    /* Loading helpers */
    const hasAnyItems = travels.length > 0;
    
    const showInitialLoading = isInitialLoading || isUserIdLoading;
    const showNextPageLoading = isNextPageLoading;
    const showEmptyState = !isUserIdLoading && isEmpty;

    // DEBUG: Add logging to see what's happening
    // console.log('ListTravel Debug:', {
    //   travelsLength: travels?.length || 0,
    //   gridRowsLength: gridRows?.length || 0,
    //   isInitialLoading,
    //   isUserIdLoading,
    //   isQueryEnabled,
    //   isEmpty,
    //   showInitialLoading,
    //   showEmptyState,
    //   userId,
    //   isMeTravel,
    //   isExport,
    //   routeName: (route as any)?.name,
    //   pathname,
    // });

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
    
    // ✅ A2.1: Оптимизированный обработчик прокрутки с улучшенным debounce и без requestAnimationFrame
    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;

        // Проверка для автоматической подгрузки
        if (contentSize.height <= layoutMeasurement.height * 1.05) {
            onMomentumRef.current = true;
        }

        // Сохранение позиции скролла только для web с оптимизацией
        if (Platform.OS === 'web') {
            const offsetY = contentOffset.y;

            // ✅ A2.1: Увеличен порог до 300px для web, 200px для mobile (меньше частоты)
            const threshold = isMobileDevice ? 200 : 300;

            if (Math.abs(offsetY - lastScrollOffsetRef.current) > threshold) {
                // Отменяем предыдущий таймер
                if (saveScrollTimeoutRef.current) {
                    clearTimeout(saveScrollTimeoutRef.current);
                }

                // ✅ A2.1: Увеличен debounce до 800ms для web, 600ms для mobile
                saveScrollTimeoutRef.current = setTimeout(() => {
                    try {
                        window.sessionStorage.setItem('travel-list-scroll', String(offsetY));
                        lastScrollOffsetRef.current = offsetY;
                    } catch (error) {
                        // Игнорируем ошибки sessionStorage
                    }
                }, isMobileDevice ? 600 : 800) as any;
            }
        }
    }, [isMobileDevice]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!flatListRef.current) return;

        // ✅ A2.2: Упрощенное восстановление скролла без двойного requestAnimationFrame
        const restoreScroll = () => {
            try {
                const stored = window.sessionStorage.getItem('travel-list-scroll');
                if (!stored) return;
                const value = Number(stored);
                if (!Number.isFinite(value) || value <= 0) return;

                // Простое восстановление без лишних анимаций
                setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: value, animated: false });
                }, 50); // Небольшая задержка для стабильности
            } catch (error) {}
        };

        // Используем setTimeout для обеспечения готовности DOM
        const timeoutId = setTimeout(restoreScroll, 100);

        return () => clearTimeout(timeoutId);
    }, []);

    // ✅ ОПТИМИЗАЦИЯ: Подсчитываем количество активных фильтров с мемоизацией
    // Оптимизируем расчет путем использования стабильных ссылок на filter
    const activeFiltersCount = useMemo(() => {
      let count = 0;

      // ✅ ОПТИМИЗАЦИЯ: Предварительно определяем ключи фильтров
      const filterKeys = ['categories', 'transports', 'categoryTravelAddress', 'companions', 'complexity', 'month', 'over_nights_stay'] as const;

      // ✅ ОПТИМИЗАЦИЯ: Используем for...of вместо forEach для лучшей производительности
      for (const key of filterKeys) {
        const value = filter[key];
        if (Array.isArray(value) && value.length > 0) {
          count += value.length;
        }
      }

      // ✅ ОПТИМИЗАЦИЯ: Проверяем остальные поля отдельно
      if (filter.year) count += 1;
      if (filter.moderation !== undefined) count += 1;
      if (debSearch && debSearch.trim().length > 0) count += 1;

      return count;
    }, [filter, debSearch]); // ✅ ОПТИМИЗАЦИЯ: Зависимости стабильны

    // ✅ ОПТИМИЗАЦИЯ: Генерируем красивое сообщение для пустого состояния
    const getEmptyStateMessage = useMemo(() => {
      // ✅ ОПТИМИЗАЦИЯ: Быстрый возврат если не нужно показывать
      if (!showEmptyState) return null;

      const activeFilters: string[] = [];

      // ✅ ОПТИМИЗАЦИЯ: Предварительная проверка наличия опций
      if (!options?.categories) return null;

      // Определяем активные фильтры - оптимизированная версия с проверками типов
      if (Array.isArray(filter.categories) && filter.categories.length > 0) {
        const categoryNames = options.categories
          .filter((cat: any) => cat?.name && filter.categories?.includes(cat.id))
          .map((cat: any) => cat.name)
          .slice(0, 2);
        if (categoryNames.length > 0) {
          activeFilters.push(`категории "${categoryNames.join('", "')}"${categoryNames.length < filter.categories.length ? ' и другие' : ''}`);
        }
      }

      if (Array.isArray(filter.transports) && filter.transports.length > 0) {
        const transportNames = (options.transports || [])
          .filter((t: any) => t?.name && filter.transports?.some((fid: any) => String(fid) === String(t.id)))
          .map((t: any) => t.name)
          .slice(0, 2);
        if (transportNames.length > 0) {
          activeFilters.push(`транспорт "${transportNames.join('", "')}"${transportNames.length < filter.transports.length ? ' и другой' : ''}`);
        }
      }

      if (Array.isArray(filter.categoryTravelAddress) && filter.categoryTravelAddress.length > 0) {
        const objectNames = (options.categoryTravelAddress || [])
          .filter((obj: any) => obj?.name && filter.categoryTravelAddress?.some((fid: any) => String(fid) === String(obj.id)))
          .map((obj: any) => obj.name)
          .slice(0, 2);
        if (objectNames.length > 0) {
          activeFilters.push(`объекты "${objectNames.join('", "')}"${objectNames.length < filter.categoryTravelAddress.length ? ' и другие' : ''}`);
        }
      }

      // Остальные фильтры - простые проверки с type guards
      if (Array.isArray(filter.companions) && filter.companions.length > 0) activeFilters.push('спутники');
      if (Array.isArray(filter.complexity) && filter.complexity.length > 0) activeFilters.push('сложность');
      if (Array.isArray(filter.month) && filter.month.length > 0) activeFilters.push('месяц');
      if (Array.isArray(filter.over_nights_stay) && filter.over_nights_stay.length > 0) activeFilters.push('ночлег');
      if (filter.year) activeFilters.push(`год ${filter.year}`);
      if (debSearch) activeFilters.push(`поиск "${debSearch}"`);

      // Формируем сообщение
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
    }, [showEmptyState, filter, options?.categories, options?.transports, options?.categoryTravelAddress, debSearch]); // ✅ ОПТИМИЗАЦИЯ: Более точные зависимости

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
    <View style={[styles.root, isMobileDevice ? styles.rootMobile : undefined]}>
      <Suspense fallback={<TravelListSkeleton count={6} columns={columns} />}>
        <SidebarFilters
          isMobile={isMobileDevice}
          filterGroups={filterGroups}
          filter={filter}
          onSelect={onSelect}
          total={total}
          isSuper={isSuper}
          setSearch={setSearch}
          resetFilters={resetFilters}
          isVisible={!isMobileDevice || showFilters}
          onClose={isMobileDevice ? () => setShowFilters(false) : undefined}
          containerStyle={isMobileDevice ? [styles.sidebar, styles.sidebarMobile] : styles.sidebar}
        />

        <RightColumn
          search={search}
          setSearch={setSearch}
          onClearAll={() => {
            setSearch('')
            resetFilters()
            if (isMobileDevice) {
              setShowFilters(false)
            }
          }}
          isRecommendationsVisible={isRecommendationsVisible}
          handleRecommendationsVisibilityChange={handleRecommendationsVisibilityChange}
          activeFiltersCount={activeFiltersCount}
          total={total}
          contentPadding={contentPadding}
          showInitialLoading={showInitialLoading}
          isError={isError}
          showEmptyState={showEmptyState}
          getEmptyStateMessage={getEmptyStateMessage}
          travels={travels}
          gridColumns={gridColumns}
          isMobile={isMobileDevice}
          showNextPageLoading={showNextPageLoading}
          refetch={refetch}
          onFiltersPress={isMobileDevice ? () => setShowFilters(true) : undefined}
          containerStyle={isMobileDevice ? [styles.rightColumn, styles.rightColumnMobile] : styles.rightColumn}
          searchHeaderStyle={[styles.searchHeader, { paddingHorizontal: contentPadding }]}
          cardsContainerStyle={isMobileDevice ? [styles.cardsContainer, styles.cardsContainerMobile] : styles.cardsContainer}
          cardsGridStyle={cardsGridDynamicStyle}
          cardSpacing={gapSize}
          footerLoaderStyle={styles.footerLoader}
          renderItem={renderTravelListItem}
        />
      </Suspense>
    </View>
  );
}

export default memo(ListTravel);
export { ExportBar };
