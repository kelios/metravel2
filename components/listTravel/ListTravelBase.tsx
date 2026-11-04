import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
} from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useRoute } from 'expo-router'
import RenderTravelItem from './RenderTravelItem'
import ListTravelTopContent from './parts/ListTravelTopContent'
import ListTravelLayout from './parts/ListTravelLayout'
import { useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import StaleContentBanner from '@/components/ui/StaleContentBanner'
import { resolveListFeedbackSlots } from '@/components/travel/TravelModerationFeedback'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { markSsgFirstScreenReady, useHydrationReady } from '@/hooks/useHydrationReady'
import type { Travel } from '@/types/types'
import { omitTravelSortQueryParams } from '@/api/travelQueryShared'
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
  buildSearchAnalyticsFilters,
} from './ListTravelBase.helpers'
import type { ActiveConditionChip } from './ListTravelBase.helpers'
import { useRecommendationsVisibility } from './hooks/useRecommendationsVisibility'
import { createListTravelBaseStyles } from './ListTravelBase.styles'
import { useListViewStore } from '@/stores/listViewStore'
import { useCatalogSort } from './hooks/useCatalogSort'
import { useTravelCardDistanceOrigin } from './useTravelCardDistanceOrigin'
import type { ListStatusMode } from './ListCatalogToolbar'
import {
  applyListDensity,
  buildCardsGridDynamicStyle,
  buildListTravelSearchPendingState,
  getListTravelActiveFiltersCount,
  getCatalogCardMediaLoading,
  getSearchCardImageHeight,
  getSearchCardWidth,
  shouldSidebarIncludeSort,
} from './listTravelBaseModel'
import { useListTravelViewportState } from './hooks/useListTravelViewportState'
import { useSearchAlsoFound } from './hooks/useSearchAlsoFound'
import { useTravelCatalogSearchAnalytics } from './useTravelCatalogSearchAnalytics'
import ListTravelOwnUserGate, {
  getListTravelOwnUserGateMode,
} from './parts/ListTravelOwnUserGate'
import type { ListTravelBaseProps } from './ListTravelBase.types'
import AiSearchPanel from '@/components/aiPicks/AiSearchPanel';
import { isAiPicksEnabled } from '@/utils/aiPicksConfig';
import { translate as i18nT } from '@/i18n';

const isSearchPathname = (value: string | null | undefined): boolean =>
  /(^|\/)search\/?$/.test(String(value ?? ''));


function ListTravelBase({ catalogIntro, enabled = true, initialViewportWidth, primaryAction }: ListTravelBaseProps = {}) {
    const colors = useThemedColors();
    const hydrationReady = useHydrationReady();
    const route = useRoute();
    const pathname = usePathname();
    const router = useRouter();

    const { user_id, normalizedSearchParam, initialFilter } = useListTravelInitialFilter();
    const useSharedWebFilters = Platform.OS === 'web' && (pathname === '/search' || pathname === '/travelsby');
    const { viewportState, width } = useListTravelViewportState(initialViewportWidth, useSharedWebFilters);

    const isMeTravel = (route as any).name === "metravel" || pathname?.includes('/metravel');
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export" || pathname?.includes('/export');
    // #2903: «Ближе ко мне» — только публичный каталог; точка — та же, от которой
    // карточки пишут «N км» (позиция с уже выданным доступом, иначе Минск).
    const isPublicCatalog = !isMeTravel && !isExport && !user_id;
    const cardDistanceOrigin = useTravelCardDistanceOrigin();
    const distanceOrigin = isPublicCatalog ? cardDistanceOrigin : null;

    // На планшетах в портретной ориентации ведем себя как на мобильном: скрываем сайдбар и даем больше ширины сетке
    const isMobileDevice = viewportState.isMobileDevice;
    const usesOverlaySidebar = viewportState.usesOverlaySidebar;
    const sidebarWidth = viewportState.sidebarWidth;
    const dockPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl);
    const styles = useMemo(
      () => createListTravelBaseStyles(colors, sidebarWidth, dockPadding),
      [colors, dockPadding, sidebarWidth],
    );
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
    const { userId, isSuperuser: isSuper, isAuthenticated, authReady } = useAuth((auth) => ({
      userId: auth.userId,
      isSuperuser: auth.isSuperuser,
      isAuthenticated: auth.isAuthenticated,
      authReady: auth.authReady,
    }));

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
      return enabled && (!usesOverlaySidebar || showFilters || hasInitialFilter);
    }, [enabled, usesOverlaySidebar, showFilters, hasInitialFilter]);

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
        hasNamedCategoryFilters,
        resetFilters,
        onSelect,
    } = useListTravelFilters({
        options,
        isMeTravel,
        isSuperuser: isSuper && isAuthenticated && authReady,
        isExport,
        isTravelBy,
        userId,
        user_id,
        initialFilter,
        distanceOrigin,
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
      // Счётчики от порядка не зависят: смена сортировки/точки (#2903) их не перезапрашивает.
      queryParams: omitTravelSortQueryParams(queryParams),
    });

    const isWaitingForNamedFilters = hasNamedCategoryFilters && filterOptionsLoading;
    const isQueryEnabled = enabled && !isWaitingForNamedFilters &&
      (isMeTravel || isExport ? !!userId : true);

    // Если для страницы требуется конкретный пользователь ("Мои путешествия" или экспорт),
    // то до загрузки userId блокируем основной запрос.
    const isUserIdLoading = (isMeTravel || isExport) && !userId;
    
    const {
        data: travels,
        total,
        relaxation,
        isFetching,
        isError,
        isInitialLoading: isCatalogLoading,
        isNextPageLoading,
        isEmpty,
        staleContentMeta,
        refetch,
        handleEndReached,
    } = useListTravelData({
        queryParams,
        search: debSearch,
        isQueryEnabled,
        relaxCatalog: isPublicCatalog,
    });
    const isInitialLoading = isCatalogLoading || isWaitingForNamedFilters;

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


    /* Loading helpers */
    const handleClearAll = useCallback(() => {
      setSearch('');
      resetFilters();
    }, [resetFilters]);

    const handleCloseFilters = useCallback(() => setShowFilters(false), []);
    const handleOpenFilters = useCallback(() => setShowFilters(true), []);

    // #2903: переключатель в шапке, память сессии и `search_sort_change`.
    const { handleFilterSelect, handleSortChange, sortOptions, sortValue } = useCatalogSort({
      enabled: isPublicCatalog,
      hydrationReady,
      urlSort: typeof initialFilter?.sort === 'string' ? initialFilter.sort : '',
      search: normalizedSearchParam,
      entry: initialFilter,
      sortings: options?.sortings,
      sortValue: filter.sort,
      onSelect,
    });

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
        onSelect('allAuthorsUnpublishedOnly', undefined);
      },
      [isMeTravel, onSelect],
    );

    const activeConditionChips = useMemo<ActiveConditionChip[]>(() => {
      return buildActiveConditionChips({
        debSearch,
        filter,
        options,
        onSelect: handleFilterSelect,
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
      filter.allAuthorsUnpublishedOnly,
      filter.month,
      filter.over_nights_stay,
      filter.sort,
      filter.transports,
      filter.year,
      handleFilterSelect,
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

    const isSiteSearch = !isExport && !isMeTravel && !isTravelBy && !user_id && isSearchPathname(pathname);

    const getEmptyStateMessage = useMemo(() => {
      return buildEmptyStateMessage({
        showEmptyState,
        filter,
        options,
        debSearch,
        isMeTravel,
        // #2895: пустой поиск по сайту не тупик — под сообщением популярные маршруты.
        showPopularFallback: isSiteSearch,
        onCreateTravel: () => router.push('/travel/new'),
      });
    // Intentional granular deps (options?.* sub-keys) to avoid recompute on options object-identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showEmptyState, filter, options?.categories, options?.transports, options?.categoryTravelAddress, debSearch, isMeTravel, isSiteSearch, router]);

    const filterGroups = useMemo(
      () => buildTravelFilterGroups({
        options,
        facetCounts,
        selectedFilters: filter,
        includeSort: shouldSidebarIncludeSort({ usesOverlaySidebar, isExport }),
        includeProximitySort: isPublicCatalog,
        hideCountries: isTravelBy,
      }),
      [options, filter, isTravelBy, facetCounts, usesOverlaySidebar, isExport, isPublicCatalog]
    );

    const relaxedStage = relaxation && relaxation.stage !== 'strict' && relaxation.stage !== 'none'
      ? relaxation.stage
      : undefined;
    const hasDisplayedItems = travels.length > 0;
    const showRelaxationNotice = !!relaxedStage && hasDisplayedItems;
    const removedFilterLabels = useMemo(() => (relaxation?.removedFilterKeys ?? []).flatMap((key) => {
      const label = activeConditionChips.find((chip) => chip.key === key)?.label
        ?? filterGroups.find((group) => group.key === key)?.title
        ?? (key === 'countries' ? i18nT('travel:components.listTravel.utils.filterGroups.strany_a1b4317d') : undefined);
      return label ? [label] : [];
    }), [activeConditionChips, filterGroups, relaxation]);

    const authorFeedbackSlots = useMemo(
      () => (isMeTravel ? resolveListFeedbackSlots(travels) : undefined),
      [isMeTravel, travels]
    );

    const renderTravelListItem = useCallback(
      (travel: Travel, index: number, hasUserScrolled = false) => {
        const mediaLoading = getCatalogCardMediaLoading(index, gridColumns, hasUserScrolled)

        return (
          <RenderTravelItem
            item={travel}
            index={index}
            isMobile={isMobileDevice}
            isSuperuser={isSuper}
            currentUserId={userId != null ? String(userId) : null}
            isMetravel={isMeTravel}
            authorFeedbackSlots={authorFeedbackSlots}
            onDeletePress={handleDeletePress}
            // Грузим весь начальный первый ряд eager/high-priority (а не только
            // index 0). После первого скролла все ремоунты переходят на lazy/low.
            isFirst={mediaLoading === 'eager'}
            mediaLoading={mediaLoading}
            selectable={isExport}
            isSelected={isSelected(travel.id)}
            onToggle={isExport ? () => toggleSelect(travel) : undefined}
            cardWidth={searchCardWidth}
            imageHeight={searchCardImageHeight}
            viewportWidth={width}
            gridColumns={gridColumns}
          />
        )
      },
      [
        authorFeedbackSlots,
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

    // #1406: SSG-шелл каталога снимается по готовности ДАННЫХ, а не кода
    // приложения (`app-hydrated` приходит на ~1 с раньше первых карточек, и
    // пользователь смотрел на голый SearchPageSkeleton). Терминальное состояние
    // первого экрана — реальные карточки, честное «пусто» или ошибка; только в
    // этот момент маршрут сообщает removal-скрипту о готовности. Контракт
    // markSsgFirstScreenReady требует от маршрута, ждущего данных, именно
    // такой предикат. Атрибут, выставленный однажды, при смене фильтров не
    // снимается: шелл одноразовый, а повторное «не готово» относится уже не к
    // первому экрану.
    const firstScreenReady =
      !isInitialLoading &&
      (hasDisplayedItems || showEmptyState || isError);
    const firstScreenCleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!firstScreenReady || firstScreenCleanupRef.current) return;
        firstScreenCleanupRef.current = markSsgFirstScreenReady();
    }, [firstScreenReady]);
    useEffect(() => () => { firstScreenCleanupRef.current?.(); }, []);

    const searchAnalyticsFilters = useMemo(
      () => (isSiteSearch ? buildSearchAnalyticsFilters(queryParams, filter) : null),
      [isSiteSearch, queryParams, filter],
    );
    useTravelCatalogSearchAnalytics({
      enabled: isSiteSearch,
      query: debSearch,
      filtersKey: searchAnalyticsFilters?.filtersKey ?? '',
      hasFilters: searchAnalyticsFilters?.hasFilters ?? false,
      settled: firstScreenReady && !isSearchPending,
      isZeroResults: showEmptyState,
      isError,
      resultsCount: total,
      relaxedFilters: showRelaxationNotice,
    });

    useEffect(() => {
        lastEndReachedAtRef.current = 0;
    }, [debSearch, queryParams, relaxedStage]);

    const handleListEndReached = useCallback(() => {
        if (!hasDisplayedItems) return;

        const now = Date.now();
        // Простая защита от слишком частых вызовов onEndReached на web/мобильных
        if (now - lastEndReachedAtRef.current < 800) {
            return;
        }
        lastEndReachedAtRef.current = now;

        handleEndReached();
    }, [handleEndReached, hasDisplayedItems]);

    // #2459: строка смыслового подбора только на /search (не «мои», не экспорт) и под флагом.
    const showAiSearchPanel = isAiPicksEnabled() && isSiteSearch;
    // #2775: строка «Ещё по запросу» (квесты и места) — над карточками, фиксированной высоты.
    const searchAlsoFoundHeader = useSearchAlsoFound({
      query: debSearch,
      enabled: isSiteSearch,
      authReady,
      userId: userId ?? null,
    });

    // Панель живёт в заголовке FlashList (`listIntroContent`), а не в `topContent`:
    // колонка результатов — единственный скролл, и блок снаружи неё съедал бы высоту
    // каталога и обрезал карточки подбора (code-review-gate #2459).
    const listIntroContent = useMemo(
      () => (showAiSearchPanel || searchAlsoFoundHeader
        ? (<>{catalogIntro}{showAiSearchPanel ? <AiSearchPanel /> : null}{searchAlsoFoundHeader}</>)
        : catalogIntro),
      [catalogIntro, searchAlsoFoundHeader, showAiSearchPanel],
    );

    const topContent = useMemo(() => {
      if (!staleContentMeta && !isExport && !showRelaxationNotice) return null;
      return (
        <>
          <StaleContentBanner meta={staleContentMeta} />
          {(isExport || showRelaxationNotice) ? (
            <ListTravelTopContent
              isExport={isExport}
              relaxedStage={showRelaxationNotice ? relaxedStage : undefined}
              strictCount={relaxation?.strictCount}
              removedFilterLabels={removedFilterLabels}
              onClearAll={handleClearAll}
              styles={styles}
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
          ) : null}
        </>
      );
    // Intentional granular deps (styles.* sub-keys) to avoid recompute on styles object-identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      baseSettings,
      clearSelection,
      staleContentMeta,
      travels,
      exportState.selected,
      relaxedStage,
      relaxation?.strictCount,
      removedFilterLabels,
      showRelaxationNotice,
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
      rootStyle={[styles.root, usesOverlaySidebar ? styles.rootMobile : { gap: viewportState.sidebarGap }]}
      deleteId={deleteId}
      deleteError={deleteError}
      onConfirmDelete={confirmDelete}
      onCloseDelete={cancelDelete}
      sidebar={{
        initialViewportWidth: viewportState.width,
        useSharedWebFilters,
        isMobile: usesOverlaySidebar,
        filterGroups,
        filter,
        onSelect: handleFilterSelect,
        total,
        isSuper,
        isMeTravel,
        setSearch,
        resetFilters,
        isVisible: !usesOverlaySidebar || showFilters,
        isLoading: filterOptionsLoading,
        isError: hasFilterOptionsError,
        // Гейт счётчика результатов на сбой основного списка (offline/abort
        // /api/travels/**), отдельно от isError выше (сбой опций фильтров) —
        // тот же isError, что уходит в rightColumn ниже.
        hasResultsError: isError,
        onRetry: () => { void refetchFilterOptions(); },
        onClose: usesOverlaySidebar ? handleCloseFilters : undefined,
        containerStyle: sidebarContainerStyle,
      }}
      rightColumn={{
        contributionBannerVariant: isTravelBy ? 'author-catalog' : 'search',
        listIntroContent,
        search,
        setSearch,
        onClearAll: handleClearAll,
        activeConditionChips,
        topContent,
        isRecommendationsVisible,
        handleRecommendationsVisibilityChange,
        activeFiltersCount,
        total,
        contentPadding,
        showInitialLoading: isInitialLoading,
        isSearchPending,
        isError,
        showEmptyState,
        getEmptyStateMessage,
        travels,
        gridColumns,
        isMobileViewport: viewportState.isCardsSingleColumn,
        isCompactToolbar: usesOverlaySidebar,
        isMobile: isCardsSingleColumn,
        showNextPageLoading: isNextPageLoading,
        refetch,
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
