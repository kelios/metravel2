// ListTravel.tsx
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
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
    Alert,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import FiltersComponent from "./FiltersComponent";
import RenderTravelItem from "./RenderTravelItem";
import SearchAndFilterBar from "./SearchAndFilterBar";
import ConfirmDialog from "../ConfirmDialog";
import {
    deleteTravel,
    fetchFilters,
    fetchFiltersCountry,
    fetchTravels,
} from "@/src/api/travels";
import { renderPreviewToBlobURL, saveContainerAsPDF } from "@/src/utils/pdfWeb";
import TravelPdfTemplate from "@/components/export/TravelPdfTemplate";

/* ===== Constants ===== */
const INITIAL_FILTER = { year: "", showModerationPending: false };
const BELARUS_ID = 3;
const PER_PAGE = 12;

/* ===== Utils ===== */
function useDebounce<T>(val: T, delay = 400) {
    const [debouncedVal, setDebouncedVal] = useState(val);
    useEffect(() => {
        const id = setTimeout(() => setDebouncedVal(val), delay);
        return () => clearTimeout(id);
    }, [val, delay]);
    return debouncedVal;
}

/* ===== Small local component: Export bar ===== */
function ExportBar({
                       isMobile,
                       selectedCount,
                       allCount,
                       onToggleSelectAll,
                       onPreview,
                       onSave,
                       printRef,
                       selected,
                   }: {
    isMobile: boolean;
    selectedCount: number;
    allCount: number;
    onToggleSelectAll: () => void;
    onPreview: () => void;
    onSave: () => void;
    printRef: React.RefObject<HTMLDivElement>;
    selected: any[];
}) {
    return (
      <View style={styles.exportBar}>
          {!isMobile && (
            <Pressable style={styles.btn} onPress={onToggleSelectAll}>
                <Text style={styles.btnTxt}>
                    {selectedCount === allCount ? "Снять выделение" : "Выбрать все"}
                </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.btn, !selectedCount && styles.btnDisabled]}
            disabled={!selectedCount}
            onPress={onPreview}
          >
              <Text style={styles.btnTxt}>
                  {isMobile ? `Превью (${selectedCount})` : `Превью (${selectedCount})`}
              </Text>
          </Pressable>

          <Pressable
            style={[styles.btn, !selectedCount && styles.btnDisabled]}
            disabled={!selectedCount}
            onPress={onSave}
          >
              <Text style={styles.btnTxt}>{isMobile ? "PDF" : "Сохранить PDF"}</Text>
          </Pressable>

          {Platform.OS === "web" && (
            <div
              ref={printRef}
              style={{
                  position: "fixed",
                  left: 0,
                  top: 0,
                  width: "794px",
                  background: "#fff",
                  pointerEvents: "none",
                  opacity: 0,
                  zIndex: 0,
              }}
            >
                {selected.map((t) => (
                  <TravelPdfTemplate key={t.id} travelId={t.id} />
                ))}
            </div>
          )}
      </View>
    );
}

const MemoizedFilters = memo(FiltersComponent);
const MemoizedTravelItem = memo(RenderTravelItem);

function ListTravel() {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const columns = isMobile ? 1 : isTablet ? 2 : 3;

    const listKey = useMemo(() => `grid-${columns}`, [columns]);

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
    const debSearch = useDebounce(search);
    const [filter, setFilter] = useState(INITIAL_FILTER);

    // infinite scroll
    const [currentPage, setCurrentPage] = useState(0);
    const [accumulatedData, setAccumulatedData] = useState<any[]>([]);
    const isLoadingMoreRef = useRef(false);
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

    /* Query params (stable object) */
    const queryParams = useMemo(() => {
        const p: Record<string, any> = {};
        Object.entries(filter).forEach(([k, v]) => {
            if (k === "showModerationPending") return;
            if (Array.isArray(v) ? v.length : v) p[k] = v;
        });

        if (!(isMeTravel || isExport)) {
            if (!filter.showModerationPending) {
                p.publish = 1;
                p.moderation = 1;
            } else {
                // явное отсутствие фильтров модерации
                // не кладём undefined в запросы
            }
        }

        if (isMeTravel || isExport) p.user_id = userId;
        else if (user_id) p.user_id = user_id;

        if (isTravelBy) p.countries = [BELARUS_ID];
        if (isMeTravel) {
            delete p.publish;
            delete p.moderation;
        }

        return p;
    }, [filter, isMeTravel, isExport, isTravelBy, userId, user_id]);

    const isQueryEnabled = useMemo(
      () => (isMeTravel || isExport ? !!userId : true),
      [isMeTravel, isExport, userId]
    );

    /* Data query (stable key, no stringify) */
    const {
        data,
        status,
        isFetching,
        isPreviousData,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: [
            "travels",
            { page: currentPage, perPage: PER_PAGE, search: debSearch, params: queryParams },
        ],
        queryFn: ({ queryKey, signal }) => {
            const [, { page, perPage, search, params }] = queryKey as any;
            return fetchTravels(page, perPage, search, params, { signal });
        },
        enabled: isQueryEnabled,
        keepPreviousData: true,
        staleTime: 60 * 1000,
        cacheTime: 5 * 60 * 1000,
    });

    const total = data?.total ?? 0;
    const hasMore = (currentPage + 1) * PER_PAGE < total;

    /* Accumulate */
    useEffect(() => {
        if (!isQueryEnabled) return;
        if (status !== "success") return;

        const chunk = data?.data ?? [];
        setAccumulatedData((prev) => (currentPage === 0 ? chunk : [...prev, ...chunk]));
        // сбрасываем флаг только когда реально пришла новая партия
        isLoadingMoreRef.current = false;
    }, [isQueryEnabled, status, data, currentPage]);

    // reset on search/filter change — очищаем сразу
    useEffect(() => {
        setCurrentPage(0);
        setAccumulatedData([]);
        isLoadingMoreRef.current = false;
    }, [debSearch, queryParams]);

    // prefetch next page — только когда ничего не грузим сейчас
    useEffect(() => {
        if (!isQueryEnabled) return;
        if (!hasMore) return;
        if (isFetching) return;

        const nextPage = currentPage + 1;
        queryClient.prefetchQuery({
            queryKey: [
                "travels",
                { page: nextPage, perPage: PER_PAGE, search: debSearch, params: queryParams },
            ],
            queryFn: ({ signal }) =>
              fetchTravels(nextPage, PER_PAGE, debSearch, queryParams, { signal }),
            staleTime: 60 * 1000,
        });
    }, [isQueryEnabled, hasMore, isFetching, currentPage, debSearch, queryParams, queryClient]);

    /* Filters helpers */
    const resetFilters = useCallback(() => {
        setFilter(INITIAL_FILTER);
        setCurrentPage(0);
        setAccumulatedData([]);
    }, []);

    const onSelect = useCallback((field: string, v: any) => {
        setFilter((p) => ({ ...p, [field]: v }));
        setCurrentPage(0);
        setAccumulatedData([]);
    }, []);

    const applyFilter = useCallback((v: any) => {
        setFilter(v);
        setCurrentPage(0);
        setAccumulatedData([]);
    }, []);

    /* Delete */
    const handleDelete = useCallback(async () => {
        if (!deleteId) return;
        await deleteTravel(deleteId);
        setDelete(null);
        queryClient.invalidateQueries({ queryKey: ["travels"] });
    }, [deleteId, queryClient]);

    /* Selection for export */
    const [selected, setSelected] = useState<any[]>([]);
    const printRef = useRef<HTMLDivElement>(null);

    const toggleSelect = useCallback((t: any) => {
        setSelected((prev) =>
          prev.find((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t]
        );
    }, []);

    const toggleSelectAll = useCallback(() => {
        const items = accumulatedData ?? [];
        if (!items.length) return;
        setSelected((prev) => (prev.length === items.length ? [] : items));
    }, [accumulatedData]);

    /* Render item */
    const renderItem = useCallback(
      ({ item, index }: any) => (
        <MemoizedTravelItem
          item={item}
          isMobile={isMobile}
          isSuperuser={isSuper}
          isMetravel={isMeTravel}
          onDeletePress={setDelete}
          onEditPress={router.push}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={!!selected.find((s) => s.id === item.id)}
          onToggle={() => toggleSelect(item)}
        />
      ),
      [isMobile, isSuper, isMeTravel, isExport, router, selected, toggleSelect]
    );

    const keyExtractor = useCallback((item: any) => String(item.id), []);

    /* PDF preview/save (без изменений) */
    const makePreview = useCallback(async () => {
        if (!selected.length) return;
        if (Platform.OS !== "web") {
            Alert.alert("Недоступно", "Превью PDF доступно только в веб-версии.");
            return;
        }
        if (!printRef.current) return;

        let statusEl: HTMLDivElement | null = document.createElement("div");
        let iframe: HTMLIFrameElement | null = null;
        let closeBtn: HTMLButtonElement | null = null;

        try {
            statusEl.style.cssText =
              "position:fixed;top:0;left:0;right:0;padding:20px;background:#4a7c59;color:#fff;text-align:center;z-index:9999;";
            statusEl.textContent = "Генерируем PDF, подождите...";
            document.body.appendChild(statusEl);

            const url = await renderPreviewToBlobURL(printRef.current, {
                filename: "metravel.pdf",
            });

            if (url) {
                iframe = document.createElement("iframe");
                iframe.style.cssText =
                  "position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9998;";
                iframe.src = url;

                closeBtn = document.createElement("button");
                closeBtn.style.cssText =
                  "position:fixed;top:20px;right:20px;z-index:9999;padding:10px 20px;background:#fff;color:#4a7c59;border:none;border-radius:4px;cursor:pointer;";
                closeBtn.textContent = "Закрыть";
                closeBtn.onclick = () => {
                    if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
                    if (closeBtn && document.body.contains(closeBtn)) document.body.removeChild(closeBtn);
                    if (statusEl && document.body.contains(statusEl)) document.body.removeChild(statusEl);
                    URL.revokeObjectURL(url);
                };

                document.body.appendChild(iframe);
                document.body.appendChild(closeBtn);
                if (statusEl && statusEl.parentNode) document.body.removeChild(statusEl);
                statusEl = null;
            }
        } catch (e) {
            console.error("[PDFExport] preview error:", e);
            if (statusEl) {
                statusEl.textContent = "Ошибка при создании превью";
                statusEl.style.background = "#a00";
                setTimeout(() => {
                    if (statusEl && statusEl.parentNode) document.body.removeChild(statusEl);
                }, 3000);
            }
            if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
            if (closeBtn && document.body.contains(closeBtn)) document.body.removeChild(closeBtn);
        }
    }, [selected]);

    const savePdf = useCallback(async () => {
        if (!selected.length) {
            Alert.alert("Внимание", "Пожалуйста, выберите хотя бы одно путешествие");
            return;
        }
        if (Platform.OS !== "web") {
            Alert.alert("Недоступно", "Сохранение PDF доступно только в веб-версии.");
            return;
        }
        if (!printRef.current) return;

        let bar: HTMLDivElement | null = document.createElement("div");
        bar.style.cssText =
          "position:fixed;top:0;left:0;right:0;padding:20px;background:#4a7c59;color:#fff;text-align:center;z-index:9999;";
        bar.textContent = "Создание PDF...";
        document.body.appendChild(bar);
        try {
            await saveContainerAsPDF(printRef.current, "my-travels.pdf", {
                margin: [10, 10],
                image: { type: "jpeg", quality: 0.95 },
            });
        } catch (e) {
            console.error("PDF generation error:", e);
            Alert.alert("Ошибка", "Ошибка при создании PDF");
        } finally {
            if (bar && bar.parentNode) document.body.removeChild(bar);
            bar = null;
        }
    }, [selected]);

    /* Loading helpers */
    const hasAnyItems = accumulatedData.length > 0;
    const isInitialLoading =
      isQueryEnabled && isLoading && !hasAnyItems; // не показываем лоадер, если disabled
    const isNextPageLoading = isFetching && hasAnyItems;
    const isEmpty = isQueryEnabled && status === "success" && !isFetching && !hasAnyItems;

    const canLoadMore = !isNextPageLoading && hasMore && !isPreviousData;

    const handleEndReached = useCallback(() => {
        if (!canLoadMore || isLoadingMoreRef.current || onMomentumRef.current) return;
        isLoadingMoreRef.current = true;
        setCurrentPage((p) => p + 1);
    }, [canLoadMore]);

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

    const displayData = accumulatedData;

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
                  <SearchAndFilterBar
                    search={search}
                    setSearch={setSearch}
                    onToggleFilters={isMobile ? () => setShowFilters(true) : undefined}
                  />

                  {isInitialLoading && (
                    <View style={styles.loader} accessibilityRole="alert" aria-live="polite">
                        <ActivityIndicator size="large" />
                    </View>
                  )}

                  {status === "error" && <Text style={styles.status}>Ошибка загрузки</Text>}
                  {isEmpty && <Text style={styles.status}>Нет данных</Text>}

                  {hasAnyItems && (
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
                      removeClippedSubviews={false}
                      initialNumToRender={PER_PAGE}
                      maxToRenderPerBatch={PER_PAGE}
                      windowSize={11}
                      updateCellsBatchingPeriod={60}
                      onEndReachedThreshold={0.5}
                      onEndReached={handleEndReached}
                      onMomentumScrollBegin={onMomentumBegin}
                      onScroll={onScroll}
                      extraData={{ sel: selected.length }}
                      accessibilityRole="list"
                      ListFooterComponent={
                          isNextPageLoading ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" />
                            </View>
                          ) : null
                      }
                    />
                  )}
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
              selectedCount={selected.length}
              allCount={displayData.length}
              onToggleSelectAll={toggleSelectAll}
              onPreview={makePreview}
              onSave={savePdf}
              printRef={printRef}
              selected={selected}
            />
          )}
      </SafeAreaView>
    );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#fff" },
    container: {
        flex: 1,
        ...(Platform.OS === "web" && { alignItems: "stretch" }),
    },
    sidebar: {
        width: 280,
        borderRightWidth: 1,
        borderColor: "#eee",
    },
    main: {
        flex: 1,
        padding: 12,
        ...(Platform.OS === "web" && {
            maxWidth: 1440,
            marginHorizontal: "auto" as any,
            width: "100%",
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
    status: { marginTop: 40, textAlign: "center", fontSize: 16, color: "#888" },
    list: { gap: 16 },
    columnWrapper: { gap: 16, justifyContent: "space-between" },
    exportBar: {
        flexDirection: "row",
        gap: 8,
        padding: 8,
        borderTopWidth: 1,
        borderColor: "#eee",
        backgroundColor: "#fafafa",
    },
    btn: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: "center",
        ...(Platform.OS === "web" ? { backgroundColor: "#4a7c59" } : {}),
    },
    btnDisabled: {
        ...(Platform.OS === "web" ? { backgroundColor: "#aaa" } : {}),
        opacity: Platform.OS === "web" ? 1 : 0.5,
    },
    btnTxt: { color: "#fff", fontWeight: "600", fontSize: 14 },
});

export default memo(ListTravel);
