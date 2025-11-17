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
    Alert,
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

// Ленивая загрузка компонентов с предзагрузкой при idle
const PersonalizedRecommendations = lazy(() => 
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? new Promise(resolve => {
            (window as any).requestIdleCallback(() => {
                resolve(import('@/components/PersonalizedRecommendations'));
            }, { timeout: 2000 });
        })
        : import('@/components/PersonalizedRecommendations')
);

const WeeklyHighlights = lazy(() => 
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? new Promise(resolve => {
            (window as any).requestIdleCallback(() => {
                resolve(import('@/components/WeeklyHighlights'));
            }, { timeout: 2000 });
        })
        : import('@/components/WeeklyHighlights')
);

import {
    deleteTravel,
    fetchFilters,
    fetchFiltersCountry,
    fetchTravels,
} from "@/src/api/travels";
import TravelPdfTemplate from "@/components/export/TravelPdfTemplate";
import BookSettingsModal, { BookSettings } from "@/components/export/BookSettingsModal";
import { usePdfExport } from "@/src/hooks/usePdfExport";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TravelListSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import CategoryChips from "@/components/CategoryChips";
import ActiveFiltersBadge from "./ActiveFiltersBadge";

// ✅ АРХИТЕКТУРА: Импорт констант, типов, утилит и хуков
import { 
  PER_PAGE, 
  INITIAL_FILTER, 
  BELARUS_ID,
  PERSONALIZATION_VISIBLE_KEY, 
  WEEKLY_HIGHLIGHTS_VISIBLE_KEY 
} from "./utils/listTravelConstants";
import { useListTravelVisibility } from "./hooks/useListTravelVisibility";
import { useListTravelFilters } from "./hooks/useListTravelFilters";
import { useListTravelData } from "./hooks/useListTravelData";
import { useListTravelExport } from "./hooks/useListTravelExport";
import { calculateColumns, isMobile as checkIsMobile } from "./utils/listTravelHelpers";

const TEMPLATE_LABELS: Record<BookSettings['template'], string> = {
  classic: 'Классический',
  modern: 'Современный',
  romantic: 'Романтический',
  adventure: 'Приключенческий',
  minimal: 'Минималистичный',
};

const ORIENTATION_LABELS: Record<BookSettings['orientation'], string> = {
  portrait: 'Книжная',
  landscape: 'Альбомная',
};

const pluralizeTravels = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'путешествие';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'путешествия';
  return 'путешествий';
};

/* ===== Small local component: Export bar ===== */
function ExportBar({
                       isMobile,
                       selectedCount,
                       allCount,
                       onToggleSelectAll,
                       onClearSelection,
                       onPreview,
                       onSave,
                       onSettings,
                       printRef,
                       selected,
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
    printRef: React.RefObject<HTMLDivElement>;
    selected: any[];
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
              <Pressable onPress={onToggleSelectAll}>
                <Text style={styles.linkButton}>
                  {selectedCount === allCount && allCount > 0 ? "Снять выделение" : "Выбрать все"}
                </Text>
              </Pressable>
              {hasSelection && (
                <Pressable onPress={onClearSelection}>
                  <Text style={styles.linkButton}>Очистить выбор</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={[styles.exportBarButtons, isMobile && styles.exportBarButtonsMobile]}>
            {Platform.OS === "web" && (
              <Pressable
                style={[styles.btn, styles.btnSettings]}
                onPress={onSettings}
                disabled={!hasSelection}
              >
                <Text style={[styles.btnTxt, styles.btnTxtSettings]}>Настройки</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.btn, (!hasSelection || isGenerating) && styles.btnDisabled]}
              disabled={!hasSelection || isGenerating}
              onPress={onPreview}
            >
                <Text style={styles.btnTxt}>
                    {isMobile ? `Превью (${selectedCount})` : `Превью (${selectedCount})`}
                </Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnPrimary, (!hasSelection || isGenerating) && styles.btnDisabled]}
              disabled={!hasSelection || isGenerating}
              onPress={onSave}
            >
                <Text style={[styles.btnTxt, styles.btnTxtPrimary]}>
                    {isGenerating ? `Генерация... ${progress || 0}%` : (isMobile ? "PDF" : "Сохранить PDF")}
                </Text>
            </Pressable>
          </View>

          {/* ✅ УЛУЧШЕНИЕ: Прогресс-бар генерации */}
          {isGenerating && Platform.OS === "web" && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: '#e5e7eb',
                zIndex: 10000,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress || 0}%`,
                  backgroundColor: '#ff9f5a',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}

          {Platform.OS === "web" && (
            <div
              ref={printRef}
              style={{
                  position: "fixed",
                  left: 0,
                  top: 0,
                  width: "794px",
                  backgroundColor: "#fff",
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

    const { width } = useWindowDimensions();
    const isMobile = checkIsMobile(width);
    const columns = calculateColumns(width);

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
    const debSearch = useDebouncedValue(search, 400); // ✅ ОПТИМИЗАЦИЯ: Используем общий хук
    const [filter, setFilter] = useState(INITIAL_FILTER);

    // infinite scroll
    const [currentPage, setCurrentPage] = useState(0);
    const [accumulatedData, setAccumulatedData] = useState<any[]>([]);
    const isLoadingMoreRef = useRef(false);
    const onMomentumRef = useRef(false);

    /* UI / dialogs */
    const [deleteId, setDelete] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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
            // ✅ ИСПРАВЛЕНИЕ: Более строгая проверка - исключаем undefined, null, пустые строки и пустые массивы
            // Это критично для правильной работы фильтров
            if (v === undefined || v === null) return;
            if (v === "") return;
            if (Array.isArray(v) && v.length === 0) return;
            
            // ✅ ИСПРАВЛЕНИЕ: Проверяем, что значение действительно имеет смысл
            if (Array.isArray(v) ? v.length > 0 : v) {
                // ✅ Нормализуем массивы: преобразуем строки в числа для числовых полей
                if (Array.isArray(v)) {
                    const numericFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
                    if (numericFields.includes(k)) {
                        // ✅ ИСПРАВЛЕНИЕ: Улучшенная нормализация для стран и других числовых полей
                        // Фильтруем валидные значения и преобразуем в числа
                        const normalized = v
                            .filter((item: any) => {
                                // Исключаем undefined, null, пустые строки
                                if (item === undefined || item === null || item === '') return false;
                                // Проверяем, что значение может быть преобразовано в число
                                if (typeof item === 'string') {
                                    const num = Number(item);
                                    return !isNaN(num) && isFinite(num) && item.trim() !== '';
                                }
                                // Для чисел проверяем, что это валидное число
                                if (typeof item === 'number') {
                                    return !isNaN(item) && isFinite(item);
                                }
                                return false;
                            })
                            .map((item: any) => {
                                // Преобразуем в число
                                if (typeof item === 'string') {
                                    const num = Number(item);
                                    return !isNaN(num) && isFinite(num) ? num : null;
                                }
                                // Если это уже число, проверяем валидность
                                if (typeof item === 'number') {
                                    return !isNaN(item) && isFinite(item) ? item : null;
                                }
                                return null;
                            })
                            .filter((item: any) => item !== null && item !== undefined); // Убираем невалидные значения
                        
                        // Добавляем в queryParams только если есть валидные значения
                        if (normalized.length > 0) {
                            p[k] = normalized;
                        }
                    } else {
                        p[k] = v;
                    }
                } else {
                    p[k] = v;
                }
            }
        });

        // Сортировка убрана - бэкенд не поддерживает параметр sort

        if (!(isMeTravel || isExport)) {
            if (!filter.showModerationPending) {
                // Показываем только опубликованные и прошедшие модерацию
                p.publish = 1;
                p.moderation = 1;
            } else {
                // ✅ ИСПРАВЛЕНИЕ: Показываем статьи на модерации (не прошедшие модерацию)
                // Обычно moderation = 0 означает "на модерации"
                p.moderation = 0;
                // Не добавляем publish, чтобы показать и опубликованные, и неопубликованные на модерации
            }
        }

        if (isMeTravel || isExport) p.user_id = userId;
        else if (user_id) p.user_id = user_id;

        if (isTravelBy) p.countries = [BELARUS_ID];
        if (isMeTravel) {
            delete p.publish;
            delete p.moderation;
        }

        // ✅ ИСПРАВЛЕНИЕ: Сортируем ключи для стабильного сравнения
        // Это гарантирует, что объект будет одинаковым при одинаковых фильтрах
        const sortedKeys = Object.keys(p).sort();
        const sortedParams: Record<string, any> = {};
        sortedKeys.forEach(key => {
            sortedParams[key] = p[key];
        });
        
        return sortedParams;
    }, [filter, isMeTravel, isExport, isTravelBy, userId, user_id]);

    const isQueryEnabled = useMemo(
      () => (isMeTravel || isExport ? !!userId : true),
      [isMeTravel, isExport, userId]
    );
    
    // ✅ ИСПРАВЛЕНИЕ: Показываем loading если userId еще загружается для export/meTravel
    const isUserIdLoading = (isMeTravel || isExport) && userId === null;

    /* Data query (stable key, no stringify) */
    // ✅ ИСПРАВЛЕНИЕ: Используем стабильный queryKey для React Query
    // Важно: React Query сравнивает queryKey по ссылке, поэтому нужно убедиться, что объект создается заново
    const queryKey = useMemo(() => [
        "travels",
        { 
            page: currentPage, 
            perPage: PER_PAGE, 
            search: debSearch, 
            params: queryParams 
        },
    ], [currentPage, debSearch, queryParams]);
    
    const {
        data,
        status,
        isFetching,
        isPreviousData,
        isLoading,
        refetch,
    } = useQuery({
        queryKey,
        queryFn: ({ queryKey, signal }) => {
            const [, { page, perPage, search, params }] = queryKey as any;
            return fetchTravels(page, perPage, search, params, { signal });
        },
        enabled: isQueryEnabled,
        keepPreviousData: false, // ✅ ИСПРАВЛЕНИЕ: Отключаем keepPreviousData для корректного сброса
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000, // ✅ ИСПРАВЛЕНИЕ: cacheTime переименован в gcTime в React Query v5
        // ✅ ИСПРАВЛЕНИЕ: Отключаем автоматический refetch при монтировании, чтобы избежать дублирующихся запросов
        // React Query автоматически сделает запрос при изменении queryKey
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // ✅ ИСПРАВЛЕНИЕ: Нормализуем получение total - учитываем разные форматы ответа
    const total = useMemo(() => {
        if (!data) return 0;
        if (Array.isArray(data)) return data.length;
        if (data && typeof data === 'object' && typeof data.total === 'number') {
            return data.total;
        }
        return 0;
    }, [data]);
    
    const hasMore = (currentPage + 1) * PER_PAGE < total;

    /* Accumulate */
    // ✅ ИСПРАВЛЕНИЕ: Отслеживаем изменения queryKey для корректной обработки данных
    // Используем queryKey напрямую, чтобы убедиться, что данные соответствуют текущим параметрам
    const prevQueryKeyRef = useRef<string>('');
    
    useEffect(() => {
        if (!isQueryEnabled) return;
        
        // ✅ ИСПРАВЛЕНИЕ: Создаем строку для текущего queryKey для сравнения
        // Используем тот же формат, что и в useQuery, чтобы гарантировать соответствие
        const currentQueryKeyString = JSON.stringify({ page: currentPage, perPage: PER_PAGE, search: debSearch, params: queryParams }, Object.keys(queryParams).sort());
        
        // ✅ ИСПРАВЛЕНИЕ: Проверяем, изменился ли queryKey
        // Если изменился - очищаем данные и ждем новые данные для новых параметров
        if (prevQueryKeyRef.current !== currentQueryKeyString) {
            // queryKey изменился - очищаем накопленные данные
            // Это происходит при изменении фильтров, поиска или страницы
            if (prevQueryKeyRef.current !== '') {
                // Не очищаем при первой инициализации
                setAccumulatedData([]);
            }
            prevQueryKeyRef.current = currentQueryKeyString;
            // Если данные еще не загружены, не обрабатываем
            if (status !== "success" || !data) return;
        }
        
        // ✅ ИСПРАВЛЕНИЕ: Проверяем не только status, но и наличие данных
        // И убеждаемся, что данные соответствуют текущему queryKey
        if (status !== "success" || !data) return;

        // ✅ ИСПРАВЛЕНИЕ: Нормализуем структуру данных - API может вернуть разные форматы
        let chunk: any[] = [];
        
        if (Array.isArray(data)) {
            // Если API вернул массив напрямую (обратная совместимость)
            chunk = data;
        } else if (data && typeof data === 'object') {
            // Если API вернул объект с полем data
            if (Array.isArray(data.data)) {
                chunk = data.data;
            } else if (data.data && typeof data.data === 'object') {
                // Если data это один объект, оборачиваем в массив
                chunk = [data.data];
            }
        }
        
        // ✅ ИСПРАВЛЕНИЕ: При currentPage === 0 всегда заменяем данные, а не добавляем
        // Это критично для корректной работы после сброса фильтров
        if (currentPage === 0) {
            // Заменяем все данные новыми
            setAccumulatedData(chunk);
        } else {
            // Добавляем данные для пагинации с защитой от дубликатов
            setAccumulatedData((prev) => {
                // Защита от дубликатов по ID
                const existingIds = new Set(prev.map((item: any) => item?.id ?? item?.slug ?? item?._id));
                const newItems = chunk.filter((item: any) => {
                    const id = item?.id ?? item?.slug ?? item?._id;
                    return id && !existingIds.has(id);
                });
                return [...prev, ...newItems];
            });
        }
        // сбрасываем флаг только когда реально пришла новая партия
        isLoadingMoreRef.current = false;
    }, [isQueryEnabled, status, data, currentPage, queryParams, debSearch]);

    // reset on search/filter change — сбрасываем страницу при изменении фильтров
    // ✅ ИСПРАВЛЕНИЕ: React Query автоматически делает запрос при изменении queryKey
    // Очистка accumulatedData происходит в useEffect накопления данных
    // Это гарантирует, что данные очищаются только когда действительно нужно
    useEffect(() => {
        // При изменении фильтров или поиска сбрасываем страницу
        setCurrentPage(0);
        isLoadingMoreRef.current = false;
        // React Query автоматически сделает новый запрос при изменении queryParams в queryKey
        // accumulatedData будет очищен и обновлен в useEffect накопления данных
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
    // ✅ ИСПРАВЛЕНИЕ: Правильный сброс фильтров - возвращаемся к начальному состоянию
    const resetFilters = useCallback(() => {
        // Полностью очищаем все фильтры, устанавливая INITIAL_FILTER
        // Это гарантирует, что queryParams будет правильным (publish=1, moderation=1)
        setFilter(INITIAL_FILTER);
        setCurrentPage(0);
        // ✅ Не очищаем accumulatedData сразу - это вызовет показ "Ничего не найдено"
        // React Query сам обновит данные при изменении queryParams
        isLoadingMoreRef.current = false;
        // React Query автоматически сделает запрос при изменении queryParams
    }, []);

    // ✅ ИСПРАВЛЕНИЕ: onSelect должен правильно обрабатывать снятие фильтров
    const onSelect = useCallback((field: string, v: any) => {
        setFilter((p) => {
            // ✅ Если значение пустое (undefined, null, пустой массив), удаляем ключ из фильтра
            // Это гарантирует, что queryParams будет правильно обновляться
            if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
                const newFilter = { ...p };
                delete newFilter[field];
                return newFilter;
            }
            return { ...p, [field]: v };
        });
        setCurrentPage(0);
        setAccumulatedData([]);
    }, []);

    const applyFilter = useCallback((v: any) => {
        // ✅ ИСПРАВЛЕНИЕ: Очищаем пустые массивы и undefined значения, но сохраняем структуру для полной очистки
        const cleaned: Record<string, any> = {};
        Object.entries(v).forEach(([key, value]) => {
            // Если значение пустое, устанавливаем undefined для явной очистки
            if (value === undefined || value === null || value === "") {
                cleaned[key] = undefined;
            } else if (Array.isArray(value) && value.length === 0) {
                cleaned[key] = undefined;
            } else {
                cleaned[key] = value;
            }
        });
        // ✅ ИСПРАВЛЕНИЕ: Устанавливаем фильтр с явными undefined для полной очистки
        setFilter(cleaned);
        setCurrentPage(0);
        setAccumulatedData([]);
        isLoadingMoreRef.current = false;
        // ✅ ИСПРАВЛЕНИЕ: React Query автоматически сделает запрос при изменении queryParams
        // Не нужно вызывать refetchQueries вручную
    }, []);

    // ✅ ОПТИМИЗАЦИЯ: Обработчик переключения категории
    const handleToggleCategory = useCallback((categoryName: string) => {
        const currentCategories = filter.categories || [];
        const newCategories = currentCategories.includes(categoryName)
            ? currentCategories.filter((c: string) => c !== categoryName)
            : [...currentCategories, categoryName];
        onSelect('categories', newCategories);
    }, [filter.categories, onSelect]);

    // ✅ ОПТИМИЗАЦИЯ: Получаем категории с количеством из загруженных данных
    const categoriesWithCount = useMemo(() => {
        if (!options?.categories || accumulatedData.length === 0) return [];
        
        // Подсчитываем категории в загруженных данных
        const categoryCounts: Record<string, number> = {};
        accumulatedData.forEach((travel: any) => {
            if (travel.categoryName) {
                const cats = travel.categoryName.split(',').map((c: string) => c.trim());
                cats.forEach((cat: string) => {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });
            }
        });

        // Формируем список категорий с количеством
        return options.categories
            .filter((cat: any) => cat && cat.name && categoryCounts[cat.name])
            .map((cat: any) => ({
                id: cat.id || cat.name,
                name: cat.name,
                count: categoryCounts[cat.name] || 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [options?.categories, accumulatedData]);

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
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsModalMode, setSettingsModalMode] = useState<'save' | 'preview'>('save');

    // ✅ АРХИТЕКТУРА: Используем новый архитектурный хук для экспорта в PDF
    const pdfExport = usePdfExport(selected as any, {
      maxRetries: 3,
      imageLoadTimeout: 10000,
      batchSize: 5,
      enableCache: true,
    });

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
    const clearSelection = useCallback(() => setSelected([]), []);
    const selectionCount = selected.length;
    const hasSelection = selectionCount > 0;
    const selectionLabel = hasSelection
      ? `Выбрано ${selectionCount} ${pluralizeTravels(selectionCount)}`
      : 'Выберите путешествия для экспорта';

    // ✅ АРХИТЕКТУРА: Настройки по умолчанию
    const baseSettings: BookSettings = useMemo(() => ({
      title: userId ? `Путешествия ${userId}` : 'Мои путешествия',
      subtitle: '',
      coverType: 'auto',
      template: 'classic',
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
    }), [userId]);

    const [lastSettings, setLastSettings] = useState<BookSettings>(baseSettings);

    useEffect(() => {
      setLastSettings(baseSettings);
    }, [baseSettings]);

    // ✅ УЛУЧШЕНИЕ: Обработчики для нового экспорта
    // ✅ АРХИТЕКТУРА: Обработчики для сохранения и превью с настройками
    const handleSaveWithSettings = useCallback(async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.exportPdf(settings);
    }, [pdfExport]);

    const handlePreviewWithSettings = useCallback(async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.previewPdf(settings);
    }, [pdfExport]);

    const settingsSummary = useMemo(() => {
      const orientation = ORIENTATION_LABELS[lastSettings.orientation] || 'Книжная';
      const template = TEMPLATE_LABELS[lastSettings.template] || 'Шаблон';
      return `${lastSettings.format.toUpperCase()} • ${orientation} • ${template}`;
    }, [lastSettings]);

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
              "position:fixed;top:0;left:0;right:0;padding:20px;background:#6b8e7f;color:#fff;text-align:center;z-index:9999;";
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
                  "position:fixed;top:20px;right:20px;z-index:9999;padding:10px 20px;background:#fff;color:#6b8e7f;border:none;border-radius:4px;cursor:pointer;";
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

    // ✅ УЛУЧШЕНИЕ: Используем новый генератор с настройками по умолчанию
    const savePdf = useCallback(async () => {
        if (!selected.length) {
            Alert.alert("Внимание", "Пожалуйста, выберите хотя бы одно путешествие");
            return;
        }
        // Используем настройки по умолчанию или открываем модальное окно
        if (Platform.OS === "web") {
            setShowSettingsModal(true);
        } else {
            Alert.alert("Недоступно", "Сохранение PDF доступно только в веб-версии.");
        }
    }, [selected]);

    /* Loading helpers */
    const hasAnyItems = accumulatedData.length > 0;
    
    // ✅ ИСПРАВЛЕНИЕ: Определяем состояния загрузки более точно
    // Учитываем загрузку userId для export/meTravel
    const isInitialLoading = ((isQueryEnabled && isLoading && !hasAnyItems) || isUserIdLoading);
    const isNextPageLoading = isFetching && hasAnyItems;
    
    // ✅ ИСПРАВЛЕНИЕ: isEmpty должен быть true только если:
    // 1. Запрос включен
    // 2. Статус успешный (данные были загружены)
    // 3. НЕ идет загрузка (isFetching === false и isLoading === false)
    // 4. НЕТ данных ни в accumulatedData, ни в data от бэкенда
    // 5. userId загружен (для export/meTravel)
    const isEmpty = useMemo(() => {
        // ✅ Не показываем пустое состояние если userId еще загружается
        if (isUserIdLoading) return false;
        
        // ✅ Не показываем пустое состояние во время загрузки
        // Это критично - при изменении фильтров данные очищаются, но новые еще загружаются
        if (isFetching || isLoading) return false;
        
        // ✅ Не показываем пустое состояние если запрос не включен
        // Это предотвратит показ "Ничего не найдено" пока запрос не начался
        if (!isQueryEnabled) return false;
        
        // ✅ Не показываем пустое состояние если данные есть в accumulatedData
        if (hasAnyItems) return false;
        
        // ✅ Проверяем данные от бэкенда
        // Если данные есть в ответе API, значит они еще обрабатываются и будут добавлены
        if (data) {
            if (Array.isArray(data)) {
                if (data.length > 0) return false; // Есть данные - не пустое
            } else if (data && typeof data === 'object') {
                if (Array.isArray(data.data) && data.data.length > 0) return false; // Есть данные
                if (typeof data.total === 'number' && data.total > 0) return false; // Есть данные по total
                if (data.data && typeof data.data === 'object') return false; // Один объект - есть данные
            }
        }
        
        // ✅ Показываем пустое состояние только если:
        // - userId загружен (для export/meTravel)
        // - Запрос включен
        // - Статус успешный (запрос завершен)
        // - И данных действительно нет (ни в accumulatedData, ни в data)
        return isQueryEnabled && status === "success";
    }, [isQueryEnabled, status, isFetching, isLoading, hasAnyItems, data, isUserIdLoading]);

    const canLoadMore = !isNextPageLoading && hasMore && !isPreviousData;

    const handleEndReached = useCallback(() => {
        if (!canLoadMore || isLoadingMoreRef.current || onMomentumRef.current) return;
        isLoadingMoreRef.current = true;
        setCurrentPage((p) => p + 1);
    }, [canLoadMore]);

    // ✅ ОПТИМИЗАЦИЯ: Pull-to-Refresh
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setCurrentPage(0);
        setAccumulatedData([]);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

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
                  {/* ✅ ДИЗАЙН: Увеличен верхний отступ для SearchAndFilterBar */}
                  <View style={[styles.searchSection, isMobile && styles.searchSectionMobile]}>
                      <SearchAndFilterBar
                        search={search}
                        setSearch={setSearch}
                        onToggleFilters={isMobile ? () => setShowFilters(true) : undefined}
                        onTogglePersonalization={handleTogglePersonalization}
                        onToggleWeeklyHighlights={handleToggleWeeklyHighlights}
                        isPersonalizationVisible={isPersonalizationVisible}
                        isWeeklyHighlightsVisible={isWeeklyHighlightsVisible}
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

                  {/* Персонализация и подборка недели под фильтром */}
                  {isInitialized && isPersonalizationVisible && (
                      <Suspense fallback={<View style={styles.recommendationsLoader}><ActivityIndicator size="small" /></View>}>
                          <PersonalizedRecommendations 
                              forceVisible={isPersonalizationVisible}
                              onVisibilityChange={(visible) => {
                                  if (!visible) {
                                      if (onTogglePersonalization) {
                                          onTogglePersonalization();
                                      } else {
                                          handleTogglePersonalization();
                                      }
                                  }
                              }}
                          />
                      </Suspense>
                  )}
                  {isInitialized && isWeeklyHighlightsVisible && (
                      <Suspense fallback={<View style={styles.recommendationsLoader}><ActivityIndicator size="small" /></View>}>
                          <WeeklyHighlights 
                              forceVisible={isWeeklyHighlightsVisible}
                              onVisibilityChange={(visible) => {
                                  if (!visible) {
                                      if (onToggleWeeklyHighlights) {
                                          onToggleWeeklyHighlights();
                                      } else {
                                          handleToggleWeeklyHighlights();
                                      }
                                  }
                              }}
                          />
                      </Suspense>
                  )}

                  {isInitialLoading && (
                    <TravelListSkeleton count={PER_PAGE} />
                  )}

                  {status === "error" && (
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
                  {isEmpty && (
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
                      removeClippedSubviews={true} // ✅ ОПТИМИЗАЦИЯ: Удалять невидимые элементы
                      initialNumToRender={6} // ✅ ОПТИМИЗАЦИЯ: Уменьшить начальное количество
                      maxToRenderPerBatch={6} // ✅ ОПТИМИЗАЦИЯ: Уменьшить батч
                      windowSize={5} // ✅ ОПТИМИЗАЦИЯ: Уменьшить окно видимости
                      updateCellsBatchingPeriod={100} // ✅ ОПТИМИЗАЦИЯ: Увеличить период батчинга
                      onEndReachedThreshold={0.5}
                      onEndReached={handleEndReached}
                      onMomentumScrollBegin={onMomentumBegin}
                      onScroll={onScroll}
                      extraData={{ sel: selected.length }}
                      accessibilityRole="list"
                      refreshControl={
                        <RefreshControl
                          refreshing={isRefreshing}
                          onRefresh={handleRefresh}
                          tintColor="#6b8e7f"
                          colors={['#6b8e7f']}
                        />
                      }
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
              printRef={printRef}
              selected={selected}
              isGenerating={pdfExport.isGenerating}
              progress={pdfExport.progress}
              settingsSummary={settingsSummary}
              hasSelection={hasSelection}
            />
          )}

          {/* Модальное окно настроек фотоальбома */}
          {isExport && Platform.OS === "web" && (
            <BookSettingsModal
              visible={showSettingsModal}
              onClose={() => setShowSettingsModal(false)}
              onSave={handleSaveWithSettings}
              onPreview={handlePreviewWithSettings}
              defaultSettings={lastSettings}
              travelCount={selected.length}
              userName={userId || undefined}
              mode={settingsModalMode}
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
        width: 280, // ✅ ДИЗАЙН: Уменьшена ширина для компактности
        backgroundColor: "#ffffff", // ✅ ДИЗАЙН: Белый фон
        borderRightWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.08)", // ✅ ДИЗАЙН: Единая граница
        ...Platform.select({
            web: {
                boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
                position: "sticky" as any, // ✅ ДИЗАЙН: Sticky positioning
                top: 0, // ✅ ДИЗАЙН: Прилипает к верху
                alignSelf: "flex-start",
                maxHeight: "100vh",
                overflowY: "auto" as any,
            },
        }),
    },
    main: {
        flex: 1,
        padding: Platform.select({
            default: 12, // Mobile: 12px
            web: 16, // Desktop: 16px
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
            default: 4,
            web: 24,
        }),
        marginBottom: Platform.select({
            default: 8,
            web: 24,
        }),
    },
    searchSectionMobile: {
        marginTop: 4,
        marginBottom: 8,
    },
    // ✅ ДИЗАЙН: Секция категорий с улучшенными отступами
    categoriesSection: {
        marginTop: Platform.select({
            default: 16, // Mobile: 16px
            web: 20, // Desktop: 20px
        }),
        marginBottom: Platform.select({
            default: 16, // Mobile: 16px
            web: 24, // Desktop: 24px
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
        gap: 12,
        padding: 12,
        borderTopWidth: 1,
        borderColor: "#eee",
        backgroundColor: "#fafafa",
    },
    exportBarInfo: {
        gap: 6,
    },
    exportBarInfoTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
    },
    exportBarInfoSubtitle: {
        fontSize: 13,
        color: "#4b5563",
    },
    exportBarInfoActions: {
        flexDirection: "row",
        gap: 12,
        flexWrap: "wrap",
    },
    exportBarButtons: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },
    exportBarButtonsMobile: {
        flexDirection: "column",
    },
    linkButton: {
        color: "#2563eb",
        fontSize: 13,
        fontWeight: "600",
    },
    btn: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: "center",
        ...(Platform.OS === "web" ? { 
            backgroundColor: "#6b7280",
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            ':hover': {
                backgroundColor: '#4b5563',
                transform: 'translateY(-1px)',
            } as any,
        } : {}),
    },
    // ✅ УЛУЧШЕНИЕ: Стили для кнопки настроек
    btnSettings: {
        ...(Platform.OS === "web" ? { 
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#d1d5db",
            flex: 0,
            minWidth: 120,
        } : {}),
    },
    // ✅ УЛУЧШЕНИЕ: Стили для основной кнопки
    btnPrimary: {
        ...(Platform.OS === "web" ? { 
            backgroundColor: "#ff9f5a",
            ':hover': {
                backgroundColor: '#ff8c42',
                boxShadow: '0 4px 12px rgba(255,159,90,0.3)',
            } as any,
        } : {}),
    },
    btnDisabled: {
        ...(Platform.OS === "web" ? { 
            backgroundColor: "#d1d5db",
            cursor: 'not-allowed',
            ':hover': {
                backgroundColor: '#d1d5db',
                transform: 'none',
            } as any,
        } : {}),
        opacity: Platform.OS === "web" ? 0.6 : 0.5,
    },
    btnTxt: { 
        color: "#fff", 
        fontWeight: "600", 
        fontSize: 14,
    },
    // ✅ УЛУЧШЕНИЕ: Стили текста для разных кнопок
    btnTxtSettings: {
        ...(Platform.OS === "web" ? {
            color: "#374151",
        } : {}),
    },
    btnTxtPrimary: {
        color: "#fff",
    },
    recommendationsLoader: {
        paddingVertical: 24,
        alignItems: "center",
    },
    selectionBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: "#ecfdf5",
        borderWidth: 1,
        borderColor: "#bbf7d0",
        gap: 12,
    },
    selectionBannerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#065f46",
    },
    selectionBannerSubtitle: {
        fontSize: 13,
        color: "#047857",
    },
    selectionBannerClear: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#a7f3d0",
    },
    selectionBannerClearText: {
        color: "#059669",
        fontWeight: "600",
    },
});

export default memo(ListTravel);
