import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Platform,
  View,
} from 'react-native'
import type Feather from '@expo/vector-icons/Feather'
import { showToastMessage } from '@/utils/toast'
import { queryKeys } from '@/api/queryKeys'
import { usePathname, useRouter } from 'expo-router'
import { useRoute } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import RenderTravelItem from './RenderTravelItem'
import ListTravelTopContent from './parts/ListTravelTopContent'
import ListTravelLayout from './parts/ListTravelLayout'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import StaleContentBanner from '@/components/ui/StaleContentBanner'
import { buildLoginHref } from '@/utils/authNavigation'
import { fetchAllFiltersOptimized } from '@/api/miscOptimized'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useResponsive } from '@/hooks/useResponsive'
import type { Travel } from '@/types/types'
import { SEARCH_DEBOUNCE } from './utils/listTravelConstants'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { useListTravelExport } from './hooks/useListTravelExport'
import { useListTravelInitialFilter } from './hooks/useListTravelInitialFilter'
import { buildFacetCounts, buildTravelFilterGroups } from './utils/filterGroups'
import { fetchTravelFacets } from '@/api/travelListQueries'
import {
  buildActiveConditionChips,
  buildEmptyStateMessage,
  describeTravelDeleteError,
  isTravelAlreadyDeletedError,
  normalizeFilterOptions,
  removeTravelFromInfiniteTravelsCache,
} from './ListTravelBase.helpers'
import type { ActiveConditionChip } from './ListTravelBase.helpers'
import { useRecommendationsVisibility } from './hooks/useRecommendationsVisibility'
import { createListTravelBaseStyles } from './ListTravelBase.styles'
import { useListViewStore } from '@/stores/listViewStore'
import { getCatalogHeaderSortingOptions } from './utils/sortings'
import {
  applyListDensity,
  buildCardsGridDynamicStyle,
  buildListTravelFallbackSteps,
  buildListTravelSearchPendingState,
  getListTravelActiveFiltersCount,
  isListTravelAnyFallbackLoading,
  isListTravelFallbackStageExhausted,
  selectListTravelFallbackMatch,
  getListTravelViewportState,
  getSearchCardImageHeight,
  getSearchCardWidth,
} from './listTravelBaseModel'

const EMPTY_FALLBACK_STEPS: ReturnType<typeof buildListTravelFallbackSteps> = [];

type ListTravelBaseProps = {
  primaryAction?: {
    accessibilityHint?: string
    iconName: keyof typeof Feather.glyphMap
    label: string
    onPress: () => void
    testID: string
  }
}

function ListTravelBase({ primaryAction }: ListTravelBaseProps = {}) {
    const colors = useThemedColors();
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
      rawWidth,
    });

    // Стабилизируем width: мобильная адресная строка может менять viewport.
    // Обновляем только при значительном изменении (>50px). setState во время
    // рендера — поддерживаемый React-паттерн для производной величины с гистерезисом
    // (без мутации ref в рендере и без лишнего кадра).
    const [width, setWidth] = useState(viewportState.width);
    if (Math.abs(viewportState.width - width) > 50) {
      setWidth(viewportState.width);
    }
    const route = useRoute();
    const pathname = usePathname();
    const router = useRouter();

    const { user_id, normalizedSearchParam, initialFilter } = useListTravelInitialFilter();

    const isMeTravel = (route as any).name === "metravel" || pathname?.includes('/metravel');
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export" || pathname?.includes('/export');

    // На планшетах в портретной ориентации ведем себя как на мобильном: скрываем сайдбар и даем больше ширины сетке
    const isMobileDevice = viewportState.isMobileDevice;
    const usesOverlaySidebar = viewportState.usesOverlaySidebar;
    const sidebarWidth = viewportState.sidebarWidth;
    const styles = useMemo(() => createListTravelBaseStyles(colors, sidebarWidth), [colors, sidebarWidth]);
    const gapSize = viewportState.gapSize;

    const cardsGridDynamicStyle = useMemo(
      () => buildCardsGridDynamicStyle(styles.cardsGrid, gapSize),
      [gapSize, styles.cardsGrid]
    );

    const contentPadding = viewportState.contentPadding;

    // VIEW-DENSITY: client-side persisted density toggle (comfortable | compact).
    const density = useListViewStore((s) => s.density);
    const setDensity = useListViewStore((s) => s.setDensity);

    const baseSearchCardImageHeight = useMemo(
      () => getSearchCardImageHeight(viewportState.effectiveWidth),
      [viewportState.effectiveWidth]
    );

    const densityLayout = useMemo(
      () =>
        applyListDensity(
          {
            gridColumns: viewportState.gridColumns,
            isCardsSingleColumn: viewportState.isCardsSingleColumn,
            imageHeight: baseSearchCardImageHeight,
          },
          density
        ),
      [baseSearchCardImageHeight, density, viewportState.gridColumns, viewportState.isCardsSingleColumn]
    );

    // Cards layout rule: on mobile widths we render a single column unless the
    // user opts into the compact (multi-column) density.
    const isCardsSingleColumn = densityLayout.isCardsSingleColumn;
    const gridColumns = densityLayout.gridColumns;

    const {
        isRecommendationsVisible,
        setIsRecommendationsVisible: handleRecommendationsVisibilityChange,
    } = useRecommendationsVisibility();

    const queryClient = useQueryClient();

    /* Auth flags: используем AuthContext, который уже учитывает наличие токена */
    const { userId, isSuperuser: isSuper, isAuthenticated, authReady } = useAuth();

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

    // Deep links from the home page (e.g. ?categoryTravelAddress=84) arrive with active
    // filters but the option labels are needed to render readable active-filter chips. On
    // overlay layouts the options query is otherwise deferred until the filter sheet opens,
    // which would leave chips unresolved — so fetch eagerly whenever a deep link is active.
    const hasInitialFilter = !!initialFilter;
    const shouldFetchFilterOptions = useMemo(() => {
      return !usesOverlaySidebar || showFilters || hasInitialFilter;
    }, [usesOverlaySidebar, showFilters, hasInitialFilter]);

    /* Filters options - оптимизированный запрос с кэшированием */
    const { data: rawOptions, isLoading: filterOptionsLoading } = useQuery({
        queryKey: queryKeys.filterOptions(),
        queryFn: ({ signal }) => fetchAllFiltersOptimized({ signal }),
        enabled: shouldFetchFilterOptions,
        staleTime: 10 * 60 * 1000,
    });

    const options = useMemo(() => normalizeFilterOptions(rawOptions), [rawOptions]);

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
      queryKey: queryKeys.travelFacets(debSearch, queryParams),
      queryFn: ({ signal }) => fetchTravelFacets(debSearch, queryParams, { signal }),
      // Facets feed only the filter-sheet counters and consume debSearch+queryParams,
      // not filterOptions — so don't gate them on `!!options` (that serialized
      // facets behind the filterOptions request). They still wait for the same
      // shouldFetchFilterOptions condition (the sheet being relevant), and the
      // query key updates if options later remap textual categories → refetch.
      enabled: shouldFetchFilterOptions,
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
        staleContentMeta,
        refetch,
        handleEndReached,
    } = useListTravelData({
        queryParams,
        search: debSearch,
        isQueryEnabled,
    });

    // Запасные шаги нужны только когда основная выдача пуста. В обычном случае
    // отдаём стабильный пустой массив, чтобы 4 fallback-хука ниже не делали
    // никакой работы (пустые params + disabled query).
    const fallbackSteps = useMemo(
      () =>
        isEmpty
          ? buildListTravelFallbackSteps({
              queryParams,
              search: debSearch,
            })
          : EMPTY_FALLBACK_STEPS,
      [isEmpty, debSearch, queryParams],
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
        isListTravelFallbackStageExhausted(fallbackQueryLight) &&
        !!fallbackStepMedium,
    });
    const fallbackQueryBroad = useListTravelData({
      queryParams: fallbackStepBroad?.params ?? {},
      search: fallbackStepBroad?.search ?? '',
      isQueryEnabled:
        isQueryEnabled &&
        isEmpty &&
        isListTravelFallbackStageExhausted(fallbackQueryLight) &&
        isListTravelFallbackStageExhausted(fallbackQueryMedium) &&
        !!fallbackStepBroad,
    });
    const fallbackQuerySearchless = useListTravelData({
      queryParams: fallbackStepSearchless?.params ?? {},
      search: fallbackStepSearchless?.search ?? '',
      isQueryEnabled:
        isQueryEnabled &&
        isEmpty &&
        isListTravelFallbackStageExhausted(fallbackQueryLight) &&
        isListTravelFallbackStageExhausted(fallbackQueryMedium) &&
        isListTravelFallbackStageExhausted(fallbackQueryBroad) &&
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
          // Сбрасываем guard ТОЛЬКО после инвалидации: иначе повторный handleDelete(sameId)
          // в окне до завершения invalidate пройдёт и запустит второй deleteTravel (→ 404).
          await queryClient.invalidateQueries({ queryKey: queryKeys.travels() });
          deleteInFlightRef.current = null;
          void showToastMessage({
            type: 'success',
            text1: 'Путешествие удалено',
          });
        } catch (error) {
          if (isTravelAlreadyDeletedError(error)) {
            removeTravelFromInfiniteTravelsCache(queryClient, targetId);
            setDelete(null);
            await queryClient.invalidateQueries({ queryKey: queryKeys.travels() });
            deleteInFlightRef.current = null;
            return;
          }

          deleteInFlightRef.current = null;
          const { errorMessage, errorDetails } = describeTravelDeleteError(error);

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
    const searchCardImageHeight = densityLayout.imageHeight;

    const searchCardWidth = useMemo(
      () => getSearchCardWidth({ effectiveWidth, gapSize, gridColumns, contentPadding }),
      [effectiveWidth, gapSize, gridColumns, contentPadding]
    );

    const renderTravelListItem = useCallback(
      (travel: Travel, index: number) => (
        <RenderTravelItem
          item={travel}
          index={index}
          isMobile={isMobileDevice}
          isSuperuser={isSuper}
          currentUserId={userId != null ? String(userId) : null}
          isMetravel={isMeTravel}
          onDeletePress={handleDeletePress}
          // Грузим весь первый ряд eager/high-priority (а не только index 0):
          // на многоколоночных раскладках карточки 2..N тоже above-the-fold и
          // иначе показывали пустые серые боксы на первом кадре.
          isFirst={index < gridColumns}
          selectable={isExport}
          isSelected={isSelected(travel.id)}
          onToggle={isExport ? () => toggleSelect(travel) : undefined}
          cardWidth={searchCardWidth}
          imageHeight={searchCardImageHeight}
          viewportWidth={width}
          gridColumns={gridColumns}
        />
      ),
      [
        handleDeletePress,
        isExport,
        isSelected,
        isMeTravel,
        isMobileDevice,
        isSuper,
        gridColumns,
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

    /* SORT: header control reuses the backend-provided sortings list and the
       existing filter.sort query path (no extra request). */
    const sortOptions = useMemo(
      () => getCatalogHeaderSortingOptions(options?.sortings ?? []),
      [options?.sortings]
    );
    const sortValue = typeof filter.sort === 'string' ? filter.sort : '';
    const handleSortChange = useCallback(
      (id: string) => {
        onSelect('sort', sortValue === id ? '' : id);
      },
      [onSelect, sortValue]
    );

    const activeConditionChips = useMemo<ActiveConditionChip[]>(() => {
      return buildActiveConditionChips({
        debSearch,
        filter,
        options,
        onSelect,
        setSearch,
      })
    // Intentional granular deps (filter.* sub-keys) to avoid recompute on filter object-identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    const { isSearchPending, showEmptyState } = buildListTravelSearchPendingState({
      isInitialLoading,
      isUserIdLoading,
      isNextPageLoading,
      search,
      debSearch,
      isFetching,
      isEmpty,
    });

    // Оптимизируем расчет путем использования стабильных ссылок на filter
    const activeFiltersCount = useMemo(() => getListTravelActiveFiltersCount(filter, debSearch), [filter, debSearch]);

    const getEmptyStateMessage = useMemo(() => {
      return buildEmptyStateMessage({
        showEmptyState,
        filter,
        options,
        debSearch,
        isMeTravel,
        onCreateTravel: () => router.push('/travel/new'),
      });
    // Intentional granular deps (options?.* sub-keys) to avoid recompute on options object-identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const fallbackMatch = useMemo(() => selectListTravelFallbackMatch({
      isEmpty,
      fallbackStepLight,
      fallbackStepMedium,
      fallbackStepBroad,
      fallbackStepSearchless,
      fallbackQueryLight,
      fallbackQueryMedium,
      fallbackQueryBroad,
      fallbackQuerySearchless,
    }), [
      isEmpty,
      fallbackQueryBroad,
      fallbackQueryLight,
      fallbackQueryMedium,
      fallbackQuerySearchless,
      fallbackStepBroad,
      fallbackStepLight,
      fallbackStepMedium,
      fallbackStepSearchless,
    ]);
    const activeFallbackMatch = fallbackMatch;

    const isFallbackLoading = isEmpty && !activeFallbackMatch && isListTravelAnyFallbackLoading([fallbackQueryLight, fallbackQueryMedium, fallbackQueryBroad, fallbackQuerySearchless]);

    const displayedTravels = activeFallbackMatch?.query.data ?? travels;
    const displayedTotal = activeFallbackMatch?.query.total ?? total;
    const displayedRefetch = activeFallbackMatch?.query.refetch ?? refetch;
    const displayedHandleEndReached = activeFallbackMatch?.query.handleEndReached ?? handleEndReached;
    const displayedShowNextPageLoading = activeFallbackMatch?.query.isNextPageLoading ?? isNextPageLoading;
    const displayedStaleContentMeta = activeFallbackMatch?.query.staleContentMeta ?? staleContentMeta;
    const hasDisplayedItems = displayedTravels.length > 0;
    const displayedShowEmptyState = !activeFallbackMatch && !isFallbackLoading && showEmptyState;
    const displayedShowInitialLoading = isInitialLoading || isFallbackLoading;

    // Троттл lastEndReachedAtRef общий для всех источников. При переключении основной
    // выдачи ↔ fallback сбрасываем его, иначе первый onEndReached нового списка будет
    // проглочен таймстампом от предыдущего источника (залипание подгрузки).
    useEffect(() => {
        lastEndReachedAtRef.current = 0;
    }, [activeFallbackMatch?.step]);

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
      if (!displayedStaleContentMeta && !isExport && !activeFallbackMatch?.step) return null;
      return (
        <>
          <StaleContentBanner meta={displayedStaleContentMeta} />
          {(isExport || activeFallbackMatch?.step) ? (
            <ListTravelTopContent
              isExport={isExport}
              showFallbackNotice={!!activeFallbackMatch?.step}
              onClearAll={handleClearAll}
              styles={styles}
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
          ) : null}
        </>
      );
    // Intentional granular deps (styles.* sub-keys) to avoid recompute on styles object-identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      baseSettings,
      clearSelection,
      displayedStaleContentMeta,
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

    // Страницы "Мои путешествия" и экспорт привязаны к userId. Гостю показываем
    // login-wall (как на /favorites), а не пустой счётчик "0 путешествий".
    const requiresOwnUser = isMeTravel || isExport;
    if (requiresOwnUser && authReady && !isAuthenticated) {
      const loginRedirect = isExport ? '/export' : '/metravel';
      const loginIntent = isExport ? 'export' : 'metravel';
      return (
        <View style={styles.root}>
          <EmptyState
            icon="map-pin"
            title="Войдите в аккаунт"
            description="Войдите, чтобы видеть свои путешествия и собирать личную книгу поездок."
            action={{
              label: 'Войти',
              onPress: () =>
                router.push(buildLoginHref({ redirect: loginRedirect, intent: loginIntent }) as any),
            }}
          />
        </View>
      );
    }

  return (
    <ListTravelLayout
      rootStyle={[styles.root, usesOverlaySidebar ? styles.rootMobile : undefined]}
      deleteId={deleteId}
      deleteError={deleteError}
      onConfirmDelete={() => handleDelete(deleteId ?? undefined)}
      onCloseDelete={() => { setDelete(null); setDeleteError(null); }}
      sidebar={{
        isMobile: usesOverlaySidebar,
        filterGroups,
        filter,
        onSelect,
        total: displayedTotal,
        isSuper,
        isMeTravel,
        setSearch,
        resetFilters,
        isVisible: !usesOverlaySidebar || showFilters,
        isLoading: filterOptionsLoading,
        onClose: usesOverlaySidebar ? handleCloseFilters : undefined,
        containerStyle: sidebarContainerStyle,
      }}
      rightColumn={{
        search,
        setSearch,
        onClearAll: handleClearAll,
        activeConditionChips,
        topContent,
        isRecommendationsVisible,
        handleRecommendationsVisibilityChange,
        activeFiltersCount,
        total: displayedTotal,
        contentPadding,
        showInitialLoading: displayedShowInitialLoading,
        isSearchPending,
        isError,
        showEmptyState: displayedShowEmptyState,
        getEmptyStateMessage,
        travels: displayedTravels,
        gridColumns,
        isMobileViewport: viewportState.isCardsSingleColumn,
        isMobile: isCardsSingleColumn,
        showNextPageLoading: displayedShowNextPageLoading,
        refetch: displayedRefetch,
        onEndReached: handleListEndReached,
        onEndReachedThreshold: 0.5,
        onFiltersPress: usesOverlaySidebar ? handleOpenFilters : undefined,
        containerStyle: rightColumnContainerStyle,
        searchHeaderStyle,
        cardsContainerStyle,
        cardsGridStyle: cardsGridDynamicStyle,
        cardSpacing: gapSize,
        footerLoaderStyle: styles.footerLoader,
        renderItem: renderTravelListItem,
        listRef: flatListRef as any,
        isExport,
        sortOptions,
        sortValue,
        onSortChange: handleSortChange,
        density,
        onDensityChange: setDensity,
        showDensityToggle: true,
        testID: 'travels-list',
        primaryAction,
      }}
    />
  );
}

export default memo(ListTravelBase);
