// src/components/listTravel/ListTravel.tsx
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import FiltersComponent from "./FiltersComponent";
import RenderTravelItem from "./RenderTravelItem";
import PaginationComponent from "../PaginationComponent";
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
const PER_PAGE_OPTS = [9, 18, 30, 60];
const MOBILE_PER_PAGE = 12;

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

          {/* RN Web: скрытый контейнер для генерации PDF */}
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
      </View>
    );
}

/* ===== Main screen ===== */
const MemoizedFilters = memo(FiltersComponent);
const MemoizedSearchBar = memo(SearchAndFilterBar);
const MemoizedTravelItem = memo(RenderTravelItem);

function ListTravel() {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const columns = isMobile ? 1 : isTablet ? 2 : 3;
    const listKey = useMemo(() => `grid-${columns}-${width}`, [columns, width]);

    const route = useRoute();
    const router = useRouter();
    const { user_id } = useLocalSearchParams();
    const isMeTravel = (route as any).name === "metravel";
    const isTravelBy = (route as any).name === "travelsby";
    const isExport = (route as any).name === "export";

    /* Auth flags */
    const [userId, setUserId] = useState<string | null>(null);
    const [isSuper, setSuper] = useState(false);
    useEffect(() => {
        AsyncStorage.multiGet(["userId", "isSuperuser"]).then(([[, id], [, su]]) => {
            setUserId(id);
            setSuper(su === "true");
        });
    }, []);

    /* Top-bar state */
    const [search, setSearch] = useState("");
    const debSearch = useDebounce(search);
    const [filter, setFilter] = useState(INITIAL_FILTER);

    // desktop/tablet pagination
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(30);

    // mobile infinite scroll
    const [mobilePage, setMobilePage] = useState(0);
    const [mobileData, setMobileData] = useState<any[]>([]);

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

    /* Query params */
    const queryParams = useMemo(() => {
        const p: Record<string, any> = {};
        Object.entries(filter).forEach(([k, v]) => {
            if (k === "showModerationPending") return;
            if (Array.isArray(v) ? v.length : v) p[k] = v;
        });

        if (!isMeTravel || !isExport) {
            p.publish = filter.showModerationPending ? undefined : 1;
            p.moderation = filter.showModerationPending ? 0 : 1;
        }
        if (isMeTravel || isExport) p.user_id = userId;
        else if (user_id) p.user_id = user_id;
        if (isTravelBy) p.countries = [BELARUS_ID];
        if (isMeTravel) {
            p.publish = undefined;
            p.moderation = undefined;
        }
        return p;
    }, [filter, isMeTravel, isExport, isTravelBy, userId, user_id]);

    /* Data query */
    const effectivePage = isMobile ? mobilePage : page;
    const effectivePerPage = isMobile ? MOBILE_PER_PAGE : perPage;

    const { data, status, refetch, isFetching } = useQuery({
        queryKey: ["travels", effectivePage, effectivePerPage, debSearch, queryParams],
        queryFn: () => fetchTravels(effectivePage, effectivePerPage, debSearch, queryParams),
        enabled: !(isMeTravel || isExport) || !!userId,
        keepPreviousData: true,
        staleTime: 60 * 1000,
        cacheTime: 5 * 60 * 1000,
    });

    const totalItems = data?.total ?? 0;
    const totalPages = useMemo(
      () => Math.max(1, Math.ceil((totalItems || 0) / (perPage || 1))),
      [totalItems, perPage]
    );

    /* ===== Mobile infinite accumulate ===== */
    useEffect(() => {
        if (!isMobile) return;
        if (status !== "success") return;
        const chunk = data?.data ?? [];
        setMobileData((prev) => (mobilePage === 0 ? chunk : [...prev, ...chunk]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile, status, data, mobilePage]);

    // reset mobile list on search/filter change
    useEffect(() => {
        if (!isMobile) return;
        setMobilePage(0);
        setMobileData([]);
    }, [isMobile, debSearch, queryParams]);

    /* ===== Desktop page correction ===== */
    useEffect(() => {
        if (isMobile) return;
        if (page > 0 && page >= totalPages) {
            setPage(Math.max(0, totalPages - 1));
        }
    }, [isMobile, totalPages, page]);

    /* Autoscroll (desktop only) */
    const listRef = useRef<FlatList<any>>(null);
    const setPageAndScroll = useCallback((next: number) => {
        setPage(next);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, []);
    const handlePerPageChange = useCallback(
      (n: number) => {
          setPerPage(n);
          setPageAndScroll(0);
      },
      [setPageAndScroll]
    );

    /* Filters helpers */
    const resetFilters = useCallback(() => {
        setFilter(INITIAL_FILTER);
        if (isMobile) {
            setMobilePage(0);
            setMobileData([]);
        } else {
            setPageAndScroll(0);
        }
    }, [isMobile, setPageAndScroll]);

    const onSelect = useCallback(
      (field: string, v: any) => {
          setFilter((p) => ({ ...p, [field]: v }));
          if (isMobile) {
              setMobilePage(0);
              setMobileData([]);
          } else {
              setPageAndScroll(0);
          }
      },
      [isMobile, setPageAndScroll]
    );

    const applyFilter = useCallback(
      (v: any) => {
          setFilter(v);
          if (isMobile) {
              setMobilePage(0);
              setMobileData([]);
          } else {
              setPageAndScroll(0);
          }
      },
      [isMobile, setPageAndScroll]
    );

    /* Delete */
    const handleDelete = useCallback(async () => {
        if (!deleteId) return;
        await deleteTravel(deleteId);
        setDelete(null);
        refetch();
    }, [deleteId, refetch]);

    /* Selection for export */
    const [selected, setSelected] = useState<any[]>([]);
    const printRef = useRef<HTMLDivElement>(null);

    const toggleSelect = useCallback((t: any) => {
        setSelected((prev) =>
          prev.find((x) => x.id === t.id)
            ? prev.filter((x) => x.id !== t.id)
            : [...prev, t]
        );
    }, []);
    const toggleSelectAll = useCallback(() => {
        if (!data?.data) return;
        setSelected((prev) => (prev.length === data.data.length ? [] : data.data));
    }, [data]);

    /* Render item */
    const renderItem = useCallback(
      ({ item, index }: any) => (
        <MemoizedTravelItem
          item={item}
          isMobile={isMobile}
          isSuperuser={isSuper}
          isMetravel={isMeTravel}
          isExport={isExport}
          onDeletePress={setDelete}
          onEditPress={router.push}
          isFirst={index === 0}
          selectable={isExport}
          isSelected={!!selected.find((s) => s.id === item.id)}
          onToggle={() => toggleSelect(item)}
        />
      ),
      [isMobile, isSuper, isMeTravel, isExport, (router as any).push, selected, toggleSelect]
    );

    const keyExtractor = useCallback((item: any) => String(item.id), []);

    /* PDF preview/save */
    const makePreview = useCallback(async () => {
        if (!printRef.current || !selected.length) return;

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
                if (statusEl && document.body.contains(statusEl)) document.body.removeChild(statusEl);
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
        if (!printRef.current || !selected.length) {
            alert("Пожалуйста, выберите хотя бы одно путешествие");
            return;
        }
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
            alert("Ошибка при создании PDF");
        } finally {
            if (bar && bar.parentNode) document.body.removeChild(bar);
            bar = null;
        }
    }, [selected]);

    /* Stable header (чтобы FlatList не «пересоздавал» его) */
    const HeaderComp = useCallback(
      () => (
        <MemoizedSearchBar
          search={search}
          setSearch={setSearch}
          isMobile={isMobile}
          onToggleFilters={() => setShowFilters((v) => !v)}
        />
      ),
      [search, setSearch, isMobile]
    );

    /* Infinite scroll flags */
    const canLoadMoreMobile =
      isMobile && !isFetching && mobileData.length < (data?.total ?? 0);

    const handleEndReached = useCallback(() => {
        if (!isMobile) return;
        if (!canLoadMoreMobile) return;
        setMobilePage((p) => p + 1);
    }, [isMobile, canLoadMoreMobile]);

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
                  {status === "pending" && (
                    <View style={styles.loader} accessibilityRole="alert" aria-live="polite">
                        <ActivityIndicator size="large" color="#4a7c59" />
                    </View>
                  )}

                  {status !== "pending" && (
                    <>
                        {status === "error" && <Text style={styles.status}>Ошибка загрузки</Text>}

                        {status === "success" &&
                          !(isMobile ? mobileData.length : data?.data?.length) && (
                            <Text style={styles.status}>Нет данных</Text>
                          )}

                        {status === "success" &&
                          (isMobile ? mobileData.length : data?.data?.length) > 0 && (
                            <FlatList
                              ref={listRef}
                              key={listKey}
                              data={isMobile ? mobileData : data!.data}
                              keyExtractor={keyExtractor}
                              renderItem={renderItem}
                              numColumns={columns}
                              columnWrapperStyle={
                                  columns > 1 ? styles.columnWrapper : undefined
                              }
                              contentContainerStyle={[
                                  styles.list,
                                  {
                                      // избегаем лишних «прыжков» — без minHeight на мобиле
                                      paddingBottom: isExport ? 76 : 32,
                                  },
                              ]}
                              ListHeaderComponent={HeaderComp}
                              // sticky: native — индексы, web — CSS sticky (иначе бывают телепорты)
                              stickyHeaderIndices={Platform.OS === "web" ? undefined : [0]}
                              ListHeaderComponentStyle={
                                  Platform.OS === "web"
                                    ? {
                                        position: "sticky" as any,
                                        top: 0,
                                        zIndex: 2,
                                        backgroundColor: "#fff",
                                    }
                                    : undefined
                              }
                              showsVerticalScrollIndicator={false}
                              removeClippedSubviews={Platform.OS === "android"}
                              initialNumToRender={isMobile ? 6 : 12}
                              maxToRenderPerBatch={isMobile ? 6 : 12}
                              windowSize={isMobile ? 9 : 11}
                              updateCellsBatchingPeriod={isMobile ? 60 : 0}
                              onEndReachedThreshold={0.5}
                              onEndReached={handleEndReached}
                              // getItemLayout — УДАЛЁН, чтобы не было «телепортов»
                              // Минимальное extraData — только размер выделения
                              extraData={{ sel: selected.length }}
                              accessibilityRole="list"
                            />
                          )}

                        {/* Нижний пагинатор — только планшет/десктоп */}
                        {!isMobile && (data?.total ?? 0) > perPage && (
                          <PaginationComponent
                            currentPage={page}
                            itemsPerPage={perPage}
                            onPageChange={setPageAndScroll}
                            onItemsPerPageChange={handlePerPageChange}
                            itemsPerPageOptions={PER_PAGE_OPTS}
                            totalItems={data?.total ?? 0}
                          />
                        )}
                    </>
                  )}
              </View>
          </View>

          {/* Модалка фильтров для мобилы */}
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

          {/* Диалог удаления */}
          <ConfirmDialog
            visible={!!deleteId}
            onClose={() => setDelete(null)}
            onConfirm={handleDelete}
            title="Удаление"
            message="Удалить это путешествие?"
          />

          {/* Экспорт — только на /export */}
          {isExport && (
            <ExportBar
              isMobile={isMobile}
              selectedCount={selected.length}
              allCount={data?.data?.length ?? 0}
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
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    status: { marginTop: 40, textAlign: "center", fontSize: 16, color: "#888" },
    list: { gap: 16 },
    columnWrapper: { gap: 16, justifyContent: "space-between" },

    /* Export */
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
        backgroundColor: "#4a7c59",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: "center",
    },
    btnDisabled: { backgroundColor: "#aaa" },
    btnTxt: { color: "#fff", fontWeight: "600", fontSize: 14 },
});

export default memo(ListTravel);
