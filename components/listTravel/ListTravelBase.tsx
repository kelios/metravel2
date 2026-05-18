import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { showToastMessage } from '@/utils/toast'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'
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
  SEARCH_DEBOUNCE,
} from './utils/listTravelConstants'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { useListTravelExport } from './hooks/useListTravelExport'
import { buildFacetCounts, buildTravelFilterGroups } from './utils/filterGroups'
import { fetchTravelFacets } from '@/api/travelListQueries'
import type { FilterOptions, FilterState } from './utils/listTravelTypes'
import {
  SORT_LABEL_FALLBACKS,
  normalizeCountryOptions,
  normalizeNamedOptions,
  removeTravelFromInfiniteTravelsCache,
  summarizeFilterValues,
} from './ListTravelBase.helpers'
import { useRecommendationsVisibility } from './hooks/useRecommendationsVisibility'
import { createListTravelBaseStyles } from './ListTravelBase.styles'
import {
  buildListTravelInitialFilter,
  buildListTravelFallbackSteps,
  getListTravelActiveFiltersCount,
  getListTravelViewportState,
  normalizeListTravelParam,
} from './listTravelBaseModel'

const MemoizedTravelItem = memo(RenderTravelItem);
const ListTravelExportControlsLazy = lazy(() => import('./ListTravelExportControls'));

type ActiveConditionChip = {
  key: string
  label: string
  onRemove: () => void
}

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
    const router = useRouter();

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
    const usesOverlaySidebar = viewportState.usesOverlaySidebar;
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

    const {
        isRecommendationsVisible,
        setIsRecommendationsVisible: handleRecommendationsVisibilityChange,
    } = useRecommendationsVisibility();

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
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const flatListRef = useRef<any>(null);

    const shouldFetchFilterOptions = useMemo(() => {
      return !usesOverlaySidebar || showFilters;
    }, [usesOverlaySidebar, showFilters]);

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
      const searchValue = debSearch.trim();
      const currentSort = (url.searchParams.get('sort') || '').trim();
      const currentSearch = (url.searchParams.get('search') || '').trim();
      let changed = false;

      if (sortValue) {
        if (currentSort !== sortValue) {
          url.searchParams.set('sort', sortValue);
          changed = true;
        }
      } else if (currentSort) {
        url.searchParams.delete('sort');
        changed = true;
      }

      if (searchValue) {
        if (currentSearch !== searchValue) {
          url.searchParams.set('search', searchValue);
          changed = true;
        }
      } else if (currentSearch) {
        url.searchParams.delete('search');
        changed = true;
      }

      if (!changed) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', nextPath);
    }, [debSearch, filter.sort, pathname]);

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

    const fallbackSteps = useMemo(
      () =>
        buildListTravelFallbackSteps({
          queryParams,
          search: debSearch,
        }),
      [debSearch, queryParams],
    );

    const fallbackStepLight = fallbackSteps[0];
    const fallbackStepMedium = fallbackSteps[1];
    const fallbackStepBroad = fallbackSteps[2];
    const fallbackStepSearchless = fallbackSteps[3];

    const fallbackQueryLight = useListTravelData({
      queryParams: fallbackStepLight?.params ?? {},
      search: fallbackStepLight?.search ?? '',
      isQueryEnabled: isQueryEnabled && isEmpty && !!fallbackStepLight,
    });
    const fallbackQueryMedium = useListTravelData({
      queryParams: fallbackStepMedium?.params ?? {},
      search: fallbackStepMedium?.search ?? '',
      isQueryEnabled:
        isQueryEnabled &&
        isEmpty &&
        !fallbackQueryLight.isInitialLoading &&
        !fallbackQueryLight.isFetching &&
        !fallbackQueryLight.data.length &&
        !!fallbackStepMedium,
    });
    const fallbackQueryBroad = useListTravelData({
      queryParams: fallbackStepBroad?.params ?? {},
      search: fallbackStepBroad?.search ?? '',
      isQueryEnabled:
        isQueryEnabled &&
        isEmpty &&
        !fallbackQueryLight.isInitialLoading &&
        !fallbackQueryLight.isFetching &&
        !fallbackQueryLight.data.length &&
        !fallbackQueryMedium.isInitialLoading &&
        !fallbackQueryMedium.isFetching &&
        !fallbackQueryMedium.data.length &&
        !!fallbackStepBroad,
    });
    const fallbackQuerySearchless = useListTravelData({
      queryParams: fallbackStepSearchless?.params ?? {},
      search: fallbackStepSearchless?.search ?? '',
      isQueryEnabled:
        isQueryEnabled &&
        isEmpty &&
        !fallbackQueryLight.isInitialLoading &&
        !fallbackQueryLight.isFetching &&
        !fallbackQueryLight.data.length &&
        !fallbackQueryMedium.isInitialLoading &&
        !fallbackQueryMedium.isFetching &&
        !fallbackQueryMedium.data.length &&
        !fallbackQueryBroad.isInitialLoading &&
        !fallbackQueryBroad.isFetching &&
        !fallbackQueryBroad.data.length &&
        !!fallbackStepSearchless,
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
          void showToastMessage({
            type: 'success',
            text1: 'Путешествие удалено',
          });
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
            // Показываем ошибку в диалоге; он остаётся открытым чтобы пользователь мог попробовать снова
            setDeleteError(`${errorMessage}. ${errorDetails}`);
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
      setDeleteError(null);
      setDelete(id);
    }, []);

    // Подтверждение удаления — на native через Alert, на web — через ConfirmDialog (см. JSX ниже)
    useEffect(() => {
        if (!deleteId || Platform.OS === 'web') return;

        Alert.alert('Удалить путешествие?', 'Это действие нельзя отменить.', [
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
    const handleClearAll = useCallback(() => {
      setSearch('');
      resetFilters();
    }, [resetFilters]);

    const handleCloseFilters = useCallback(() => setShowFilters(false), []);
    const handleOpenFilters = useCallback(() => setShowFilters(true), []);

    const activeConditionChips = useMemo<ActiveConditionChip[]>(() => {
      const chips: ActiveConditionChip[] = []
      const addArrayChip = (
        key: keyof FilterState,
        title: string,
        values: Array<string | number> | undefined,
        optionList?: Array<{ id?: string | number; country_id?: string | number; name?: string; title_ru?: string }>,
      ) => {
        const label = summarizeFilterValues(title, values, optionList)
        if (!label) return
        chips.push({
          key: String(key),
          label,
          onRemove: () => onSelect(String(key), undefined),
        })
      }

      if (debSearch.trim()) {
        chips.push({
          key: 'search',
          label: `Поиск: ${debSearch.trim()}`,
          onRemove: () => setSearch(''),
        })
      }

      const sortValue = typeof filter.sort === 'string' ? filter.sort.trim() : ''
      if (sortValue) {
        const sortLabel =
          options?.sortings?.find((item) => item.id === sortValue)?.name ||
          SORT_LABEL_FALLBACKS[sortValue] ||
          sortValue
        chips.push({
          key: 'sort',
          label: `Сортировка: ${sortLabel}`,
          onRemove: () => onSelect('sort', undefined),
        })
      }

      addArrayChip('countries', 'Страны', filter.countries, options?.countries)
      addArrayChip('categories', 'Категории', filter.categories, options?.categories)
      addArrayChip('categoryTravelAddress', 'Что посмотреть', filter.categoryTravelAddress, options?.categoryTravelAddress)
      addArrayChip('transports', 'Транспорт', filter.transports, options?.transports)
      addArrayChip('companions', 'Спутники', filter.companions, options?.companions)
      addArrayChip('complexity', 'Сложность', filter.complexity, options?.complexity)
      addArrayChip('month', 'Месяц', filter.month, options?.month)
      addArrayChip('over_nights_stay', 'Ночлег', filter.over_nights_stay, options?.over_nights_stay)

      if (filter.year) {
        chips.push({
          key: 'year',
          label: `Год: ${filter.year}`,
          onRemove: () => onSelect('year', undefined),
        })
      }

      return chips
    }, [
      debSearch,
      filter.categories,
      filter.categoryTravelAddress,
      filter.companions,
      filter.complexity,
      filter.countries,
      filter.month,
      filter.over_nights_stay,
      filter.sort,
      filter.transports,
      filter.year,
      onSelect,
      options?.categories,
      options?.categoryTravelAddress,
      options?.companions,
      options?.complexity,
      options?.countries,
      options?.month,
      options?.over_nights_stay,
      options?.sortings,
      options?.transports,
    ]);

    const sidebarContainerStyle = useMemo(
      () => usesOverlaySidebar ? [styles.sidebar, styles.sidebarMobile] : styles.sidebar,
      [usesOverlaySidebar, styles.sidebar, styles.sidebarMobile]
    );

    const rightColumnContainerStyle = useMemo(
      () => isMobileDevice ? [styles.rightColumn, styles.rightColumnMobile] : styles.rightColumn,
      [isMobileDevice, styles.rightColumn, styles.rightColumnMobile]
    );

    const searchHeaderStyle = useMemo(
      () => [styles.searchHeader, { paddingHorizontal: contentPadding }],
      [contentPadding, styles.searchHeader]
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
        if (isMeTravel) {
          return {
            icon: 'map',
            title: 'У вас пока нет путешествий',
            description:
              'Создайте первое — расскажите о маршруте, добавьте фото и сохраните воспоминания.',
            variant: 'empty' as const,
            action: {
              label: 'Создать путешествие',
              onPress: () => router.push('/travel/new'),
            },
          };
        }
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
    }, [showEmptyState, filter, options?.categories, options?.transports, options?.categoryTravelAddress, debSearch, isMeTravel, router]);

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

    const fallbackMatch = useMemo(() => {
      const candidates = [
        { step: fallbackStepLight, query: fallbackQueryLight },
        { step: fallbackStepMedium, query: fallbackQueryMedium },
        { step: fallbackStepBroad, query: fallbackQueryBroad },
        { step: fallbackStepSearchless, query: fallbackQuerySearchless },
      ];

      return (
        candidates.find((candidate) => candidate.step && candidate.query.data.length > 0) ?? null
      );
    }, [
      fallbackQueryBroad,
      fallbackQueryLight,
      fallbackQueryMedium,
      fallbackQuerySearchless,
      fallbackStepBroad,
      fallbackStepLight,
      fallbackStepMedium,
      fallbackStepSearchless,
    ]);

    const activeFallbackMatch = isEmpty ? fallbackMatch : null;

    const isFallbackLoading =
      isEmpty &&
      !activeFallbackMatch &&
      (
        fallbackQueryLight.isInitialLoading ||
        fallbackQueryMedium.isInitialLoading ||
        fallbackQueryBroad.isInitialLoading ||
        fallbackQuerySearchless.isInitialLoading
      );

    const displayedTravels = activeFallbackMatch?.query.data ?? travels;
    const displayedTotal = activeFallbackMatch?.query.total ?? total;
    const displayedRefetch = activeFallbackMatch?.query.refetch ?? refetch;
    const displayedHandleEndReached = activeFallbackMatch?.query.handleEndReached ?? handleEndReached;
    const displayedShowNextPageLoading = activeFallbackMatch?.query.isNextPageLoading ?? isNextPageLoading;
    const hasDisplayedItems = displayedTravels.length > 0;
    const displayedShowEmptyState = !activeFallbackMatch && !isFallbackLoading && showEmptyState;
    const displayedShowInitialLoading = isInitialLoading || isFallbackLoading;

    const handleListEndReached = useCallback(() => {
        if (!hasDisplayedItems) return;

        const now = Date.now();
        // Простая защита от слишком частых вызовов onEndReached на web/мобильных
        if (now - lastEndReachedAtRef.current < 800) {
            return;
        }
        lastEndReachedAtRef.current = now;

        displayedHandleEndReached();
    }, [displayedHandleEndReached, hasDisplayedItems]);

    const topContent = useMemo(() => {
      const exportControls = isExport ? (
        <Suspense fallback={null}>
          <ListTravelExportControlsLazy
            isMobile={isMobileDevice}
            travels={displayedTravels}
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
      ) : null;

      const fallbackNotice = activeFallbackMatch?.step ? (
        <View style={styles.fallbackNotice} testID="travel-results-fallback-notice">
          <Text style={styles.fallbackNoticeTitle}>Похожие маршруты</Text>
          <Text style={styles.fallbackNoticeText}>
            По вашему запросу точных совпадений не нашлось. Подобрали похожие маршруты — возможно, что-то из них вам подойдёт.
          </Text>
          <Pressable
            onPress={handleClearAll}
            style={styles.fallbackNoticeAction}
            accessibilityRole="button"
            accessibilityLabel="Сбросить условия и показать все маршруты"
          >
            <Text style={styles.fallbackNoticeActionText}>Сбросить условия</Text>
          </Pressable>
        </View>
      ) : null;

      if (!fallbackNotice && !exportControls) return null;

      return (
        <>
          {fallbackNotice}
          {exportControls}
        </>
      );
    }, [
      baseSettings,
      clearSelection,
      displayedTravels,
      exportState.selected,
      activeFallbackMatch?.step,
      handleClearAll,
      hasSelection,
      isExport,
      isMobileDevice,
      lastSettings,
      moveSelected,
      moveSelectedTo,
      selectionCount,
      settingsSummary,
      setLastSettings,
      styles.fallbackNotice,
      styles.fallbackNoticeAction,
      styles.fallbackNoticeActionText,
      styles.fallbackNoticeText,
      styles.fallbackNoticeTitle,
      toggleSelectAll,
      userId,
    ]);
    
  return (
    <View style={[styles.root, usesOverlaySidebar ? styles.rootMobile : undefined]}>
      {/* Диалог подтверждения удаления (web) */}
      {Platform.OS === 'web' && (
        <ConfirmDialog
          visible={!!deleteId}
          title="Удалить путешествие?"
          message={deleteError ?? 'Это действие нельзя отменить.'}
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={() => handleDelete(deleteId ?? undefined)}
          onClose={() => { setDelete(null); setDeleteError(null); }}
          confirmTestID="confirm-delete-button"
          cancelTestID="cancel-delete-button"
        />
      )}
      <SidebarFilters
        isMobile={usesOverlaySidebar}
        filterGroups={filterGroups}
        filter={filter}
        onSelect={onSelect}
        total={displayedTotal}
        isSuper={isSuper}
        setSearch={setSearch}
        resetFilters={resetFilters}
        isVisible={!usesOverlaySidebar || showFilters}
        isLoading={filterOptionsLoading}
        onClose={usesOverlaySidebar ? handleCloseFilters : undefined}
        containerStyle={sidebarContainerStyle}
      />

      <RightColumn
        search={search}
        setSearch={setSearch}
        onClearAll={handleClearAll}
        activeConditionChips={activeConditionChips}
        topContent={topContent}
        isRecommendationsVisible={isRecommendationsVisible}
        handleRecommendationsVisibilityChange={handleRecommendationsVisibilityChange}
        activeFiltersCount={activeFiltersCount}
        total={displayedTotal}
        contentPadding={contentPadding}
        showInitialLoading={displayedShowInitialLoading}
        isSearchPending={isSearchPending}
        isError={isError}
        showEmptyState={displayedShowEmptyState}
        getEmptyStateMessage={getEmptyStateMessage}
        travels={displayedTravels}
        gridColumns={gridColumns}
        isMobile={isCardsSingleColumn}
        showNextPageLoading={displayedShowNextPageLoading}
        refetch={displayedRefetch}
        onEndReached={handleListEndReached}
        onEndReachedThreshold={0.5}
        onFiltersPress={usesOverlaySidebar ? handleOpenFilters : undefined}
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
