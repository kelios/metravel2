// src/components/listTravel/FiltersComponent.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  useEffect,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Keyboard,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { debounce } from "lodash";
import SearchAndFilterBar from "./SearchAndFilterBar";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface FiltersData {
  countries?: any[];
  categories?: any[];
  categoryTravelAddress?: any[];
  transports?: any[];
  companions?: any[];
  complexity?: any[];
  month?: any[];
  over_nights_stay?: any[];
}

interface FiltersValue {
  year?: string;
  moderation?: number | undefined;
  countries?: any;
  categories?: any[];
  categoryTravelAddress?: any[];
  transports?: any[];
  companions?: any[];
  complexity?: any[];
  month?: any[];
  over_nights_stay?: any[];
  [key: string]: any;
}

interface FiltersComponentProps {
  filters?: FiltersData;
  filterValue?: FiltersValue;
  onSelectedItemsChange: (field: string, value: any) => void;
  handleApplyFilters: (filters: FiltersValue) => void;
  resetFilters: () => void;
  closeMenu?: () => void;
  isSuperuser: boolean;
  isCompact?: boolean;
  disableApplyOnMobileClose?: boolean;
  initialOpenState?: Record<string, boolean>;
  search?: string;
  setSearch?: (value: string) => void;
  onToggleRecommendations?: () => void;
  isRecommendationsVisible?: boolean;
  resultsCount?: number;
  hasFilters?: boolean;
  onClearAll?: () => void;
}

/* ===================== */
/*   Служебные элементы  */
/* ===================== */

const GroupBoxItem = memo(function GroupBoxItem({
                                                  id,
                                                  title,
                                                  checked,
                                                  onPress,
                                                }: {
  id: number | string;
  title: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.checkboxRow, 
        Platform.OS === "web" && { cursor: "pointer" },
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
      ]}
      onPress={onPress}
      aria-pressed={checked}
      role="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked }}
      hitSlop={8}
      {...Platform.select({
        web: {
          // ✅ ИСПРАВЛЕНИЕ: Убеждаемся, что элемент кликабелен на веб
          pointerEvents: 'auto' as any,
          userSelect: 'none' as any,
        },
      })}
    >
      <Feather 
        name={checked ? "check-square" : "square"} 
        size={20} // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для лучшей видимости
        color={checked ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textMuted} // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
      />
      <Text style={[styles.itemText, checked && { color: DESIGN_TOKENS.colors.primary, fontWeight: "600" }]}>
        {title}
      </Text>
    </Pressable>
  );
});

const GroupBox = memo(function GroupBox({
                                          label,
                                          field,
                                          items,
                                          valKey,
                                          labelKey,
                                          filterValue,
                                          handleCheckForField,
                                          open,
                                          toggle,
                                        }: any) {
  const selectedItems = filterValue[field] ?? [];

  return (
    <View style={styles.groupBox}>
      <Pressable
        style={[
          styles.groupHeader, 
          Platform.OS === "web" && { cursor: "pointer" },
          globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        ]}
        onPress={() => toggle(field)}
        aria-expanded={open}
        accessibilityLabel={label}
        hitSlop={6}
        {...Platform.select({
          web: {
            // ✅ ИСПРАВЛЕНИЕ: Убеждаемся, что элемент кликабелен на веб
            pointerEvents: 'auto' as any,
          },
        })}
      >
        <Text style={styles.groupLabel}>{label}</Text>
        <Feather 
          name={open ? "chevron-up" : "chevron-down"} 
          size={18} // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для лучшей видимости
          color={open ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textMuted} // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
        />
      </Pressable>

      {open && (
        <View style={styles.itemsBox}>
          {items.map((it: any) => {
            const id = it[valKey];
            // ✅ ИСПРАВЛЕНИЕ: Нормализуем типы для корректного сравнения (строки и числа)
            const normalizedId = String(id);
            const normalizedSelected = (selectedItems ?? []).map((v: any) => String(v));
            const isChecked = normalizedSelected.includes(normalizedId);
            return (
              <GroupBoxItem
                key={id}
                id={id}
                title={it[labelKey]}
                checked={isChecked}
                onPress={() => handleCheckForField(id)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
});

/* ===================== */
/*     Основной блок     */
/* ===================== */

const FiltersComponent: React.FC<FiltersComponentProps> = ({
  filters = {},
  filterValue = {},
  onSelectedItemsChange,
  handleApplyFilters,
  resetFilters,
  closeMenu,
  isSuperuser,
  isCompact = false,
  disableApplyOnMobileClose = false,
  initialOpenState = {},
  search,
  setSearch,
  onToggleRecommendations,
  isRecommendationsVisible,
  resultsCount,
  hasFilters,
  onClearAll,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { name } = useRoute() as any;

  const isMobile = useMemo(() => width <= 768, [width]);
  const isMobileFullScreenMode = useMemo(() => isMobile && !isCompact, [isMobile, isCompact]);
  const isTravelsByPage = useMemo(() => name === "travelsby", [name]);

  const [year, setYear] = useState(filterValue.year ?? "");
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpenState);
  const [yearOpen, setYearOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [applying, setApplying] = useState(false); // ⟵ добавлено
  const [yearApplied, setYearApplied] = useState(false); // ✅ UX: Индикатор применения фильтра по году

  const scrollRef = useRef<ScrollView>(null);
  const yearInputRef = useRef<TextInput>(null);
  const latestFiltersRef = useRef<Record<string, any>>(filterValue);

  // Всегда держим в ref последнее известное состояние фильтров
  useEffect(() => {
    latestFiltersRef.current = filterValue;
  }, [filterValue]);

  const groups = useMemo(
    () => [
      // Страны скрываем только на спец.странице travelsby, на остальных страницах фильтр доступен
      { label: "Страны", field: "countries", items: filters.countries ?? [], valKey: "country_id", labelKey: "title_ru", hidden: isTravelsByPage },
      { label: "Категории", field: "categories", items: filters.categories ?? [], valKey: "id", labelKey: "name" },
      { label: "Объекты", field: "categoryTravelAddress", items: filters.categoryTravelAddress ?? [], valKey: "id", labelKey: "name" },
      { label: "Транспорт", field: "transports", items: filters.transports ?? [], valKey: "id", labelKey: "name" },
      { label: "Спутники", field: "companions", items: filters.companions ?? [], valKey: "id", labelKey: "name" },
      { label: "Сложность", field: "complexity", items: filters.complexity ?? [], valKey: "id", labelKey: "name" },
      { label: "Месяц", field: "month", items: filters.month ?? [], valKey: "id", labelKey: "name" },
      { label: "Ночлег", field: "over_nights_stay", items: filters.over_nights_stay ?? [], valKey: "id", labelKey: "name" },
    ],
    [filters, isTravelsByPage]
  );

  const apply = useCallback(() => {
    Keyboard.dismiss();

    // ✅ ИСПРАВЛЕНИЕ: Год всегда берем из локального состояния year, а не из filterValue
    // Это гарантирует, что актуальное значение года попадет в запрос
    const yearValue = year && typeof year === 'string' && year.trim() !== ''
      ? year.trim()
      : undefined;

    // ✅ ИСПРАВЛЕНИЕ: Берем базовое состояние фильтров из latestFiltersRef,
    // чтобы учитывать только что измененные значения (категории, транспорт и т.д.)
    const baseFilters = latestFiltersRef.current || filterValue;
    const updatedFilterValue = {
      ...baseFilters,
      year: yearValue,
    };

    // приводим пустые массивы к undefined, чтобы родитель не слал пустые фильтры
    const cleanedFilterValue = Object.fromEntries(
      Object.entries(updatedFilterValue).map(([key, value]) => {
        if (Array.isArray(value) && value.length === 0) return [key, undefined];
        return [key, value];
      })
    );

    setApplying(true);
    if (yearValue && yearValue.length === 4) {
      setYearApplied(true); // ✅ UX: Показываем индикатор применения только если год валидный
    }
    
    handleApplyFilters(cleanedFilterValue);

    // 🔧 МЯГКОЕ ЗАКРЫТИЕ НА МОБИЛЕ
    // даём одному-двум кадрам отрисоваться (чтобы список не мигал «Нет данных»),
    // затем закрываем панель
    if (isMobile && !disableApplyOnMobileClose) {
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          closeMenu();
          setApplying(false);
          cancelAnimationFrame(raf2);
        });
        cancelAnimationFrame(raf1);
      });
    } else {
      setApplying(false);
    }
  }, [filterValue, year, isMobile, disableApplyOnMobileClose, handleApplyFilters, closeMenu]);

  // ✅ ИСПРАВЛЕНИЕ: Улучшенный дебаунс для предотвращения множественных применений
  const debouncedApplyRef = useRef<ReturnType<typeof debounce> | null>(null);
  
  // ✅ ИСПРАВЛЕНИЕ: Создаем дебаунс один раз и переиспользуем
  useEffect(() => {
    debouncedApplyRef.current = debounce(apply, 400);
    return () => {
      debouncedApplyRef.current?.cancel();
      debouncedApplyRef.current = null;
    };
  }, [apply]);
  
  const debouncedApply = useCallback(() => {
    debouncedApplyRef.current?.();
  }, []);

  // ✅ UX: Синхронизация индикатора применения с filterValue.year
  useEffect(() => {
    if (filterValue.year && filterValue.year === year && year.length === 4) {
      setYearApplied(true);
    } else if (!filterValue.year || filterValue.year !== year) {
      setYearApplied(false);
    }
  }, [filterValue.year, year]);

  const toggle = useCallback((field: string) => {
    setOpen((prev) => ({ ...prev, [field]: !(prev[field] ?? false) }));
  }, []);

  // чекбоксы: обновляем и авто-применяем всегда (без кнопок)
  const handleCheckForField = useCallback(
    (field: string) => (id: any) => {
      const selected = (latestFiltersRef.current?.[field] ?? filterValue[field] ?? []);
      // ✅ ИСПРАВЛЕНИЕ: Нормализуем типы для корректного сравнения (строки и числа)
      const normalizedId = String(id);
      const normalizedSelected = selected.map((v: any) => String(v));
      const isSelected = normalizedSelected.includes(normalizedId);
      const next = isSelected 
        ? selected.filter((v: any) => String(v) !== normalizedId)
        : [...selected, id];
      // Обновляем локальное представление фильтров, чтобы apply знал о свежем состоянии
      latestFiltersRef.current = {
        ...(latestFiltersRef.current || filterValue),
        [field]: next,
      };
      onSelectedItemsChange(field, next);
      debouncedApply(); // ✅ КОМПАКТНОСТЬ: Авто-применение всегда
    },
    [filterValue, onSelectedItemsChange, debouncedApply]
  );

  const handleYearChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);
      setYear(cleaned);
      setYearApplied(false); // ✅ UX: Сбрасываем индикатор при изменении
      // ✅ ИСПРАВЛЕНИЕ: Немедленно обновляем год в фильтрах при изменении
      const yearValue = cleaned && cleaned.length > 0 ? cleaned : undefined;
      latestFiltersRef.current = {
        ...(latestFiltersRef.current || filterValue),
        year: yearValue,
      };
      onSelectedItemsChange('year', yearValue);
      // ✅ UX: Авто-применение при вводе 4 цифр
      if (cleaned.length === 4) {
        debouncedApply();
        // Устанавливаем индикатор после debounce
        setTimeout(() => setYearApplied(true), 400);
      }
    },
    [debouncedApply, onSelectedItemsChange]
  );

  const handleReset = useCallback(() => {
    setYear("");
    setYearApplied(false); // ✅ UX: Сбрасываем индикатор применения
    // ✅ ИСПРАВЛЕНИЕ: Сбрасываем все фильтры через onSelectedItemsChange перед вызовом resetFilters
    // Очищаем все поля фильтров явно
    const allFilterFields = [
      'countries', 'categories', 'categoryTravelAddress', 'transports', 
      'companions', 'complexity', 'month', 'over_nights_stay', 'year'
    ];
    allFilterFields.forEach((key) => {
      onSelectedItemsChange(key, undefined);
    });
    // Сбрасываем модерацию если она была установлена
    if (filterValue.moderation !== undefined) {
      onSelectedItemsChange("moderation", undefined);
    }
    // ✅ ИСПРАВЛЕНИЕ: Применяем полностью очищенные фильтры немедленно
    const emptyFilters: Record<string, any> = {
      year: undefined,
      moderation: undefined,
      countries: undefined,
      categories: undefined,
      categoryTravelAddress: undefined,
      transports: undefined,
      companions: undefined,
      complexity: undefined,
      month: undefined,
      over_nights_stay: undefined,
    };
    handleApplyFilters(emptyFilters);
    // Вызываем resetFilters для синхронизации состояния
    resetFilters();
    if (isMobile && !disableApplyOnMobileClose) {
      // тоже мягко закрываем
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          closeMenu();
          cancelAnimationFrame(raf2);
        });
        cancelAnimationFrame(raf1);
      });
    }
  }, [isMobile, disableApplyOnMobileClose, resetFilters, closeMenu, filterValue, onSelectedItemsChange, handleApplyFilters]);

  const handleToggleAll = useCallback(() => {
    const newState: Record<string, boolean> = {};
    groups.forEach(({ field, hidden }) => {
      if (!hidden) {
        // ✅ ИСПРАВЛЕНИЕ: Учитываем текущее состояние, если оно есть
        const currentState = open[field] ?? false;
        newState[field] = !allExpanded ? true : false;
      }
    });
    setOpen(newState);
    setAllExpanded(!allExpanded);
  }, [groups, allExpanded, open]);

  /* ======= Модерация ======= */
  const renderModerationCheckbox = useMemo(
    () => {
      if (!isSuperuser) return null;
      const isModerationPending = filterValue.moderation === 0;
      return (
        <View style={styles.groupBox}>
          <Text style={styles.groupLabel}>Модерация</Text>
          <View style={styles.itemsBox}>
            <Pressable
              onPress={() => {
                onSelectedItemsChange("moderation", isModerationPending ? undefined : 0);
                debouncedApply(); // ✅ КОМПАКТНОСТЬ: Авто-применение
              }}
              style={[styles.checkboxRow, Platform.OS === "web" && { cursor: "pointer" }]}
              aria-pressed={isModerationPending}
              role="checkbox"
              accessibilityLabel="Показать статьи на модерации"
              accessibilityState={{ checked: isModerationPending }}
              hitSlop={8}
            >
              <Feather
                name={isModerationPending ? "check-square" : "square"}
                size={18} // ✅ КОМПАКТНОСТЬ: Меньше размер иконки
                color={isModerationPending ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.textMuted} // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
              />
              <Text style={styles.itemText}>Показать статьи на модерации</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [isSuperuser, filterValue.moderation, onSelectedItemsChange, debouncedApply]
  );

  /* ======= Ввод Года ======= */
  const renderYearInput = useMemo(
    () => (
      <View style={styles.groupBox}>
        <Pressable
          style={[styles.groupHeader, Platform.OS === "web" && { cursor: "pointer" }]}
          onPress={() => {
            setYearOpen((v) => !v);
            setTimeout(() => yearInputRef.current?.focus(), 100);
          }}
          aria-expanded={yearOpen}
          accessibilityLabel="Фильтр по году"
          hitSlop={6}
        >
          <Text style={styles.groupLabel}>Год</Text>
          {/* ✅ КОМПАКТНОСТЬ: Меньше размер иконки */}
          <Feather name={yearOpen ? "chevron-up" : "chevron-down"} size={16} color="#333" />
        </Pressable>

        {yearOpen && (
          <View style={styles.yearBox}>
            <View style={styles.yearInputWrapper}>
              <View style={styles.yearInputContainer}>
                <TextInput
                  ref={yearInputRef}
                  value={year}
                  onChangeText={handleYearChange}
                  placeholder="2023"
                  keyboardType="numeric"
                  maxLength={4}
                  style={[
                    styles.yearInput,
                    yearApplied && year.length === 4 && styles.yearInputApplied,
                  ]}
                  returnKeyType="done"
                  onSubmitEditing={apply}
                  accessibilityLabel="Введите год"
                />
                {/* ✅ UX: Индикатор применения (галочка при примененном фильтре) */}
                {yearApplied && year.length === 4 && (
                  <View style={styles.yearAppliedIndicator}>
                    {/* ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет */}
                    <Feather name="check-circle" size={18} color={DESIGN_TOKENS.colors.primary} />
                  </View>
                )}
                {/* ✅ UX: Кнопка очистки */}
                {year.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setYear("");
                      setYearApplied(false);
                      // Применяем пустой фильтр
                      const cleanedFilterValue = Object.fromEntries(
                        Object.entries(filterValue).map(([key, value]) => {
                          if (Array.isArray(value) && value.length === 0) return [key, undefined];
                          return [key, value];
                        })
                      );
                      handleApplyFilters({
                        ...cleanedFilterValue,
                        year: undefined,
                      });
                    }}
                    style={styles.clearIcon}
                    accessibilityLabel="Очистить год"
                    hitSlop={8}
                    {...Platform.select({
                      web: { cursor: 'pointer' },
                    })}
                  >
                    <Feather name="x" size={16} color="#999" />
                  </Pressable>
                )}
              </View>
              {/* ✅ UX: Кнопка "Применить" для явного контроля (показываем при 1-3 цифрах) */}
              {year.length > 0 && year.length < 4 && (
                <Pressable
                  onPress={apply}
                  style={[styles.applyYearButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                  accessibilityLabel="Применить фильтр по году"
                  hitSlop={8}
                  {...Platform.select({
                    web: { cursor: 'pointer' },
                  })}
                >
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.applyYearButtonText}>Применить</Text>
                </Pressable>
              )}
            </View>
            {/* ✅ UX: Подсказка о поведении фильтра */}
            {year.length > 0 && year.length < 4 && (
              <Text style={styles.yearHint}>
                Автоматически применится при вводе 4 цифр
              </Text>
            )}
            {yearApplied && year.length === 4 && (
              <Text style={styles.yearAppliedText}>
                ✓ Фильтр применен
              </Text>
            )}
          </View>
        )}
      </View>
    ),
    [yearOpen, year, yearApplied, handleYearChange, apply, filterValue, handleApplyFilters]
  );

  /* ======= Футер кнопок ======= */
  // ✅ КОМПАКТНОСТЬ: Убраны кнопки "Сбросить" и "Применить" - фильтры применяются автоматически
  const renderFooter = useMemo(
    () => {
      // На мобиле оставляем только кнопку "Закрыть"
      if (isMobile && closeMenu) {
        return (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Pressable
              style={[styles.btn, styles.close]}
              onPress={closeMenu}
              accessibilityLabel="Закрыть фильтры"
              hitSlop={8}
            >
              <Text style={styles.btnTxt}>Закрыть</Text>
            </Pressable>
          </View>
        );
      }
      // На десктопе футер не нужен
      return null;
    },
    [isMobile, insets.bottom, closeMenu]
  );

  return (
    <View style={[styles.root, isMobileFullScreenMode && styles.fullScreenMobile]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isMobileFullScreenMode && { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS !== "web"}
      >
        <View style={styles.content}>
          {search !== undefined && setSearch && isMobile && (
            <View style={styles.searchInFilters}>
              <SearchAndFilterBar
                search={search}
                setSearch={setSearch}
                onToggleFilters={undefined}
                onToggleRecommendations={onToggleRecommendations}
                isRecommendationsVisible={isRecommendationsVisible}
                hasFilters={hasFilters}
                resultsCount={resultsCount}
                onClearAll={onClearAll}
              />
            </View>
          )}
          {renderModerationCheckbox}

          <Pressable
            style={[styles.toggleAllBtn, Platform.OS === "web" && { cursor: "pointer" }]}
            onPress={handleToggleAll}
            accessibilityLabel={allExpanded ? "Свернуть все фильтры" : "Развернуть все фильтры"}
            hitSlop={8}
          >
            <Text style={styles.toggleAllText}>{allExpanded ? "Свернуть все" : "Развернуть все"}</Text>
          </Pressable>

          {groups.map(({ label, field, items, valKey, labelKey, hidden }) =>
            hidden ? null : (
              <GroupBox
                key={field}
                label={label}
                field={field}
                items={items}
                valKey={valKey}
                labelKey={labelKey}
                filterValue={filterValue}
                handleCheckForField={handleCheckForField(field)}
                open={!!open[field]}
                toggle={toggle}
              />
            )
          )}

          {renderYearInput}
        </View>
      </ScrollView>
      {renderFooter}
    </View>
  );
};

export default memo(FiltersComponent);

/* ===================== */
/*         Стили         */
/* ===================== */

// ✅ ИСПРАВЛЕНИЕ: Используем единую палитру DESIGN_TOKENS вместо локальной DESIGN_COLORS
// DESIGN_COLORS заменён на DESIGN_TOKENS для унификации цветов

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: "#fff",
    ...Platform.select({
      web: {
        borderRadius: 16, // ✅ ДИЗАЙН: Скругленные углы (сверху)
        borderTopLeftRadius: 0, // На desktop sidebar не имеет скругления сверху (в ListTravel.tsx)
        borderTopRightRadius: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)", // ✅ ДИЗАЙН: Легкая тень
      },
    }),
  },

  fullScreenMobile: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: "#fff",
  },

  scroll: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: Platform.select({ default: 12, web: 4 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingBottom: Platform.select({ default: 16, web: 8 }) // ✅ КОМПАКТНОСТЬ: Меньше отступы
  },
  content: { 
    paddingHorizontal: Platform.select({ default: 10, web: 4 }) // ✅ КОМПАКТНОСТЬ: Меньше отступы
  },
  searchInFilters: {
    marginBottom: Platform.select({ default: 12, web: 8 }),
    paddingBottom: Platform.select({ default: 12, web: 8 }),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },

  groupBox: { 
    marginBottom: Platform.select({ default: 8, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    backgroundColor: "#ffffff", // ✅ ДИЗАЙН: Белый фон
    borderRadius: Platform.select({ default: 8, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше радиус
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    ...Platform.select({
      web: {
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: DESIGN_TOKENS.shadows.light, // ✅ ДИЗАЙН: Используем тень из дизайн-системы
        // @ts-ignore
        ":hover": {
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          borderColor: 'rgba(0, 0, 0, 0.1)', // ✅ ДИЗАЙН: Нейтральная граница при hover
        },
      },
    }),
  },

  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Platform.select({ default: 10, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingHorizontal: Platform.select({ default: 10, web: 10 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    borderRadius: Platform.select({ default: 8, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше радиус
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        cursor: "pointer",
        // @ts-ignore
        ":hover": {
          backgroundColor: 'rgba(0, 0, 0, 0.02)', // ✅ ДИЗАЙН: Нейтральный hover
        },
      },
    }),
  },
  groupLabel: { 
    fontSize: Platform.select({ default: 14, web: 14 }), // ✅ КОМПАКТНОСТЬ: Меньше размер шрифта
    fontWeight: "600", // ✅ ДИЗАЙН: Уменьшен weight для прозаичности
    color: DESIGN_TOKENS.colors.text, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    letterSpacing: -0.1, // ✅ ДИЗАЙН: Меньше отрицательный letter-spacing
  },

  itemsBox: { 
    paddingHorizontal: Platform.select({ default: 10, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingBottom: Platform.select({ default: 4, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({ default: 6, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingHorizontal: Platform.select({ default: 4, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    gap: Platform.select({ default: 8, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше gap
    borderRadius: Platform.select({ default: 6, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше радиус
    marginBottom: Platform.select({ default: 2, web: 2 }), // ✅ КОМПАКТНОСТЬ: Меньше отступ
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        cursor: "pointer",
        // @ts-ignore
        ":hover": {
          backgroundColor: 'rgba(0, 0, 0, 0.02)', // ✅ ДИЗАЙН: Нейтральный hover
        },
      },
    }),
  },
  itemText: { 
    fontSize: Platform.select({ default: 12, web: 13 }), // ✅ КОМПАКТНОСТЬ: Меньше размер шрифта
    color: DESIGN_TOKENS.colors.text, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    flex: 1,
    fontWeight: "500",
    lineHeight: Platform.select({ default: 16, web: 18 }), // ✅ КОМПАКТНОСТЬ: Меньше line-height
  },

  yearBox: { 
    paddingHorizontal: Platform.select({ default: 10, web: 8 }),
    paddingBottom: Platform.select({ default: 4, web: 6 }),
  },
  yearInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: '100%',
    flexWrap: 'wrap', // ✅ ИСПРАВЛЕНИЕ: Разрешаем перенос на новую строку
  },
  yearInputContainer: {
    flex: 1,
    position: "relative",
    minWidth: 120, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для инпута
    maxWidth: '100%',
  },
  yearInput: {
    width: '100%',
    backgroundColor: "#fff",
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    borderRadius: Platform.select({ default: 6, web: 6 }),
    shadowColor: '#1f1f1f',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    paddingHorizontal: Platform.select({ default: 8, web: 8 }),
    paddingVertical: Platform.select({ default: 6, web: 6 }),
    paddingRight: Platform.select({ default: 30, web: 30 }), // ✅ UX: Отступ для кнопок справа
    fontSize: Platform.select({ default: 13, web: 14 }),
    color: DESIGN_TOKENS.colors.text,
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        // @ts-ignore
        ":focus": {
          borderColor: 'rgba(0, 0, 0, 0.2)',
          boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.05)',
          outline: "none",
        },
      },
    }),
  },
  yearInputApplied: {
    // ✅ UX: Подсветка примененного фильтра
    borderColor: DESIGN_TOKENS.colors.primary,
    backgroundColor: 'rgba(255, 159, 90, 0.05)', // Светлый фон
  },
  applyYearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    paddingVertical: 8, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    flexShrink: 0, // ✅ ИСПРАВЛЕНИЕ: Не сжимаем кнопку
    minHeight: 32, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    minWidth: 32,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: '#3a7a7a', // Темнее primary для hover
          transform: 'scale(1.05)',
        },
        whiteSpace: 'nowrap' as any, // ✅ ИСПРАВЛЕНИЕ: Текст не переносится
      },
    }),
  },
  applyYearButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  yearAppliedIndicator: {
    position: 'absolute',
    right: 28, // ✅ ИСПРАВЛЕНИЕ: Позиционируем справа от инпута, но слева от кнопки очистки
    top: '50%',
    transform: [{ translateY: -9 }], // ✅ ИСПРАВЛЕНИЕ: Центрируем по вертикали
    ...Platform.select({
      web: {
        transform: 'translateY(-50%)' as any,
      },
    }),
  },
  clearIcon: {
    position: 'absolute',
    right: 6, // ✅ ИСПРАВЛЕНИЕ: Позиционируем справа от инпута
    top: '50%',
    transform: [{ translateY: -8 }], // ✅ ИСПРАВЛЕНИЕ: Центрируем по вертикали
    padding: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transform: 'translateY(-50%)' as any,
      },
    }),
  },
  yearHint: {
    fontSize: 11,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  yearAppliedText: {
    fontSize: 11,
    color: DESIGN_TOKENS.colors.primary,
    marginTop: 4,
    fontWeight: "500",
  },

  toggleAllBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: Platform.select({ default: 8, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingVertical: Platform.select({ default: 4, web: 4 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    marginBottom: Platform.select({ default: 8, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    borderRadius: Platform.select({ default: 6, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше радиус
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        cursor: "pointer",
        // @ts-ignore
        ":hover": {
          backgroundColor: 'rgba(0, 0, 0, 0.02)', // ✅ ДИЗАЙН: Нейтральный hover
        },
      },
    }),
  },
  toggleAllText: { 
    fontSize: Platform.select({ default: 11, web: 12 }), // ✅ КОМПАКТНОСТЬ: Меньше размер шрифта
    fontWeight: "600", 
    color: DESIGN_TOKENS.colors.textMuted, // ✅ ДИЗАЙН: Нейтральный цвет вместо оранжевого
  },

  moderationBox: {
    marginBottom: Platform.select({ default: 8, web: 6 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
  },
  footer: {
    paddingHorizontal: Platform.select({ default: 12, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    paddingVertical: Platform.select({ default: 10, web: 8 }), // ✅ КОМПАКТНОСТЬ: Меньше отступы
    borderTopWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
    borderTopColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.03, // ✅ ДИЗАЙН: Более легкая тень
        shadowRadius: 2,
      },
      android: { elevation: 2 }, // ✅ ДИЗАЙН: Меньше elevation
      web: { position: "sticky" as any, bottom: 0, zIndex: 100 },
    }),
  },

  btn: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: Platform.select({ default: 12, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
      },
    }),
  },
  close: { 
    backgroundColor: "#6b7280",
    ...Platform.select({
      web: {
        ":hover": { backgroundColor: "#4b5563" },
      },
    }),
  },
  reset: { 
    backgroundColor: "#f9fafb", // ✅ ДИЗАЙН: Светлый фон
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    ...Platform.select({
      web: {
        // @ts-ignore
        ":hover": {
          backgroundColor: "#f3f4f6",
          borderColor: 'rgba(0, 0, 0, 0.1)',
        },
      },
    }),
  },
  resetTxt: { 
    color: DESIGN_TOKENS.colors.textMuted, // ✅ ДИЗАЙН: Вторичный цвет
    fontWeight: "600",
    fontSize: Platform.select({ default: 13, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
  },
  apply: { 
    backgroundColor: DESIGN_TOKENS.colors.text, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    ...Platform.select({
      web: {
        // @ts-ignore
        ":hover": { 
          backgroundColor: '#374151',
        },
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)", // ✅ ДИЗАЙН: Более легкая тень
      },
    }),
  },
  btnTxt: { 
    fontSize: 15, 
    fontWeight: "700", // ✅ ДИЗАЙН: Увеличен weight
    color: "#fff",
    letterSpacing: 0.3,
  },
});
