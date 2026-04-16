import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Platform,
  View,
  ViewStyle,
} from 'react-native'
import { useLocalSearchParams, usePathname } from 'expo-router'
import { useRoute } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import RenderTravelItem from './RenderTravelItem'
import SidebarFilters from './SidebarFilters'
import RightColumn from './RightColumn'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { fetchAllFiltersOptimized } from '@/api/miscOptimized'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useResponsive } from '@/hooks/useResponsive'
import type { Travel } from '@/types/types'
import {
  BREAKPOINTS,
  RECOMMENDATIONS_VISIBLE_KEY,
  SEARCH_DEBOUNCE,
} from './utils/listTravelConstants'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { useListTravelExport } from './hooks/useListTravelExport'
import { buildFacetCounts, buildTravelFilterGroups } from './utils/filterGroups'
import { fetchTravelFacets } from '@/api/travelListQueries'
import type { FilterOptions } from './utils/listTravelTypes'
import {
  normalizeCountryOptions,
  normalizeNamedOptions,
  removeTravelFromInfiniteTravelsCache,
} from './ListTravelBase.helpers'
import { createListTravelBaseStyles } from './ListTravelBase.styles'
import {
  buildListTravelInitialFilter,
  getListTravelActiveFiltersCount,
  getListTravelViewportState,
  normalizeListTravelParam,
} from './listTravelBaseModel'

const MemoizedTravelItem = memo(RenderTravelItem);
const ListTravelExportControlsLazy = lazy(() => import('./ListTravelExportControls'));

let nativeAsyncStorageModulePromise: Promise<typeof import('@react-native-async-storage/async-storage')> | null = null;

const getNativeAsyncStorageModule = async () => {
  if (!nativeAsyncStorageModulePromise) {
    nativeAsyncStorageModulePromise = import('@react-native-async-storage/async-storage');
  }

  return nativeAsyncStorageModulePromise;
};

const loadNativeRecommendationsVisibility = async (): Promise<boolean> => {
  const storageModule = await getNativeAsyncStorageModule();
  const stored = await storageModule.default.getItem(RECOMMENDATIONS_VISIBLE_KEY);
  return stored === 'true';
};

const saveNativeRecommendationsVisibility = async (visible: boolean) => {
  const storageModule = await getNativeAsyncStorageModule();
  await storageModule.default.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
};

function ListTravelBase() {
    const colors = useThemedColors();
    const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;
    const {
      width: rawWidth,
      isPhone,
      isLargePhone,
      isTablet: isTabletSize,
      isDesktop: isDesktopSize,
      isPortrait,
    } = useResponsive();


    const viewportState = getListTravelViewportState({
      isDesktopSize,
      isLargePhone,
      isPhone,
      isPortrait,
      isTabletSize,
      isTestEnv,
      rawWidth,
    });

    // Стабилизируем width: мобильная адресная строка может менять viewport
    const stableWidthRef = useRef(viewportState.width);
    const width = useMemo(() => {
      // Обновляем только при значительном изменении (>50px)
      if (Math.abs(viewportState.width - stableWidthRef.current) > 50) {
        stableWidthRef.current = viewportState.width;
      }
      return stableWidthRef.current;
    }, [viewportState.width]);
    const route = useRoute();
    const pathname = usePathname();

    const params = useLocalSearchParams<{
      user_id?: string;
      categories?: string | string[];
      over_nights_stay?: string | string[];
      // NOTE: expo-router sometimes escapes "_" in query keys to "__" on web.
      // We accept both variants to keep deep links stable.
      over__nights__stay?: string | string[];
      categoryTravelAddress?: string | string[];
      category_travel_address?: string | string[];
      category__travel__address?: string | string[];
      companions?: string | string[];
      complexity?: string | string[];
      month?: string | string[];
      sort?: string | string[];
      search?: string | string[];
    }>();

    // Extract individual param values for stable useMemo dependencies
    // (params object is a new reference every render from useLocalSearchParams)
    const user_id = params.user_id;
    const pSearch = params.search;
    const pCategories = params.categories;
    const pOverNightsStay = params.over_nights_stay;
    const pOverNightsStayAlt = params.over__nights__stay;
    const pCategoryTravelAddress = params.categoryTravelAddress;
    const pCategoryTravelAddressSnake = params.category_travel_address;
    const pCategoryTravelAddressAlt = params.category__travel__address;
    const pCompanions = params.companions;
    const pComplexity = params.complexity;
    const pMonth = params.month;
    const pSort = params.sort;

    const normalizedSearchParam = useMemo(
      () => normalizeListTravelParam(pSearch) ?? '',
      [pSearch]
    );

    const initialFilter = useMemo(() => {
      return buildListTravelInitialFilter({
        categories: pCategories,
        over_nights_stay: pOverNightsStay,
        over__nights__stay: pOverNightsStayAlt,
        categoryTravelAddress: pCategoryTravelAddress,
        category_travel_address: pCategoryTravelAddressSnake,
        category__travel__address: pCategoryTravelAddressAlt,
        companions: pCompanions,
        complexity: pComplexity,
        month: pMonth,
        sort: pSort,
      });
    }, [
      pCategories,
      pOverNightsStay,
      pOverNightsStayAlt,
      pCategoryTravelAddress,
      pCategoryTravelAddressSnake,
      pCategoryTravelAddressAlt,
      pCompanions,
      pComplexity,
      pMonth,
      pSort,
    ]);

    const isMeTravel = (route as any).name === "metravel" || pathname?.includes('/metravel');
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export" || pathname?.includes('/export');

    // На планшетах в портретной ориентации ведем себя как на мобильном: скрываем сайдбар и даем больше ширины сетке
    const isMobileDevice = viewportState.isMobileDevice;
    const sidebarWidth = viewportState.sidebarWidth;
    const styles = useMemo(() => createListTravelBaseStyles(colors, sidebarWidth), [colors, sidebarWidth]);
    // Cards layout rule: on mobile widths we always render a single column.
    const isCardsSingleColumn = viewportState.isCardsSingleColumn;
    const gapSize = viewportState.gapSize;

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

    const contentPadding = viewportState.contentPadding;
    const gridColumns = viewportState.gridColumns;

    const [isRecommendationsVisible, setIsRecommendationsVisible] = useState<boolean>(() => {
        if (Platform.OS !== 'web') return false;
        try {
            const stored = sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
            return stored === 'true';
        } catch {
            return false;
        }
    });
    const [recommendationsVisibilityInitialized, setRecommendationsVisibilityInitialized] = useState(
        Platform.OS === 'web'
    );

    useEffect(() => {
        // to avoid a post-paint setState that shifts the list.
        if (Platform.OS === 'web') {
            return;
        }

        let isMounted = true;

        const loadRecommendationsVisibility = async () => {
            try {
                const stored = await loadNativeRecommendationsVisibility();
                if (!isMounted) return;
                setIsRecommendationsVisible(stored);
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

    const handleRecommendationsVisibilityChange = useCallback((visible: boolean) => {
        if (!recommendationsVisibilityInitialized) {
            return;
        }

        setIsRecommendationsVisible(visible);

        // Сохраняем в storage
        const saveVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    // На web явно сохраняем "true" / "false", чтобы различать включенный и выключенный блок.
                    sessionStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
                } else {
                    await saveNativeRecommendationsVisibility(visible);
                }
            } catch (error) {
                console.error('Error saving recommendations visibility:', error);
            }
        };
        
        saveVisibility();
    }, [recommendationsVisibilityInitialized]);

    const queryClient = useQueryClient();

    /* Auth flags: используем AuthContext, который уже учитывает наличие токена */
    const { userId, isSuperuser: isSuper } = useAuth();

    /* Top-bar state */
    const [search, setSearch] = useState<string>(normalizedSearchParam);
    const debSearch = useDebouncedValue(
      search,
      isMobileDevice ? SEARCH_DEBOUNCE.MOBILE : SEARCH_DEBOUNCE.DESKTOP,
    );

    useEffect(() => {
      setSearch((prev) => (prev === normalizedSearchParam ? prev : normalizedSearchParam));
    }, [normalizedSearchParam]);

    const lastEndReachedAtRef = useRef<number>(0);
    const deleteInFlightRef = useRef<number | null>(null);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const flatListRef = useRef<any>(null);

    const shouldFetchFilterOptions = useMemo(() => {
      return !isMobileDevice || showFilters;
    }, [isMobileDevice, showFilters]);

    /* Filters options - оптимизированный запрос с кэшированием */
    const { data: rawOptions, isLoading: filterOptionsLoading } = useQuery({
        queryKey: ["filter-options"],
        queryFn: ({ signal } = {} as any) => fetchAllFiltersOptimized({ signal }),
        enabled: shouldFetchFilterOptions,
        staleTime: 10 * 60 * 1000,
    });

    const options = useMemo((): FilterOptions | undefined => {
       if (!rawOptions) return undefined;

       return {
           countries: normalizeCountryOptions(rawOptions.countries),
           categories: normalizeNamedOptions(rawOptions.categories),
           transports: normalizeNamedOptions(rawOptions.transports),
           categoryTravelAddress: normalizeNamedOptions(rawOptions.categoryTravelAddress),
           companions: normalizeNamedOptions(rawOptions.companions),
           complexity: normalizeNamedOptions(rawOptions.complexity),
           month: normalizeNamedOptions(rawOptions.month),
           over_nights_stay: normalizeNamedOptions(rawOptions.over_nights_stay),
           sortings: rawOptions.sortings || [],
       };
    }, [rawOptions]);

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
        initialFilter,
    });

    useEffect(() => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return;
      if (pathname !== '/search') return;

      const url = new URL(window.location.href);
      const sortValue = typeof filter.sort === 'string' ? filter.sort.trim() : '';
      const currentSort = (url.searchParams.get('sort') || '').trim();

      if (sortValue) {
        if (currentSort === sortValue) return;
        url.searchParams.set('sort', sortValue);
      } else {
        if (!currentSort) return;
        url.searchParams.delete('sort');
      }

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', nextPath);
    }, [filter.sort, pathname]);

    const {
      data: facetsData,
    } = useQuery({
      queryKey: ['travel-facets', debSearch, queryParams],
      queryFn: ({ signal } = {} as any) => fetchTravelFacets(debSearch, queryParams, { signal }),
      enabled: shouldFetchFilterOptions && !!options,
      staleTime: 30 * 1000,
    });

    const facetCounts = useMemo(
      () => buildFacetCounts(facetsData?.facets),
      [facetsData?.facets]
    );

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
        isFetching,
        isError,
        isInitialLoading,
        isNextPageLoading,
        isEmpty,
        refetch,
        handleEndReached,
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
          const { deleteTravel } = await import('@/api/travelsApi');
          await deleteTravel(String(targetId));
          removeTravelFromInfiniteTravelsCache(queryClient, targetId);
          setDelete(null);
          deleteInFlightRef.current = null;
          await queryClient.invalidateQueries({ queryKey: ["travels"] });
          if (Platform.OS === 'web') {
            // Можно добавить Toast здесь, если нужно
          }
        } catch (error) {
          const errorStatus =
            error && typeof error === 'object' && 'status' in error
              ? Number((error as { status?: unknown }).status)
              : null;
          const errorMessageText = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
          const isAlreadyDeleted =
            errorStatus === 404 ||
            errorMessageText.includes('404') ||
            errorMessageText.includes('not found') ||
            errorMessageText.includes('не найден');

          if (isAlreadyDeleted) {
            removeTravelFromInfiniteTravelsCache(queryClient, targetId);
            setDelete(null);
            deleteInFlightRef.current = null;
            await queryClient.invalidateQueries({ queryKey: ["travels"] });
            return;
          }

          deleteInFlightRef.current = null;
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

    const exportState = useListTravelExport(travels, { ownerName: userId });
    const {
      toggleSelect,
      toggleSelectAll,
      clearSelection,
      moveSelected,
      moveSelectedTo,
      isSelected,
      hasSelection,
      selectionCount,
      baseSettings,
      lastSettings,
      settingsSummary,
      setLastSettings,
    } = exportState;

    // Search cards should read closer to square on desktop, so we give the media more vertical room.
    // Keep mobile/tablet geometry tighter to avoid overgrowing the feed.
    // Use effectiveWidth (content area after sidebar) for correct sizing.
    const effectiveWidth = viewportState.effectiveWidth;
    const searchCardImageHeight = useMemo(() => {
      if (effectiveWidth < BREAKPOINTS.MOBILE) return 220;
      if (effectiveWidth < BREAKPOINTS.TABLET) return 240;
      if (effectiveWidth < BREAKPOINTS.DESKTOP) return 270;
      return 300;
    }, [effectiveWidth]);

    const searchCardWidth = useMemo(() => {
      if (Platform.OS !== 'web') return undefined;

      const columns = Math.max(gridColumns, 1);
      const totalGap = gapSize * Math.max(columns - 1, 0);
      const paddedWidth = effectiveWidth - contentPadding * 2;
      const resolvedWidth = (paddedWidth - totalGap) / columns;

      return Number.isFinite(resolvedWidth) && resolvedWidth > 0
        ? Math.round(resolvedWidth)
        : undefined;
    }, [effectiveWidth, gapSize, gridColumns, contentPadding]);

    const renderTravelListItem = useCallback(
      (travel: Travel, index: number) => (
        <MemoizedTravelItem
          item={travel}
          index={index}
          isMobile={isMobileDevice}
          isSuperuser={isSuper}
          currentUserId={userId != null ? String(userId) : null}
          isMetravel={isMeTravel}
          onDeletePress={handleDeletePress}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={isSelected(travel.id)}
          onToggle={() => toggleSelect(travel)}
          cardWidth={searchCardWidth}
          imageHeight={searchCardImageHeight}
          viewportWidth={width}
        />
      ),
      [
        handleDeletePress,
        isExport,
        isSelected,
        isMeTravel,
        isMobileDevice,
        isSuper,
        searchCardWidth,
        searchCardImageHeight,
        toggleSelect,
        userId,
        width,
      ]
    );

    /* Loading helpers */
    const hasAnyItems = travels.length > 0;

    const handleClearAll = useCallback(() => {
      setSearch('');
      resetFilters();
    }, [resetFilters]);

    const handleCloseFilters = useCallback(() => setShowFilters(false), []);
    const handleOpenFilters = useCallback(() => setShowFilters(true), []);

    const sidebarContainerStyle = useMemo(
      () => isMobileDevice ? [styles.sidebar, styles.sidebarMobile] : styles.sidebar,
      [isMobileDevice, styles.sidebar, styles.sidebarMobile]
    );

    const rightColumnContainerStyle = useMemo(
      () => isMobileDevice ? [styles.rightColumn, styles.rightColumnMobile] : styles.rightColumn,
      [isMobileDevice, styles.rightColumn, styles.rightColumnMobile]
    );

    const searchHeaderStyle = useMemo(
      () => isMobileDevice
        ? [styles.searchHeader, { paddingHorizontal: contentPadding }]
        : [styles.searchHeader, { paddingHorizontal: contentPadding }],
      [isMobileDevice, contentPadding, styles.searchHeader]
    );

    const cardsContainerStyle = useMemo(
      () => isMobileDevice ? [styles.cardsContainer, styles.cardsContainerMobile] : styles.cardsContainer,
      [isMobileDevice, styles.cardsContainer, styles.cardsContainerMobile]
    );
    
    const showInitialLoading = isInitialLoading || isUserIdLoading;
    const showNextPageLoading = isNextPageLoading;
    const normalizedSearchValue = search.trim();
    const normalizedDebouncedSearchValue = debSearch.trim();
    const isSearchInputPending = normalizedSearchValue !== normalizedDebouncedSearchValue;
    const isSearchFetchPending =
      !showInitialLoading &&
      !showNextPageLoading &&
      normalizedSearchValue.length > 0 &&
      normalizedSearchValue === normalizedDebouncedSearchValue &&
      isFetching;
    const isSearchPending = !isUserIdLoading && (isSearchInputPending || isSearchFetchPending);
    const showEmptyState = !isUserIdLoading && !isSearchPending && isEmpty;

    const handleListEndReached = useCallback(() => {
        if (!hasAnyItems) return;

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

    // Оптимизируем расчет путем использования стабильных ссылок на filter
    const activeFiltersCount = useMemo(() => getListTravelActiveFiltersCount(filter, debSearch), [filter, debSearch]);

    const getEmptyStateMessage = useMemo(() => {
      if (!showEmptyState) return null;

      const activeFilters: string[] = [];

      // Определяем активные фильтры - оптимизированная версия с проверками типов
      if (Array.isArray(filter.categories) && filter.categories.length > 0) {
        const categoryNames = (options?.categories || [])
          .filter((cat: any) => cat?.name && filter.categories?.includes(cat.id))
          .map((cat: any) => cat.name)
          .slice(0, 2);
        if (categoryNames.length > 0) {
          activeFilters.push(`категории "${categoryNames.join('", "')}"${categoryNames.length < filter.categories.length ? ' и другие' : ''}`);
        }
      }

      if (Array.isArray(filter.transports) && filter.transports.length > 0 && options?.transports) {
        const transportNames = (options.transports || [])
          .filter((t: any) => t?.name && filter.transports?.some((fid: any) => String(fid) === String(t.id)))
          .map((t: any) => t.name)
          .slice(0, 2);
        if (transportNames.length > 0) {
          activeFilters.push(`транспорт "${transportNames.join('", "')}"${transportNames.length < filter.transports.length ? ' и другой' : ''}`);
        }
      }

      if (Array.isArray(filter.categoryTravelAddress) && filter.categoryTravelAddress.length > 0 && options?.categoryTravelAddress) {
        const objectNames = (options.categoryTravelAddress || [])
          .filter((obj: any) => obj?.name && filter.categoryTravelAddress?.some((fid: any) => String(fid) === String(obj.id)))
          .map((obj: any) => obj.name)
          .slice(0, 2);
        if (objectNames.length > 0) {
          activeFilters.push(`что посмотреть "${objectNames.join('", "')}"${objectNames.length < filter.categoryTravelAddress.length ? ' и другие' : ''}`);
        }
      }

      // Остальные фильтры - простые проверки с type guards
      if (Array.isArray(filter.companions) && filter.companions.length > 0) activeFilters.push('спутники');
      if (Array.isArray(filter.complexity) && filter.complexity.length > 0) activeFilters.push('сложность');
      if (Array.isArray(filter.month) && filter.month.length > 0) activeFilters.push('месяц');
      if (Array.isArray(filter.over_nights_stay) && filter.over_nights_stay.length > 0) activeFilters.push('ночлег');
      if (filter.year) activeFilters.push(`год ${filter.year}`);
      if (filter.sort) activeFilters.push('сортировка');
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
      let description: string;
      if (activeFilters.length === 1) {
        description = `По фильтру ${activeFilters[0]} ничего не найдено.`;
      } else if (activeFilters.length === 2) {
        description = `По фильтрам ${activeFilters[0]} и ${activeFilters[1]} ничего не найдено.`;
      } else {
        const lastFilter = activeFilters[activeFilters.length - 1];
        const otherFilters = activeFilters.slice(0, -1).join(', ');
        description = `По фильтрам ${otherFilters} и ${lastFilter} ничего не найдено.`;
      }

      description += ' Попробуйте убрать фильтры или изменить запрос.';

      const suggestions = debSearch
        ? ['Проверьте написание', 'Попробуйте другие ключевые слова']
        : ['Уберите один из фильтров', 'Выберите другую категорию'];

      return {
        icon: 'search',
        title: 'Ничего не найдено',
        description,
        variant: 'search' as const,
        suggestions,
      };
    }, [showEmptyState, filter, options?.categories, options?.transports, options?.categoryTravelAddress, debSearch]);

    const filterGroups = useMemo(
      () => buildTravelFilterGroups({
        options,
        facetCounts,
        selectedFilters: filter,
        includeSort: true,
        hideCountries: isTravelBy,
      }),
      [options, filter, isTravelBy, facetCounts]
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
        isLoading={filterOptionsLoading}
        onClose={isMobileDevice ? handleCloseFilters : undefined}
        containerStyle={sidebarContainerStyle}
      />

      <RightColumn
        search={search}
        setSearch={setSearch}
        onClearAll={handleClearAll}
        topContent={
          isExport ? (
            <Suspense fallback={null}>
              <ListTravelExportControlsLazy
                isMobile={isMobileDevice}
                travels={travels}
                selected={exportState.selected}
                ownerName={userId}
                toggleSelectAll={toggleSelectAll}
                clearSelection={clearSelection}
                moveSelected={moveSelected}
                moveSelectedTo={moveSelectedTo}
                hasSelection={hasSelection}
                selectionCount={selectionCount}
                baseSettings={baseSettings}
                lastSettings={lastSettings}
                settingsSummary={settingsSummary}
                setLastSettings={setLastSettings}
              />
            </Suspense>
          ) : null
        }
        isRecommendationsVisible={isRecommendationsVisible}
        handleRecommendationsVisibilityChange={handleRecommendationsVisibilityChange}
        activeFiltersCount={activeFiltersCount}
        total={total}
        contentPadding={contentPadding}
        showInitialLoading={showInitialLoading}
        isSearchPending={isSearchPending}
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
        onFiltersPress={isMobileDevice ? handleOpenFilters : undefined}
        containerStyle={rightColumnContainerStyle}
        searchHeaderStyle={searchHeaderStyle}
        cardsContainerStyle={cardsContainerStyle}
        cardsGridStyle={cardsGridDynamicStyle}
        cardSpacing={gapSize}
        footerLoaderStyle={styles.footerLoader}
        renderItem={renderTravelListItem}
        listRef={flatListRef as any}
        isExport={isExport}
        testID="travels-list"
      />
    </View>
  );
}

export default memo(ListTravelBase);
