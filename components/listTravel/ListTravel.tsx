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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import FiltersComponent from "./FiltersComponent";
import RenderTravelItem from "./RenderTravelItem";
import SearchAndFilterBar from "./SearchAndFilterBar";
import ConfirmDialog from "../ConfirmDialog";
import UIButton from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Ленивая загрузка объединенного компонента с табами
const RecommendationsTabs = lazy(() => 
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? new Promise(resolve => {
            (window as any).requestIdleCallback(() => {
                resolve(import('./RecommendationsTabs'));
            }, { timeout: 2000 });
        })
        : import('./RecommendationsTabs')
);

import {
    deleteTravel,
    fetchFilters,
    fetchFiltersCountry,
    fetchTravels,
} from "@/src/api/travels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TravelListSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import CategoryChips from "@/components/CategoryChips";
import ActiveFiltersBadge from "./ActiveFiltersBadge";

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const TravelPdfTemplate = lazy(() => import('@/components/export/TravelPdfTemplate'));
const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

// ✅ АРХИТЕКТУРА: Импорт констант, типов, утилит и хуков
import { 
  PER_PAGE, 
  PERSONALIZATION_VISIBLE_KEY, 
  WEEKLY_HIGHLIGHTS_VISIBLE_KEY,
  MAX_VISIBLE_CATEGORIES,
} from "./utils/listTravelConstants";
import { useListTravelVisibility } from "./hooks/useListTravelVisibility";
import { useListTravelFilters } from "./hooks/useListTravelFilters";
import { useListTravelData } from "./hooks/useListTravelData";
import { useListTravelExport } from "./hooks/useListTravelExport";
import { calculateColumns, isMobile as checkIsMobile, calculateCategoriesWithCount } from "./utils/listTravelHelpers";

const RecommendationsPlaceholder = () => (
  <View style={styles.recommendationsLoader}>
    <ActivityIndicator size="small" color="#6b8e7f" />
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
            {!isMobile && (
              <UIButton
                label="Настройки"
                onPress={onSettings}
                disabled={!hasSelection}
                variant="secondary"
              />
            )}

            <UIButton
              label={isMobile ? `Превью (${selectedCount})` : `Превью (${selectedCount})`}
              onPress={onPreview}
              disabled={!hasSelection || isGenerating}
              variant="ghost"
            />

            <UIButton
              label={isGenerating ? `Генерация... ${progress || 0}%` : (isMobile ? "PDF" : "Сохранить PDF")}
              onPress={onSave}
              disabled={!hasSelection || isGenerating}
            />
          </View>

          {isGenerating && Platform.OS === "web" && (
            <View style={styles.progressWrapper}>
              <View style={[styles.progressBar, { width: `${progress || 0}%` }]} />
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
    // ✅ ИСПРАВЛЕНИЕ: Старые пропсы оставлены для обратной совместимости, но не используются
    // ✅ АРХИТЕКТУРА: Использование кастомного хука для видимости
    // ✅ ИСПРАВЛЕНИЕ: Объединенная видимость для всех рекомендаций
    const [isRecommendationsVisible, setIsRecommendationsVisible] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Загружаем сохраненное состояние
    useEffect(() => {
        const loadVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    const saved = sessionStorage.getItem('recommendations_visible');
                    setIsRecommendationsVisible(saved !== 'false');
                } else {
                    const saved = await AsyncStorage.getItem('recommendations_visible');
                    setIsRecommendationsVisible(saved !== 'false');
                }
            } catch (error) {
                console.error('Error loading recommendations visibility:', error);
            } finally {
                setIsInitialized(true);
            }
        };
        loadVisibility();
    }, []);

    const handleToggleRecommendations = useCallback(() => {
        const newValue = !isRecommendationsVisible;
        setIsRecommendationsVisible(newValue);
        try {
            if (Platform.OS === 'web') {
                if (newValue) {
                    sessionStorage.removeItem('recommendations_visible');
                } else {
                    sessionStorage.setItem('recommendations_visible', 'false');
                }
            } else {
                if (newValue) {
                    AsyncStorage.removeItem('recommendations_visible');
                } else {
                    AsyncStorage.setItem('recommendations_visible', 'false');
                }
            }
        } catch (error) {
            console.error('Error saving recommendations visibility:', error);
        }
    }, [isRecommendationsVisible]);

    const { width } = useWindowDimensions();
    const isMobile = checkIsMobile(width);
    const columns = calculateColumns(width);

    const listKey = useMemo(() => `grid-${columns}`, [columns]);

    const [recommendationsReady, setRecommendationsReady] = useState(Platform.OS !== 'web');

    useEffect(() => {
        if (recommendationsReady) return;
        if (typeof window === 'undefined') {
            setRecommendationsReady(true);
            return;
        }
        let idleHandle: number | null = null;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const markReady = () => setRecommendationsReady(true);

        if ('requestIdleCallback' in window) {
            idleHandle = (window as any).requestIdleCallback(markReady, { timeout: 1200 });
        } else {
            timeoutHandle = setTimeout(markReady, 400);
        }

        return () => {
            if (idleHandle && 'cancelIdleCallback' in window) {
                (window as any).cancelIdleCallback(idleHandle);
            }
            if (timeoutHandle) clearTimeout(timeoutHandle);
        };
    }, [recommendationsReady]);

    const route = useRoute();
    const router = useRouter();

    const params = useLocalSearchParams<{ user_id?: string }>();
    const user_id = params.user_id;

    const isMeTravel = (route as any).name === "metravel";
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export";

    const queryClient = useQueryClient();

    /* Auth flags */
    const [userId, setUserId] = useState<string | null>(null);
    const [isSuper, setSuper] = useState(false);

    useEffect(() => {
        AsyncStorage.multiGet(["userId", "isSuperuser"]).then(([[, id], [, su]]) => {
            setUserId(id || null);
            setSuper(su === "true");
        });
    }, []);

    /* Top-bar state */
    const [search, setSearch] = useState("");
    const debSearch = useDebouncedValue(search, 400);

    const [currentPage, setCurrentPage] = useState(0);
    const onMomentumRef = useRef(false);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    /* Filters options */
    const { data: options } = useQuery({
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
    
    const isUserIdLoading = (isMeTravel || isExport) && userId === null;
    
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
        currentPage,
        setCurrentPage,
        queryParams,
        search: debSearch,
        isQueryEnabled,
    });

    const categoriesWithCount = useMemo(
      () => calculateCategoriesWithCount(travels, options?.categories).slice(0, MAX_VISIBLE_CATEGORIES),
      [travels, options?.categories]
    );

    /* Delete */
    const handleDelete = useCallback(async () => {
        if (!deleteId) return;
        await deleteTravel(deleteId);
        setDelete(null);
        queryClient.invalidateQueries({ queryKey: ["travels"] });
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
          onEditPress={router.push}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={isSelected(item.id)}
          onToggle={() => toggleSelect(item)}
        />
      ),
      [isMobile, isSuper, isMeTravel, isExport, router, isSelected, toggleSelect]
    );

    const keyExtractor = useCallback((item: any) => String(item.id), []);

    const listVirtualization = useMemo(() => {
      const base = columns <= 1 ? 6 : columns * 2;
      const initial = Math.min(12, Math.max(4, base));
      const batch = Math.min(16, initial + columns);
      const window = Math.max(5, columns * 3);
      return {
        initial,
        batch,
        window,
      };
    }, [columns]);

    /* Loading helpers */
    const hasAnyItems = travels.length > 0;
    
    const showInitialLoading = isInitialLoading || isUserIdLoading;
    const showNextPageLoading = isNextPageLoading;
    const showEmptyState = !isUserIdLoading && isEmpty;

    const handleListEndReached = useCallback(() => {
        if (onMomentumRef.current) return;
        handleEndReached();
    }, [handleEndReached]);

    const onMomentumBegin = useCallback(() => {
        onMomentumRef.current = false;
    }, []);
    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        // если контента мало, RN web может сразу дёрнуть onEndReached — защитимся
        const { contentSize, layoutMeasurement } = e.nativeEvent;
        if (contentSize.height <= layoutMeasurement.height * 1.05) {
            onMomentumRef.current = true;
        }
    }, []);

    const displayData = travels;

    return (
      <SafeAreaView style={styles.root}>
          <View style={[styles.container, { flexDirection: isMobile ? "column" : "row" }]}>
              {!isMobile && (
                <View style={styles.sidebar} aria-label="Фильтры">
                    <MemoizedFilters
                      filtersLoadedKey={listKey}
                      filters={options || {}}
                      filterValue={filter}
                      onSelectedItemsChange={onSelect}
                      handleApplyFilters={applyFilter}
                      resetFilters={resetFilters}
                      isSuperuser={isSuper}
                      closeMenu={() => {}}
                    />
                </View>
              )}

              <View style={styles.main}>
                  {/* ✅ ДИЗАЙН: Увеличен верхний отступ для SearchAndFilterBar */}
                  <View style={[styles.searchSection, isMobile && styles.searchSectionMobile]}>
                      <SearchAndFilterBar
                        search={search}
                        setSearch={setSearch}
                        onToggleFilters={isMobile ? () => setShowFilters(true) : undefined}
                        onToggleRecommendations={handleToggleRecommendations}
                        isRecommendationsVisible={isRecommendationsVisible}
                      />
                  </View>

                  {isExport && hasSelection && (
                    <View style={styles.selectionBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectionBannerTitle}>{selectionLabel}</Text>
                        <Text style={styles.selectionBannerSubtitle}>
                          Настройки: {settingsSummary}
                        </Text>
                      </View>
                      <Pressable
                        onPress={clearSelection}
                        style={styles.selectionBannerClear}
                        accessibilityLabel="Очистить выбор"
                      >
                        <Text style={styles.selectionBannerClearText}>Очистить</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Сортировка временно отключена - бэкенд не поддерживает */}

                  {/* ✅ УЛУЧШЕНИЕ: Счетчик активных фильтров */}
                  <ActiveFiltersBadge
                    filterValue={filter}
                    onClear={resetFilters}
                    showClearButton={true}
                  />

                  {/* ✅ ДИЗАЙН: Категории-чипсы с улучшенными отступами */}
                  {categoriesWithCount.length > 0 && (
                    <View style={styles.categoriesSection}>
                      <CategoryChips
                        categories={categoriesWithCount}
                        selectedCategories={filter.categories || []}
                        onToggleCategory={handleToggleCategory}
                        maxVisible={8}
                      />
                    </View>
                  )}

                  {showInitialLoading && (
                    <TravelListSkeleton count={PER_PAGE} />
                  )}

                  {isError && (
                    <EmptyState
                      icon="alert-circle"
                      title="Ошибка загрузки"
                      description="Не удалось загрузить путешествия. Проверьте подключение к интернету и попробуйте снова."
                      action={{
                        label: "Повторить",
                        onPress: () => refetch(),
                      }}
                    />
                  )}
                  {showEmptyState && (
                    <EmptyState
                      icon="search"
                      title="Ничего не найдено"
                      description={
                        debSearch || Object.keys(queryParams).length > 0
                          ? "Попробуйте изменить параметры поиска или фильтры"
                          : "Пока нет доступных путешествий"
                      }
                      action={
                        (debSearch || Object.keys(queryParams).length > 0) && {
                          label: "Сбросить фильтры",
                          onPress: resetFilters,
                        }
                      }
                    />
                  )}

                  {/* ✅ ИСПРАВЛЕНИЕ: FlatList всегда рендерится, рекомендации в ListHeaderComponent для общего скролла */}
                  <FlatList
                    key={listKey}
                    data={displayData}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    numColumns={columns}
                    columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
                    contentContainerStyle={[
                        styles.list,
                        { paddingBottom: isExport ? 76 : 32 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true} // ✅ ОПТИМИЗАЦИЯ: Удалять невидимые элементы
                    initialNumToRender={listVirtualization.initial}
                    maxToRenderPerBatch={listVirtualization.batch}
                    windowSize={listVirtualization.window}
                    updateCellsBatchingPeriod={100} // ✅ ОПТИМИЗАЦИЯ: Увеличить период батчинга
                    onEndReachedThreshold={0.5}
                    onEndReached={handleListEndReached}
                    onMomentumScrollBegin={onMomentumBegin}
                    onScroll={onScroll}
                    extraData={selectionCount}
                    accessibilityRole="list"
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#6b8e7f"
                        colors={['#6b8e7f']}
                      />
                    }
                    ListHeaderComponent={
                      isInitialized && isRecommendationsVisible && recommendationsReady ? (
                        <Suspense fallback={<RecommendationsPlaceholder />}>
                          <RecommendationsTabs 
                            forceVisible={isRecommendationsVisible}
                            onVisibilityChange={(visible) => {
                              if (!visible) {
                                setIsRecommendationsVisible(false);
                              }
                            }}
                          />
                        </Suspense>
                      ) : isInitialized && isRecommendationsVisible ? (
                        <RecommendationsPlaceholder />
                      ) : null
                    }
                    ListFooterComponent={
                        showNextPageLoading ? (
                          <View style={styles.footerLoader}>
                              <ActivityIndicator size="small" />
                          </View>
                        ) : null
                    }
                  />
              </View>
          </View>

          {isMobile && showFilters && (
            <MemoizedFilters
              modal
              filtersLoadedKey={listKey}
              filters={options || {}}
              filterValue={filter}
              onSelectedItemsChange={onSelect}
              handleApplyFilters={applyFilter}
              resetFilters={resetFilters}
              isSuperuser={isSuper}
              closeMenu={() => setShowFilters(false)}
            />
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

          {/* Модальное окно настроек фотоальбома */}
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
      </SafeAreaView>
    );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.background },
    container: {
        flex: 1,
        ...(Platform.OS === "web" && { alignItems: "stretch" }),
    },
    sidebar: {
        width: Platform.select({ 
            default: '100%', // Мобильные - полная ширина
            web: 280 
        }),
        backgroundColor: palette.surface,
        borderRightWidth: Platform.select({ default: 0, web: 0.5 }), // ✅ АДАПТИВНОСТЬ: Без границы на мобильных, тонкая на десктопе
        borderColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
        ...Platform.select({
            web: {
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)", // ✅ ДИЗАЙН: Более легкая тень
                position: "sticky" as any,
                top: 0,
                alignSelf: "flex-start",
                maxHeight: "100vh",
                overflowY: "auto" as any,
            },
        }),
    },
    main: {
        flex: 1,
        padding: Platform.select({
            default: spacing.sm,
            web: spacing.md,
        }),
        ...(Platform.OS === "web" && {
            maxWidth: 1440,
            marginHorizontal: "auto" as any,
            width: "100%",
        }),
    },
    // ✅ ДИЗАЙН: Секция поиска с улучшенными отступами
    searchSection: {
        marginTop: Platform.select({
            default: spacing.xs,
            web: spacing.lg,
        }),
        marginBottom: Platform.select({
            default: spacing.sm,
            web: spacing.lg,
        }),
    },
    searchSectionMobile: {
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    // ✅ ДИЗАЙН: Секция категорий с улучшенными отступами
    categoriesSection: {
        marginTop: Platform.select({
            default: spacing.md,
            web: spacing.lg,
        }),
        marginBottom: Platform.select({
            default: spacing.md,
            web: spacing.lg,
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
    selectionBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: radii.md,
        backgroundColor: palette.successSoft,
        borderWidth: 1,
        borderColor: palette.success,
        gap: spacing.md,
    },
    selectionBannerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: palette.text,
    },
    selectionBannerSubtitle: {
        fontSize: 13,
        color: palette.textMuted,
    },
    selectionBannerClear: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.success,
    },
    selectionBannerClearText: {
        color: palette.success,
        fontWeight: "600",
    },
});

export default memo(ListTravel);
