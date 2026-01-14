// ✅ УЛУЧШЕНИЕ: ListTravel.tsx - мигрирован на DESIGN_TOKENS и useThemedColors
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, usePathname } from 'expo-router'
import { useRoute } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import RenderTravelItem from './RenderTravelItem'
import SidebarFilters from './SidebarFilters'
import RightColumn from './RightColumn'
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext'
import { fetchAllFiltersOptimized } from '@/src/api/miscOptimized'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useResponsive } from '@/hooks/useResponsive'
import type { Travel } from '@/src/types/types'
import {
  BREAKPOINTS,
  RECOMMENDATIONS_VISIBLE_KEY
} from './utils/listTravelConstants'
import { LAYOUT } from '@/constants/layout'
import { useListTravelVisibility } from './hooks/useListTravelVisibility'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { calculateColumns } from './utils/listTravelHelpers'

// ✅ ДИЗАЙН: Создание динамических стилей с useThemedColors
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    // Современный минималистичный layout
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: {
        minHeight: 900,
      },
    }),
  },
  rootMobile: {
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
    overflow: 'hidden',
    width: '100%',
  },
  contentMobile: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },
  sidebar: {
    width: 320,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.lg,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
  },
  listContainer: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
  listContainerMobile: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },
  exportBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.medium,
      } as any,
      ios: DESIGN_TOKENS.shadowsNative.medium,
      android: { elevation: 4 },
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  exportBarMobile: {
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.sm,
    alignItems: 'stretch',
    padding: DESIGN_TOKENS.spacing.sm,
  },
  exportBarMobileWeb: {
    marginHorizontal: -DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  exportBarInfo: {
    flex: 1,
    marginRight: DESIGN_TOKENS.spacing.md,
  },
  exportBarInfoTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  exportBarInfoSubtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  exportBarInfoActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  linkButton: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  exportBarButtons: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  exportBarButtonsMobile: {
    flexDirection: 'column',
    width: '100%',
    alignItems: 'stretch',
  },
  progressWrapper: {
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  recommendationsLoader: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  recommendationsSkeleton: {
    width: '100%',
  },
  recommendationsSkeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  recommendationsSkeletonTitle: {
    width: 120,
    height: 20,
    backgroundColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  recommendationsSkeletonTabs: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  recommendationsSkeletonContent: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  recommendationsSkeletonCard: {
    flex: 1,
    height: 80,
    backgroundColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  // ✅ RIGHT COLUMN: Основной контейнер правой части
  rightColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
    ...Platform.select({
      web: {
        minHeight: 900,
      },
    }),
    ...(Platform.OS === 'web' ? ({ paddingTop: DESIGN_TOKENS.spacing.lg } as const) : null),
  },
  rightColumnMobile: {
    width: '100%',
  },
  // ✅ SEARCH HEADER: Прикрепленный заголовок поиска
  searchHeader: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      } as any,
      ios: DESIGN_TOKENS.shadowsNative.light,
      android: { elevation: 2 },
      default: DESIGN_TOKENS.shadowsNative.light,
    }),
  },
  // ✅ CARDS CONTAINER: Прокручиваемый контейнер для карточек
  cardsContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
    // Горизонтальные отступы задаются динамически через contentPadding, чтобы избежать лишних белых полей
    paddingTop: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        minHeight: 900,
      },
    }),
  },
  cardsContainerMobile: {
    // Reserve space for the fixed mobile footer/dock so the last card is not covered.
    // Uses tabBarHeight as a stable dock height across platforms.
    paddingBottom: LAYOUT.tabBarHeight + DESIGN_TOKENS.spacing.xl,
    minHeight: 720,
  },
  // ✅ CARDS GRID: Flexbox layout for both platforms
  cardsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  resultsCount: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  resultsCountText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    color: colors.text,
  },
  footerLoader: {
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    alignItems: 'center',
  },
});

// Simple delete function implementation
const deleteTravel = async (id: string): Promise<void> => {
    const raw = process.env.EXPO_PUBLIC_API_URL || '';
    const trimmed = raw.replace(/\/+$/, '');
    const normalized = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    const response = await fetch(`${normalized}/travels/${id}/`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error(`Failed to delete travel: ${response.statusText}`);
    }
};

const MemoizedTravelItem = memo(RenderTravelItem);

interface ListTravelProps {
    onTogglePersonalization?: () => void;
    onToggleWeeklyHighlights?: () => void;
    isPersonalizationVisible?: boolean;
    isWeeklyHighlightsVisible?: boolean;
}

function ListTravelBase({
    onTogglePersonalization,
    isPersonalizationVisible: externalPersonalizationVisible,
    onToggleWeeklyHighlights,
    isWeeklyHighlightsVisible: externalWeeklyHighlightsVisible,
}: ListTravelProps = {}) {
    // ✅ ДИЗАЙН: Используем динамические цвета темы
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // ✅ АРХИТЕКТУРА: Использование кастомного хука для видимости
    useListTravelVisibility({
        externalPersonalizationVisible,
        externalWeeklyHighlightsVisible,
        onTogglePersonalization,
        onToggleWeeklyHighlights,
    });

    const { width, isPhone, isLargePhone, isTablet: isTabletSize, isDesktop: isDesktopSize, isPortrait } = useResponsive();
    const route = useRoute();
    const pathname = usePathname();

    const params = useLocalSearchParams<{ user_id?: string }>();
    const user_id = params.user_id;

    const isMeTravel = (route as any).name === "metravel";
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export" || pathname?.includes('/export');
    const isTestEnv = process.env.NODE_ENV === 'test';

    // ✅ Используем значения из useResponsive
    const windowWidth = Platform.OS === 'web' && isTestEnv ? Math.max(width, 1024) : width;

    // ✅ АДАПТИВНОСТЬ: Определяем устройство и ориентацию
    // На планшетах в портретной ориентации ведем себя как на мобильном: скрываем сайдбар и даем больше ширины сетке
    const isMobileDevice = isPhone || isLargePhone || (isTabletSize && isPortrait);
    // Cards layout rule: on mobile widths we always render a single column.
    const isCardsSingleColumn = windowWidth < BREAKPOINTS.MOBILE;
    const isTablet = isTabletSize;
    const isDesktop = isDesktopSize;

    const gapSize =
      windowWidth < BREAKPOINTS.XS
        ? 6
        : windowWidth < BREAKPOINTS.SM
          ? 8
          : windowWidth < BREAKPOINTS.MOBILE
            ? 10
            : windowWidth < BREAKPOINTS.TABLET
              ? 12
              : windowWidth < BREAKPOINTS.DESKTOP
                ? 14
                : 16;

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
    }, [gapSize, styles.cardsGrid]);

    // ✅ ОПТИМИЗАЦИЯ: Стабильные адаптивные отступы и ширина правой колонки
    // На мобильном layout используем полную ширину, на десктопе вычитаем ширину sidebar
    const effectiveWidth = isDesktop ? windowWidth - 320 : windowWidth; // 320px ~ ширина sidebar (только когда sidebar реально видим)

    const contentPadding = useMemo(() => {
      // ✅ ОПТИМИЗАЦИЯ: Используем стабильные breakpoints для избежания лишних перерасчетов
      if (effectiveWidth < BREAKPOINTS.XS) return 12;  // XS: компактные устройства
      if (effectiveWidth < BREAKPOINTS.SM) return 8; // SM: чуть уже карточки на очень маленьких телефонах
      if (effectiveWidth < BREAKPOINTS.MOBILE) return 10; // Mobile: стандартные телефоны — синхронизировано
      if (effectiveWidth < BREAKPOINTS.TABLET) return 12; // Tablet
      if (effectiveWidth < BREAKPOINTS.DESKTOP) return 12; // Desktop
      if (effectiveWidth < BREAKPOINTS.DESKTOP_LARGE) return 16; // Large Desktop
      return 20; // XXL
    }, [effectiveWidth]); // ✅ ОПТИМИЗАЦИЯ: Только эффективная ширина в зависимостях

    const gridColumns = useMemo(() => {
      if (isCardsSingleColumn) {
        return 1;
      }

      if (isMobileDevice) {
        return calculateColumns(windowWidth, isPortrait ? 'portrait' : 'landscape');
      }

      if (!isTablet || !isPortrait) {
        return calculateColumns(effectiveWidth, 'landscape');
      }

      return calculateColumns(effectiveWidth, 'portrait');
    }, [effectiveWidth, isCardsSingleColumn, isMobileDevice, isTablet, isPortrait, windowWidth]);

    const [isRecommendationsVisible, setIsRecommendationsVisible] = useState<boolean>(() => {
        if (Platform.OS !== 'web') return false;
        try {
            const stored = sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
            return stored === 'true';
        } catch {
            return false;
        }
    });
    const [recommendationsReady, setRecommendationsReady] = useState(() => {
        if (Platform.OS !== 'web') return true;
        return isRecommendationsVisible;
    });
    const [recommendationsVisibilityInitialized, setRecommendationsVisibilityInitialized] = useState(
        Platform.OS === 'web'
    );

    useEffect(() => {
        // ✅ CLS fix: on web we already initialize synchronously from sessionStorage
        // to avoid a post-paint setState that shifts the list.
        if (Platform.OS === 'web') {
            return;
        }

        let isMounted = true;

        const loadRecommendationsVisibility = async () => {
            try {
                const stored = await AsyncStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
                if (!isMounted) return;
                const visible = stored === 'true';
                setIsRecommendationsVisible(visible);
                if (visible) {
                    setRecommendationsReady(true);
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
                    await AsyncStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
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
    const deleteInFlightRef = useRef<number | null>(null);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    /* Filters options - оптимизированный запрос с кэшированием */
    const { data: rawOptions, isLoading: filterOptionsLoading } = useQuery({
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
        hasMore: _hasMore,
        isLoading: _isLoading,
        isFetching: _isFetching,
        isError,
        status: _status,
        isInitialLoading,
        isNextPageLoading,
        isEmpty,
        refetch,
        handleEndReached,
        handleRefresh: _handleRefresh,
        isRefreshing: _isRefreshing,
    } = useListTravelData({
        queryParams,
        search: debSearch,
        isQueryEnabled,
    });
    /* Delete */
    const handleDelete = useCallback(
      async (explicitId?: number) => {
        const targetId = explicitId ?? deleteId;
        if (!targetId) return;
        if (deleteInFlightRef.current === targetId) return;
        deleteInFlightRef.current = targetId;
        try {
          await deleteTravel(String(targetId));
          setDelete(null);
          deleteInFlightRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["travels"] });
          // ✅ УЛУЧШЕНИЕ: Показываем успешное сообщение
          if (Platform.OS === 'web') {
            // Можно добавить Toast здесь, если нужно
          }
        } catch (error) {
          deleteInFlightRef.current = null;
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
      },
      [deleteId, queryClient]
    );

    const handleDeletePress = useCallback((id: number) => {
      // Всегда сохраняем id, подтверждение выполняем в useEffect для единообразия
      setDelete(id);
    }, []);

    useEffect(() => {
        if (!deleteId) return;
        const title = 'Удалить путешествие?';
        const message = 'Это действие нельзя отменить.';

        if (Platform.OS === 'web') {
            const ok =
                typeof (globalThis as any).confirm === 'function'
                    ? (globalThis as any).confirm(`${title}\n\n${message}`)
                    : true;

            if (ok) {
                handleDelete(deleteId);
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

    const renderTravelListItem = useCallback(
      (travel: Travel, index: number) => (
        <MemoizedTravelItem
          item={travel}
          index={index}
          isMobile={isMobileDevice}
          isSuperuser={isSuper}
          isMetravel={isMeTravel}
          onDeletePress={handleDeletePress}
          isFirst={index === 0}
          selectable={false}
        />
      ),
      [
        handleDeletePress,
        isMeTravel,
        isMobileDevice,
        isSuper,
      ]
    );

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
                } catch (error) {
                    console.warn('Failed to restore travel list scroll position', error);
                }
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
    const filterGroups = useMemo(
      () => [
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
    ],
      [
        isTravelBy,
        options?.countries,
        options?.categories,
        options?.transports,
        options?.categoryTravelAddress,
        options?.companions,
        options?.complexity,
        options?.month,
        options?.over_nights_stay,
      ]
    );
    
  return (
    <View style={[styles.root, isMobileDevice ? styles.rootMobile : undefined]}>
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
        isLoading={filterOptionsLoading || !options}
        onClose={() => setShowFilters(false)}
        containerStyle={isMobileDevice ? [styles.sidebar, styles.sidebarMobile] : styles.sidebar}
      />

      <RightColumn
        search={search}
        setSearch={setSearch}
        onClearAll={() => {
          setSearch('');
          resetFilters();
          if (isMobileDevice) {
            setShowFilters(false);
          }
        }}
        availableWidth={effectiveWidth}
        topContent={null}
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
        isMobile={isCardsSingleColumn}
        showNextPageLoading={showNextPageLoading}
        refetch={refetch}
        onEndReached={handleListEndReached}
        onEndReachedThreshold={0.5}
        onFiltersPress={isMobileDevice ? () => setShowFilters(true) : undefined}
        containerStyle={isMobileDevice ? [styles.rightColumn, styles.rightColumnMobile] : styles.rightColumn}
        searchHeaderStyle={
          isMobileDevice
            ? [{ minHeight: 0, paddingHorizontal: contentPadding }]
            : [styles.searchHeader, { paddingHorizontal: contentPadding }]
        }
        cardsContainerStyle={isMobileDevice ? [styles.cardsContainer, styles.cardsContainerMobile] : styles.cardsContainer}
        cardsGridStyle={cardsGridDynamicStyle}
        cardSpacing={gapSize}
        footerLoaderStyle={styles.footerLoader}
        renderItem={renderTravelListItem}
        listRef={flatListRef as any}
        testID="travels-list"
      />
    </View>
  );
}

export default memo(ListTravelBase);
