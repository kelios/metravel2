import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
} from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useRoute } from 'expo-router'
import RenderTravelItem from './RenderTravelItem'
import ListTravelTopContent from './parts/ListTravelTopContent'
import ListTravelLayout from './parts/ListTravelLayout'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import StaleContentBanner from '@/components/ui/StaleContentBanner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useHydrationReady } from '@/hooks/useHydrationReady'
import type { Travel } from '@/types/types'
import { SEARCH_DEBOUNCE } from './utils/listTravelConstants'
import { useListTravelFilters } from './hooks/useListTravelFilters'
import { useListTravelData } from './hooks/useListTravelData'
import { useListTravelFilterOptions, useListTravelFacets } from './hooks/useListTravelFilterData'
import { useListTravelDelete } from './hooks/useListTravelDelete'
import { useListTravelExport } from './hooks/useListTravelExport'
import { useListTravelInitialFilter } from './hooks/useListTravelInitialFilter'
import { buildTravelFilterGroups } from './utils/filterGroups'
import {
  buildActiveConditionChips,
  buildEmptyStateMessage,
} from './ListTravelBase.helpers'
import type { ActiveConditionChip } from './ListTravelBase.helpers'
import { useRecommendationsVisibility } from './hooks/useRecommendationsVisibility'
import { createListTravelBaseStyles } from './ListTravelBase.styles'
import { useListViewStore } from '@/stores/listViewStore'
import { getCatalogHeaderSortingOptions } from './utils/sortings'
import type { ListStatusMode } from './ListCatalogToolbar'
import {
  applyListDensity,
  buildCardsGridDynamicStyle,
  buildListTravelFallbackSteps,
  buildListTravelSearchPendingState,
  getListTravelActiveFiltersCount,
  isListTravelAnyFallbackLoading,
  isListTravelFallbackStageExhausted,
  selectListTravelFallbackMatch,
  getSearchCardImageHeight,
  getSearchCardWidth,
} from './listTravelBaseModel'
import { useListTravelViewportState } from './hooks/useListTravelViewportState'
import ListTravelOwnUserGate, {
  getListTravelOwnUserGateMode,
} from './parts/ListTravelOwnUserGate'
import type { ListTravelBaseProps } from './ListTravelBase.types'


const EMPTY_FALLBACK_STEPS: ReturnType<typeof buildListTravelFallbackSteps> = [];

function ListTravelBase({ catalogIntro, primaryAction }: ListTravelBaseProps = {}) {
    const colors = useThemedColors();
    const hydrationReady = useHydrationReady();
    const { viewportState, width } = useListTravelViewportState();
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

    /* UI / dialogs */
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
    const {
      options,
      filterOptionsLoading,
      hasFilterOptionsError,
      refetchFilterOptions,
    } = useListTravelFilterOptions(shouldFetchFilterOptions);

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

    const facetCounts = useListTravelFacets({
      enabled: shouldFetchFilterOptions,
      search: debSearch,
      queryParams,
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
    /* Delete flow (state + race-guarded mutation + native confirm) lives in the hook. */
    const {
      deleteId,
      deleteError,
      requestDelete: handleDeletePress,
      confirmDelete,
      cancelDelete,
    } = useListTravelDelete();

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

    const travelStatusMode = useMemo<ListStatusMode>(() => {
      if (filter.draftsOnly === true) return 'drafts';
      if (filter.publishedOnly === true) return 'published';
      return 'all';
    }, [filter.draftsOnly, filter.publishedOnly]);

    const handleTravelStatusModeChange = useCallback(
      (mode: ListStatusMode) => {
        if (!isMeTravel) return;
        if (mode === 'drafts') {
          onSelect('draftsOnly', true);
          return;
        }
        if (mode === 'published') {
          onSelect('publishedOnly', true);
          return;
        }
        onSelect('draftsOnly', undefined);
        onSelect('publishedOnly', undefined);
      },
      [isMeTravel, onSelect],
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
      filter.draftsOnly,
      filter.publishedOnly,
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
    const ownUserGateMode = getListTravelOwnUserGateMode({
      authReady,
      hydrationReady,
      isAuthenticated,
      requiresOwnUser: isMeTravel || isExport,
    });
    if (ownUserGateMode) {
      return (
        <ListTravelOwnUserGate
          mode={ownUserGateMode}
          isExport={isExport}
          rootStyle={styles.root}
        />
      );
    }

  return (
    <ListTravelLayout
      rootStyle={[styles.root, usesOverlaySidebar ? styles.rootMobile : undefined]}
      deleteId={deleteId}
      deleteError={deleteError}
      onConfirmDelete={confirmDelete}
      onCloseDelete={cancelDelete}
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
        isError: hasFilterOptionsError,
        onRetry: () => { void refetchFilterOptions(); },
        onClose: usesOverlaySidebar ? handleCloseFilters : undefined,
        containerStyle: sidebarContainerStyle,
      }}
      rightColumn={{
        listIntroContent: catalogIntro,
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
        statusMode: travelStatusMode,
        onStatusModeChange: isMeTravel ? handleTravelStatusModeChange : undefined,
        showStatusModeToggle: isMeTravel,
        testID: 'travels-list',
        primaryAction,
      }}
    />
  );
}

export default memo(ListTravelBase);
