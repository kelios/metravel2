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
      style={[styles.checkboxRow, Platform.OS === "web" && { cursor: "pointer" }]}
      onPress={onPress}
      aria-pressed={checked}
      role="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked }}
      hitSlop={8}
    >
      <Feather 
        name={checked ? "check-square" : "square"} 
        size={20} 
        color={checked ? DESIGN_COLORS.primary : "#999"} // ✅ ДИЗАЙН: Оранжевый при активном
      />
      <Text style={[styles.itemText, checked && { color: DESIGN_COLORS.primary, fontWeight: "600" }]}>
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
        style={[styles.groupHeader, Platform.OS === "web" && { cursor: "pointer" }]}
        onPress={() => toggle(field)}
        aria-expanded={open}
        accessibilityLabel={label}
        hitSlop={6}
      >
        <Text style={styles.groupLabel}>{label}</Text>
        <Feather 
          name={open ? "chevron-up" : "chevron-down"} 
          size={18} 
          color={open ? DESIGN_COLORS.primary : DESIGN_COLORS.textSecondary} // ✅ ДИЗАЙН: Оранжевый при открытом
        />
      </Pressable>

      {open && (
        <View style={styles.itemsBox}>
          {items.map((it: any) => {
            const id = it[valKey];
            return (
              <GroupBoxItem
                key={id}
                id={id}
                title={it[labelKey]}
                checked={selectedItems.includes(id)}
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

const FiltersComponent = ({
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

  const scrollRef = useRef<ScrollView>(null);
  const yearInputRef = useRef<TextInput>(null);

  const groups = useMemo(
    () => [
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

    // приводим пустые массивы к undefined, чтобы родитель не слал пустые фильтры
    const cleanedFilterValue = Object.fromEntries(
      Object.entries(filterValue).map(([key, value]) => {
        if (Array.isArray(value) && value.length === 0) return [key, undefined];
        return [key, value];
      })
    );

    setApplying(true);
    handleApplyFilters({
      ...cleanedFilterValue,
      year: year || undefined,
    });

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

  // единый дебаунс для авто-применения (мобила)
  const debouncedApply = useMemo(() => debounce(apply, 300), [apply]);
  useEffect(() => () => debouncedApply.cancel(), [debouncedApply]);

  const toggle = useCallback((field: string) => {
    setOpen((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // чекбоксы: обновляем и авто-применяем на мобиле
  const handleCheckForField = useCallback(
    (field: string) => (id: any) => {
      const selected = filterValue[field] ?? [];
      const next = selected.includes(id) ? selected.filter((v: any) => v !== id) : [...selected, id];
      onSelectedItemsChange(field, next);
      if (isMobile) debouncedApply();
    },
    [filterValue, onSelectedItemsChange, debouncedApply, isMobile]
  );

  const handleYearChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);
      setYear(cleaned);
      if (isMobile) {
        if (cleaned.length === 4) debouncedApply();
      }
    },
    [debouncedApply, isMobile]
  );

  const handleReset = useCallback(() => {
    setYear("");
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
      if (!hidden) newState[field] = !allExpanded;
    });
    setOpen(newState);
    setAllExpanded(!allExpanded);
  }, [groups, allExpanded]);

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
              onPress={() =>
                onSelectedItemsChange("moderation", isModerationPending ? undefined : 0)
              }
              style={[styles.checkboxRow, Platform.OS === "web" && { cursor: "pointer" }]}
              aria-pressed={isModerationPending}
              role="checkbox"
              accessibilityLabel="Показать статьи на модерации"
              accessibilityState={{ checked: isModerationPending }}
              hitSlop={8}
            >
              <Feather
                name={isModerationPending ? "check-square" : "square"}
                size={20}
                color={isModerationPending ? DESIGN_COLORS.primary : "#999"} // ✅ ДИЗАЙН: Оранжевый при активном
              />
              <Text style={styles.itemText}>Показать статьи на модерации</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [isSuperuser, filterValue.moderation, onSelectedItemsChange]
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
          <Feather name={yearOpen ? "chevron-up" : "chevron-down"} size={18} color="#333" />
        </Pressable>

        {yearOpen && (
          <View style={styles.yearBox}>
            <View style={styles.yearInputWrapper}>
              <TextInput
                ref={yearInputRef}
                value={year}
                onChangeText={handleYearChange}
                placeholder="2023"
                keyboardType="numeric"
                maxLength={4}
                style={styles.yearInput}
                returnKeyType="done"
                onSubmitEditing={apply}
                accessibilityLabel="Введите год"
              />
              {year.length > 0 && (
                <Pressable onPress={() => setYear("")} style={styles.clearIcon} accessibilityLabel="Очистить год" hitSlop={8}>
                  <Feather name="x" size={16} color="#999" />
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    ),
    [yearOpen, year, handleYearChange, apply]
  );

  /* ======= Футер кнопок ======= */
  const renderFooter = useMemo(
    () => (
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 18),
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 8,
          },
        ]}
      >
        {isMobile && (
          <Pressable
            style={[styles.btn, { flex: 1 }, styles.close]}
            onPress={closeMenu}
            accessibilityLabel="Закрыть фильтры"
            hitSlop={8}
          >
            <Text style={styles.btnTxt}>Закрыть</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.btn, { flex: 1 }, styles.reset]}
          onPress={handleReset}
          accessibilityLabel="Сбросить фильтры"
          hitSlop={8}
        >
          <Text style={[styles.btnTxt, styles.resetTxt]}>Сбросить</Text>
        </Pressable>
        <Pressable
          style={[
            styles.btn,
            { flex: 1 },
            styles.apply,
            applying && { opacity: 0.7 },
            Platform.OS === "web" && {
              // @ts-ignore - web-specific CSS property
              background: `linear-gradient(135deg, ${DESIGN_COLORS.primary} 0%, ${DESIGN_COLORS.primaryDark} 100%)`,
            },
          ]}
          onPress={apply}
          disabled={applying}
          accessibilityLabel="Применить фильтры"
          hitSlop={8}
        >
          <Text style={styles.btnTxt}>{applying ? "Применяю..." : "Применить"}</Text>
        </Pressable>
      </View>
    ),
    [isMobile, insets.bottom, closeMenu, handleReset, apply, applying]
  );

  return (
    <View style={[styles.root, isMobileFullScreenMode && styles.fullScreenMobile]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS !== "web"}
      >
        <View style={styles.content}>
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
                open={open[field]}
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

// ✅ ДИЗАЙН: Централизованные цвета и константы
// ✅ ДИЗАЙН: Используем максимально легкую и воздушную палитру
import { AIRY_COLORS, AIRY_SHADOWS, AIRY_BOX_SHADOWS } from '@/constants/airyColors';

const DESIGN_COLORS = {
  primary: AIRY_COLORS.primary,
  primaryDark: AIRY_COLORS.primaryDark,
  primaryLight: AIRY_COLORS.primaryLight,
  background: AIRY_COLORS.surface,
  border: AIRY_COLORS.border,
  textPrimary: AIRY_COLORS.textPrimary,
  textSecondary: AIRY_COLORS.textSecondary,
};

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
    paddingHorizontal: Platform.select({ default: 12, web: 8 }), 
    paddingBottom: Platform.select({ default: 16, web: 12 }) 
  },
  content: { 
    paddingHorizontal: Platform.select({ default: 10, web: 6 }) 
  },

  groupBox: { 
    marginBottom: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    backgroundColor: "#ffffff", // ✅ ДИЗАЙН: Белый фон
    borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
    borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница для прозаичного дизайна
    borderColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
    ...Platform.select({
      web: {
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)", // ✅ ДИЗАЙН: Более легкая тень
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
    paddingVertical: Platform.select({ default: 12, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    paddingHorizontal: Platform.select({ default: 12, web: 16 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
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
    fontSize: Platform.select({ default: 15, web: 16 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    fontWeight: "600", // ✅ ДИЗАЙН: Уменьшен weight для прозаичности
    color: DESIGN_COLORS.textPrimary, // ✅ ДИЗАЙН: Единый цвет
    letterSpacing: -0.1, // ✅ ДИЗАЙН: Меньше отрицательный letter-spacing
  },

  itemsBox: { 
    paddingHorizontal: Platform.select({ default: 12, web: 16 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    paddingBottom: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({ default: 8, web: 10 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    paddingHorizontal: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    gap: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше gap на мобильных
    borderRadius: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
    marginBottom: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше отступ на мобильных
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
    fontSize: Platform.select({ default: 13, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    color: DESIGN_COLORS.textPrimary, // ✅ ДИЗАЙН: Единый цвет
    flex: 1,
    fontWeight: "500",
    lineHeight: Platform.select({ default: 18, web: 20 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
  },

  yearBox: { 
    paddingHorizontal: Platform.select({ default: 10, web: 12 }), 
    paddingBottom: Platform.select({ default: 6, web: 8 }) 
  },
  yearInputWrapper: { position: "relative" },
  yearInput: {
    backgroundColor: "#fff",
    borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
    borderColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
    borderRadius: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
    paddingHorizontal: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    paddingVertical: Platform.select({ default: 8, web: 10 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    fontSize: Platform.select({ default: 14, web: 15 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    color: DESIGN_COLORS.textPrimary, // ✅ ДИЗАЙН: Единый цвет
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        // @ts-ignore
        ":focus": {
          borderColor: 'rgba(0, 0, 0, 0.2)', // ✅ ДИЗАЙН: Нейтральный focus
          boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.05)',
          outline: "none",
        },
      },
    }),
  },
  clearIcon: {
    position: "absolute",
    right: 8,
    top: "50%",
    marginTop: -8,
    padding: 4,
  },

  toggleAllBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    paddingVertical: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    marginBottom: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    borderRadius: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
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
    fontSize: Platform.select({ default: 12, web: 13 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    fontWeight: "600", 
    color: DESIGN_COLORS.textSecondary, // ✅ ДИЗАЙН: Нейтральный цвет вместо оранжевого
  },

  footer: {
    paddingHorizontal: Platform.select({ default: 12, web: 10 }), // ✅ АДАПТИВНОСТЬ: Больше на мобильных
    paddingVertical: Platform.select({ default: 12, web: 10 }), // ✅ АДАПТИВНОСТЬ: Больше на мобильных
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
    borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
    borderColor: 'rgba(0, 0, 0, 0.06)', // ✅ ДИЗАЙН: Более светлая граница
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
    color: DESIGN_COLORS.textSecondary, // ✅ ДИЗАЙН: Вторичный цвет
    fontWeight: "600",
    fontSize: Platform.select({ default: 13, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
  },
  apply: { 
    backgroundColor: DESIGN_COLORS.text, // ✅ ДИЗАЙН: Нейтральный серый вместо яркого оранжевого
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
