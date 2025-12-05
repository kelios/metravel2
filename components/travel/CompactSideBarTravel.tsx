// components/travel/CompactSideBarTravel.tsx
import React, { memo, Suspense, useCallback, useMemo, useState, lazy } from "react";
import {
  View,
  StyleSheet,
  Linking,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  DeviceEventEmitter,
  Alert,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import type { Travel } from "@/src/types/types";
import { buildTravelSectionLinks, type TravelSectionLink } from "@/components/travel/sectionLinks";
import WeatherWidget from "@/components/WeatherWidget";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";
import type { BookSettings } from "@/components/export/BookSettingsModal";
import { useSingleTravelExport } from "@/components/travel/hooks/useSingleTravelExport";
import { DESIGN_TOKENS } from '@/constants/designSystem';

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="small" color="#6B4F4F" />
  </View>
);

const BookSettingsModalLazy = lazy(() => import("@/components/export/BookSettingsModal"));

const openUrl = (url: string) => {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url);
  }
};

// универсальный эмиттер "открой секцию"
const emitOpenSection = (key: string) => {
  if (Platform.OS === "web") {
    // @ts-ignore
    window.dispatchEvent(new CustomEvent("open-section", { detail: { key } }));
  } else {
    DeviceEventEmitter.emit("open-section", key);
  }
};

type SideBarProps = {
  refs: Record<string, React.RefObject<View>>;
  travel: Travel;
  isMobile: boolean;
  onNavigate: (key: keyof SideBarProps["refs"]) => void;
  closeMenu: () => void;
  isSuperuser: boolean;
  storedUserId?: string | null;
  activeSection?: string; // ✅ УЛУЧШЕНИЕ: Активная секция при скролле
  links?: TravelSectionLink[];
};

function CompactSideBarTravel({
                                refs,
                                travel,
                                isMobile,
                                onNavigate,
                                closeMenu,
                                isSuperuser,
                                storedUserId,
                                activeSection: externalActiveSection, // ✅ УЛУЧШЕНИЕ: Внешняя активная секция
                                links,
}: SideBarProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768 && width < 1024;
  const [active, setActive] = useState<string>("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const {
    pdfExport,
    lastSettings,
    settingsSummary,
    handleOpenPrintBookWithSettings,
  } = useSingleTravelExport(travel);

  // ✅ УЛУЧШЕНИЕ: Используем внешнюю активную секцию, если она передана, иначе локальную
  const currentActive = externalActiveSection !== undefined ? externalActiveSection : active;

  const setActiveNavigateAndOpen = useCallback(
    (key: keyof typeof refs) => {
      const k = String(key);
      setActive(k);
      onNavigate(key); // скролл
      emitOpenSection(k); // раскрыть секцию
      if (isMobile) closeMenu();
    },
    [onNavigate, isMobile, closeMenu]
  );

  // Надёжная проверка права редактирования (типы могут отличаться)
  const canEdit = useMemo(() => {
    const a = String(storedUserId ?? "");
    const b = String((travel as any).userIds ?? (travel as any).userId ?? "");
    return !!(isSuperuser || (a && b && a === b));
  }, [isSuperuser, storedUserId, travel]);

  // ── Безопасные текстовые поля (ничего "null"/"undefined" не рендерим) ──
  const userName = (travel as any).userName || "";
  const countryName = (travel as any).countryName || "";
  const monthName = (travel as any).monthName || ""; // напр. "Май"
  const yearStr =
    travel && (travel as any).year != null ? String((travel as any).year) : "";
  const numberDays =
    travel && (travel as any).number_days != null
      ? Number((travel as any).number_days)
      : null;
  const daysText =
    numberDays != null && Number.isFinite(numberDays)
      ? `• ${numberDays} дн.`
      : "";

  const titleLine = [userName, countryName].filter(Boolean).join(" | ");
  const whenLine = [monthName, yearStr].filter(Boolean).join(" ");

  const viewsSafe =
    (travel as any).countUnicIpView != null
      ? Number((travel as any).countUnicIpView)
      : null;

  // ✅ УЛУЧШЕНИЕ: Оптимизация URL аватара
  const avatarUri = useMemo(() => {
    const rawUri = (travel as any).travel_image_thumb_small_url;
    if (!rawUri) return "";
    
    const versionedUrl = buildVersionedImageUrl(
      rawUri,
      (travel as any).updated_at,
      travel.id
    );
    
    // Оптимальный размер для аватара (72x72)
    const avatarSize = 72;
    const optimalSize = getOptimalImageSize(avatarSize, avatarSize);
    
    return optimizeImageUrl(versionedUrl, {
      width: optimalSize.width,
      height: optimalSize.height,
      format: 'webp',
      quality: 85,
      fit: 'cover',
    }) || versionedUrl;
  }, [(travel as any).travel_image_thumb_small_url, (travel as any).updated_at, travel.id]);

  // Извлекаем координаты из travelAddress
  const firstCoord = useMemo(() => {
    if (travel.travelAddress && Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0) {
      const first = travel.travelAddress[0] as any;
      return first?.coord || first?.coordsMeTravel?.[0] || null;
    }
    return null;
  }, [travel.travelAddress]);

  // Извлекаем категории
  const categories = useMemo(() => {
    if (travel.travelAddress && Array.isArray(travel.travelAddress)) {
      const cats = new Set<string>();
      travel.travelAddress.forEach((addr: any) => {
        if (addr?.categoryName) {
          // ✅ ИСПРАВЛЕНИЕ: Обрабатываем случай, когда categoryName может быть объектом с {id, name}
          let categoryNameStr: string;
          if (typeof addr.categoryName === 'string') {
            categoryNameStr = addr.categoryName;
          } else if (addr.categoryName && typeof addr.categoryName === 'object' && 'name' in addr.categoryName) {
            categoryNameStr = String(addr.categoryName.name || '');
          } else {
            categoryNameStr = String(addr.categoryName || '');
          }
          
          const parts = categoryNameStr.split(',').map(s => s.trim()).filter(Boolean);
          parts.forEach(cat => cats.add(cat));
        }
      });
      return Array.from(cats);
    }
    return [];
  }, [travel.travelAddress]);

  // ✅ УЛУЧШЕНИЕ: Группировка пунктов меню по категориям
  const navLinks = useMemo(
    () => (Array.isArray(links) && links.length ? links : buildTravelSectionLinks(travel)),
    [links, travel],
  );

  const handleUserTravels = () =>
    openUrl(`/?user_id=${(travel as any).userIds ?? (travel as any).userId}`);
  const handleEdit = () => canEdit && openUrl(`/travel/${travel.id}`);

  const handleOpenExport = useCallback(() => {
    if (Platform.OS !== 'web') {
      Alert.alert?.('Недоступно', 'Экспорт PDF доступен только в веб-версии');
      return;
    }
    setShowSettingsModal(true);
  }, []);

  const handleSaveSettings = useCallback(
    async (settings: BookSettings) => {
      // "Сохранить PDF" переводим на новый HTML-поток печати (книга в новой вкладке + печать браузера)
      await handleOpenPrintBookWithSettings(settings);
      setShowSettingsModal(false);
    },
    [handleOpenPrintBookWithSettings]
  );

  const handlePreviewSettings = useCallback(
    async (settings: BookSettings) => {
      // Превью так же идёт через HTML-книгу
      await handleOpenPrintBookWithSettings(settings);
      setShowSettingsModal(false);
    },
    [handleOpenPrintBookWithSettings]
  );
  
  return (
    <View style={styles.root}>
        <ScrollView
        style={[
          styles.menu,
          { 
            width: Platform.OS === 'web' 
              ? (isTablet ? 320 : 380) // ✅ UX: Увеличено для полного устранения скролла
              : '100%', // Мобильные - полная ширина
          },
        ]}
        contentContainerStyle={{ paddingBottom: isMobile ? 80 : 32 }}
      >
        {/* ✅ РЕДИЗАЙН: Компактная карточка автора */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <ExpoImage
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="low"
                  transition={200}
                  placeholder={require("@/assets/placeholder.webp")}
                  // ✅ УЛУЧШЕНИЕ: Lazy loading для web
                  {...(Platform.OS === "web"
                    ? ({ loading: "lazy" } as any)
                    : {})}
                />
              ) : (
                <MaterialIcons name="image" size={60} color="#ccc" />
              )}
              {/* ✅ РЕДИЗАЙН: Компактное отображение просмотров */}
              {viewsSafe != null && Number.isFinite(viewsSafe) && (
                <View style={styles.viewsRow}>
                  {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
                  <Feather name="eye" size={12} color="#6b7280" />
                  <Text style={styles.viewsTxt}>
                    {new Intl.NumberFormat("ru-RU").format(viewsSafe)}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.userRow}>
                {titleLine ? (
                  <Text style={styles.userName} numberOfLines={1}>
                    {titleLine}
                  </Text>
                ) : (
                  <View />
                )}
                <View style={styles.actionsRow}>
                  {canEdit && (
                    <Pressable
                      onPress={handleEdit}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Редактировать путешествие"
                    >
                      <MaterialIcons name="edit" size={18} color="#2F332E" />
                    </Pressable>
                  )}
                  {Platform.OS === 'web' && (
                    <Pressable
                      onPress={handleOpenExport}
                      hitSlop={6}
                      disabled={pdfExport.isGenerating}
                      accessibilityRole="button"
                      accessibilityLabel="Экспорт в PDF"
                    >
                      {pdfExport.isGenerating ? (
                        <ActivityIndicator size="small" color="#b83a3a" />
                      ) : (
                        <MaterialIcons
                          name="picture-as-pdf"
                          size={18}
                          color="#b83a3a"
                        />
                      )}
                    </Pressable>
                  )}
                </View>
              </View>

              {/* ✅ РЕДИЗАЙН: Компактная ключевая информация */}
              {whenLine && (
                <View style={styles.keyInfoRow}>
                  {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
                  <MaterialIcons name="calendar-today" size={14} color="#6b7280" />
                  <Text style={styles.userYear}>{whenLine}</Text>
                </View>
              )}

              {daysText && (
                <View style={styles.keyInfoRow}>
                  {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
                  <MaterialIcons name="schedule" size={14} color="#6b7280" />
                  <Text style={styles.userDays}>{daysText}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Ключевая информация */}
          <View style={styles.infoSection}>
            {/* ✅ РЕДИЗАЙН: Компактная информация - убираем лишние элементы для максимальной компактности */}
            {categories.length > 0 && (
              <View style={styles.infoRow}>
                {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
                <MaterialIcons name="category" size={14} color="#6b7280" />
                <View style={[styles.categoriesWrap, { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1 }]}>
                  {categories.slice(0, 2).map((cat, idx) => (
                    <View key={idx} style={styles.categoryTagWrapper}>
                      <Text style={styles.categoryTag} numberOfLines={1}>
                        {cat}
                      </Text>
                    </View>
                  ))}
                  {categories.length > 2 && (
                    <Text style={styles.categoryMore}>+{categories.length - 2}</Text>
                  )}
                </View>
              </View>
            )}
            
            {/* Координаты и город показываем только если нет категорий или если места достаточно */}
            {!categories.length && firstCoord && (
              <Pressable
                style={styles.infoRow}
                onPress={() => {
                  if (Platform.OS === "web") {
                    navigator.clipboard?.writeText(firstCoord).then(() => {
                      alert("Координаты скопированы!");
                    });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Координаты"
              >
                {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
                <MaterialIcons name="place" size={14} color="#6b7280" />
                <Text style={[styles.infoText, { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1 }]} numberOfLines={1}>
                  {firstCoord}
                </Text>
                {Platform.OS === "web" && (
                  <MaterialIcons name="content-copy" size={12} color="#9ca3af" style={{ marginLeft: DESIGN_TOKENS.spacing.xs }} />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* ✅ УЛУЧШЕНИЕ: Группировка пунктов меню с разделителями */}
        {navLinks.map(({ key, icon, label }, index) => {
          // Определяем, нужно ли добавить разделитель перед пунктом
          const shouldAddDivider = 
            (index > 0 && 
             // Разделитель между галереей/видео/описанием и рекомендациями/плюсами/минусами
             ((key === "recommendation" || key === "plus") && 
              navLinks[index - 1]?.key !== "description" && 
              navLinks[index - 1]?.key !== "recommendation")) ||
            // Разделитель перед навигацией (карта, координаты)
            (key === "map" && index > 0) ||
            // Разделитель перед "Популярное"
            (key === "popular" && index > 0);

          return (
            <React.Fragment key={key}>
              {shouldAddDivider && <View style={styles.linkDivider} />}
              <Pressable
                style={({ pressed }) => [
                  styles.link,
                  currentActive === key && styles.linkActive, // ✅ Используем currentActive
                  pressed && styles.linkPressed,
                ]}
                onPress={() => setActiveNavigateAndOpen(key as keyof typeof refs)}
                android_ripple={{ color: "#E7DAC6" }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: currentActive === key }}
              >
                {/* ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый для активного */}
                <MaterialIcons
                  name={icon as any}
                  size={Platform.select({
                    default: 18, // Мобильные
                    web: isTablet ? 20 : 18, // Планшеты и десктоп
                  })}
                  color={currentActive === key ? "#1f2937" : "#2F332E"}
                />
                <Text style={[
                  styles.linkTxt, 
                  isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm }, // Уменьшено с 15
                  currentActive === key && styles.linkTxtActive,
                ]}>
                  {label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}

        {userName ? (
          <Pressable
            onPress={handleUserTravels}
            accessibilityRole="link"
            accessibilityLabel={`Путешествия автора ${userName}`}
          >
            <Text style={styles.allTravels}>Путешествия {userName}</Text>
          </Pressable>
        ) : null}

        <Suspense fallback={<Fallback />}>
          <WeatherWidget points={travel.travelAddress as any} />
        </Suspense>
      </ScrollView>

      {Platform.OS === "web" && (
        <Suspense fallback={<Fallback />}>
          <BookSettingsModalLazy
            visible={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onSave={handleSaveSettings}
            onPreview={handlePreviewSettings}
            defaultSettings={lastSettings}
            travelCount={1}
            userName={travel.userName || undefined}
            mode="preview"
          />
        </Suspense>
      )}

      {isMobile && (
        <View style={styles.closeBar}>
          <Pressable
            onPress={closeMenu}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closeBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
          >
            <MaterialIcons name="close" size={20} color="#fff" />
            <Text style={styles.closeTxt}>Закрыть</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default memo(CompactSideBarTravel);

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: "#fff",
    ...(Platform.OS === "web" ? { 
      height: "100vh" as any,
      position: "fixed" as any,
      overflowY: "auto" as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Компактное меню с уменьшенными отступами
  menu: { 
    paddingTop: Platform.select({
      ios: 10,
      android: 10,
      web: 12,
    }),
    alignSelf: "center", 
    paddingHorizontal: Platform.select({
      ios: 10,
      android: 10,
      web: 12,
    }),
    ...(Platform.OS === 'web' ? { maxWidth: 400, overflowX: 'hidden' as any } : {}), // ✅ UX: Увеличено + overflow hidden
  },

  // ✅ РЕДИЗАЙН: Компактная карточка автора
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: Platform.select({
      default: 12, // Мобильные
      web: 14, // Десктоп
    }),
    marginBottom: Platform.select({
      default: 12, // Мобильные
      web: 16, // Десктоп
    }),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 4,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 4
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  cardRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", // Изменено с center для лучшего выравнивания
    marginBottom: DESIGN_TOKENS.spacing.sm, // Уменьшено с 12
  },
  avatarWrap: { 
    marginRight: DESIGN_TOKENS.spacing.sm, // Уменьшено с 14
    alignItems: "center",
  },
  // ✅ РЕДИЗАЙН: Компактная аватарка
  avatar: { 
    width: Platform.select({
      default: 52, // Мобильные
      web: 56, // Десктоп
    }),
    height: Platform.select({
      default: 52, // Мобильные
      web: 56, // Десктоп
    }),
    borderRadius: Platform.select({
      default: 26, // Мобильные
      web: 28, // Десктоп
    }),
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 2,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
  },
  // ✅ РЕДИЗАЙН: Компактное отображение просмотров
  viewsRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп
    }),
    paddingVertical: Platform.select({
      default: 3, // Мобильные
      web: 4, // Десктоп
    }),
    backgroundColor: "rgba(0, 0, 0, 0.02)", // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    borderRadius: 8,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  viewsTxt: { 
    marginLeft: 4,
    fontSize: Platform.select({
      default: 10, // Мобильные
      web: 11, // Десктоп
    }),
    color: "#6b7280", // ✅ УЛУЧШЕНИЕ: Нейтральный серый
    fontFamily: "Georgia", 
    fontWeight: "700",
  },
  
  infoSection: {
    marginTop: 12, // Уменьшено с 16
    paddingTop: 12, // Уменьшено с 16
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  // ✅ РЕДИЗАЙН: Компактные информационные строки
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп
    }),
    paddingHorizontal: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп
    }),
    marginBottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    borderRadius: 10,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  infoText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm, // Уменьшено с 14
    color: "#374151",
    fontFamily: "Georgia",
    fontWeight: "500",
  },
  categoriesWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  // ✅ РЕДИЗАЙН: Компактные категории
  categoryTagWrapper: {
    marginRight: 4, // Уменьшено с 6
    marginBottom: 3, // Уменьшено с 4
  },
  categoryTag: {
    fontSize: Platform.select({
      default: 9, // Мобильные
      web: 10, // Десктоп
    }),
    color: "#6b7280", // ✅ УЛУЧШЕНИЕ: Нейтральный серый
    backgroundColor: "rgba(0, 0, 0, 0.02)", // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    paddingHorizontal: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп
    }),
    paddingVertical: Platform.select({
      default: 3, // Мобильные
      web: 4, // Десктоп
    }),
    borderRadius: 8,
    fontFamily: "Georgia",
    fontWeight: "600",
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
    maxWidth: 90,
  },
  categoryMore: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs, // Уменьшено с 11
    color: "#9ca3af",
    fontFamily: "Georgia",
    fontWeight: "500",
    marginLeft: 3, // Уменьшено с 4
  },

  userRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginBottom: DESIGN_TOKENS.spacing.xs, // Уменьшено с 8
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  userName: { 
    fontSize: DESIGN_TOKENS.typography.sizes.sm, // Уменьшено с 16
    fontWeight: "700", 
    color: "#1f2937", 
    fontFamily: "Georgia", 
    flexShrink: 1,
    lineHeight: 18, // Добавлено для компактности
  },
  // ✅ РЕДИЗАЙН: Компактная ключевая информация
  keyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5, // Уменьшено с 6
    marginTop: 4, // Уменьшено с 6
    paddingVertical: DESIGN_TOKENS.spacing.xxs, // Уменьшено с 4
  },
  userYear: { 
    fontSize: DESIGN_TOKENS.typography.sizes.sm, // Уменьшено с 15
    fontWeight: "600", 
    color: "#1f2937", 
    fontFamily: "Georgia",
    lineHeight: 16,
  },
  userDays: { 
    fontSize: DESIGN_TOKENS.typography.sizes.xs, // Уменьшено с 14
    fontWeight: "600",
    color: "#374151", 
    fontFamily: "Georgia",
    lineHeight: 15,
  },
  exportSummary: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: "#6b7280",
    marginTop: 4,
  },

  // ✅ РЕДИЗАЙН: Компактные пункты меню
  link: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп
    }),
    paddingHorizontal: Platform.select({
      default: 10, // Мобильные
      web: 12, // Десктоп
    }),
    borderRadius: 10,
    marginBottom: 4,
    ...Platform.select({
      web: {
        transition: "all 0.2s ease" as any,
      },
      default: {},
    }),
  },
  linkPressed: { backgroundColor: "rgba(0, 0, 0, 0.02)", transform: [{ scale: 0.98 }] },
  linkActive: { 
    backgroundColor: "rgba(0, 0, 0, 0.04)", // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    borderLeftWidth: 2, // ✅ УЛУЧШЕНИЕ: Уменьшено с 3
    borderLeftColor: "#1f2937", // ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 2,
    elevation: 1,
  },
  linkTxt: { 
    marginLeft: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп
    }),
    fontSize: Platform.select({
      default: 12, // Мобильные
      web: 13, // Десктоп
    }),
    fontFamily: "Georgia", 
    color: "#2F332E",
    fontWeight: "600",
    lineHeight: 18,
  },
  linkTxtActive: {
    color: "#1f2937", // ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый
    fontWeight: "700",
  },
  linkDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 8, // Уменьшено с 12
    marginHorizontal: 12, // Уменьшено с 16
  },

  allTravels: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    textAlign: "center",
    fontWeight: "500",
    color: "#B87034",
    fontFamily: "Georgia",
  },

  closeBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2F332E",
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    alignItems: "center",
  },
  closeBtn: { flexDirection: "row", alignItems: "center" },
  closeBtnPressed: { opacity: 0.7 },
  closeTxt: { color: "#fff", fontSize: DESIGN_TOKENS.typography.sizes.md, fontFamily: "Georgia", marginLeft: 8 },

  fallback: { paddingVertical: 40, alignItems: "center" },
});
