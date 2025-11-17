// components/travel/CompactSideBarTravel.tsx
import React, { memo, Suspense, useCallback, useMemo, useState } from "react";
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
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import type { Travel } from "@/src/types/types";
import { buildTravelSectionLinks, type TravelSectionLink } from "@/components/travel/sectionLinks";
import WeatherWidget from "@/components/WeatherWidget";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="small" color="#6B4F4F" />
  </View>
);

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
          const parts = String(addr.categoryName).split(',').map(s => s.trim()).filter(Boolean);
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={[
          styles.menu,
          { width: isMobile ? "100%" : isTablet ? 220 : 260 }, // ✅ РЕДИЗАЙН: Уменьшена ширина для компактности
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
                  <Feather name="eye" size={12} color="#ff9f5a" /> {/* Уменьшено с 16 */}
                  <Text style={styles.viewsTxt}>
                    {new Intl.NumberFormat("ru-RU").format(viewsSafe)}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              {(titleLine || canEdit) && (
                <View style={styles.userRow}>
                  {titleLine ? (
                    <Text style={styles.userName} numberOfLines={1}>
                      {titleLine}
                    </Text>
                  ) : (
                    <View />
                  )}
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
                </View>
              )}

              {/* ✅ РЕДИЗАЙН: Компактная ключевая информация */}
              {whenLine && (
                <View style={styles.keyInfoRow}>
                  <MaterialIcons name="calendar-today" size={14} color="#ff9f5a" /> {/* Уменьшено с 16 */}
                  <Text style={styles.userYear}>{whenLine}</Text>
                </View>
              )}

              {daysText && (
                <View style={styles.keyInfoRow}>
                  <MaterialIcons name="schedule" size={14} color="#ff9f5a" /> {/* Уменьшено с 16 */}
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
                <MaterialIcons name="category" size={14} color="#ff9f5a" /> {/* Уменьшено с 18 */}
                <View style={[styles.categoriesWrap, { marginLeft: 6, flex: 1 }]}> {/* Уменьшено с 8 */}
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
                <MaterialIcons name="place" size={14} color="#ff9f5a" />
                <Text style={[styles.infoText, { marginLeft: 6, flex: 1 }]} numberOfLines={1}>
                  {firstCoord}
                </Text>
                {Platform.OS === "web" && (
                  <MaterialIcons name="content-copy" size={12} color="#9ca3af" style={{ marginLeft: 6 }} />
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
                <MaterialIcons
                  name={icon as any}
                  size={isTablet ? 20 : 18} // ✅ РЕДИЗАЙН: Уменьшены размеры иконок
                  color={currentActive === key ? "#ff9f5a" : "#2F332E"}
                />
                <Text style={[
                  styles.linkTxt, 
                  isTablet && { fontSize: 13 }, // Уменьшено с 15
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
    paddingTop: 12, // Уменьшено с 16
    alignSelf: "center", 
    paddingHorizontal: 12, // Уменьшено с 16
    maxWidth: 300, // Уменьшено с 320
  },

  // ✅ РЕДИЗАЙН: Компактная карточка автора
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14, // Уменьшено с 20
    marginBottom: 16, // Уменьшено с 24
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", // Изменено с center для лучшего выравнивания
    marginBottom: 10, // Уменьшено с 12
  },
  avatarWrap: { 
    marginRight: 10, // Уменьшено с 14
    alignItems: "center",
  },
  // ✅ РЕДИЗАЙН: Компактная аватарка
  avatar: { 
    width: 56, // Уменьшено с 72
    height: 56, 
    borderRadius: 28, 
    borderWidth: 2, // Уменьшено с 3
    borderColor: "#ffe4d0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  // ✅ РЕДИЗАЙН: Компактное отображение просмотров
  viewsRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 6, // Уменьшено с 10
    paddingHorizontal: 8, // Уменьшено с 10
    paddingVertical: 4, // Уменьшено с 6
    backgroundColor: "#fff5eb",
    borderRadius: 8, // Уменьшено с 12
    borderWidth: 1,
    borderColor: "#ffe4d0",
  },
  viewsTxt: { 
    marginLeft: 4, // Уменьшено с 6
    fontSize: 11, // Уменьшено с 13
    color: "#ff9f5a",
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
    paddingVertical: 8, // Уменьшено с 10
    paddingHorizontal: 10, // Уменьшено с 12
    marginBottom: 8, // Уменьшено с 10
    backgroundColor: "#f9fafb",
    borderRadius: 10, // Уменьшено с 12
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoText: {
    fontSize: 13, // Уменьшено с 14
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
    fontSize: 10, // Уменьшено с 11
    color: "#ff9f5a",
    backgroundColor: "#fff5eb",
    paddingHorizontal: 8, // Уменьшено с 10
    paddingVertical: 4, // Уменьшено с 5
    borderRadius: 8, // Уменьшено с 10
    fontFamily: "Georgia",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#ffe4d0",
    maxWidth: 90, // Уменьшено с 100
  },
  categoryMore: {
    fontSize: 10, // Уменьшено с 11
    color: "#9ca3af",
    fontFamily: "Georgia",
    fontWeight: "500",
    marginLeft: 3, // Уменьшено с 4
  },

  userRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginBottom: 6, // Уменьшено с 8
  },
  userName: { 
    fontSize: 14, // Уменьшено с 16
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
    paddingVertical: 2, // Уменьшено с 4
  },
  userYear: { 
    fontSize: 13, // Уменьшено с 15
    fontWeight: "600", 
    color: "#1f2937", 
    fontFamily: "Georgia",
    lineHeight: 16,
  },
  userDays: { 
    fontSize: 12, // Уменьшено с 14
    fontWeight: "600",
    color: "#374151", 
    fontFamily: "Georgia",
    lineHeight: 15,
  },

  // ✅ РЕДИЗАЙН: Компактные пункты меню
  link: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10, // Уменьшено с 14
    paddingHorizontal: 12, // Уменьшено с 16
    borderRadius: 10, // Уменьшено с 14
    marginBottom: 4, // Уменьшено с 6
    ...Platform.select({
      web: {
        transition: "all 0.2s ease" as any,
      },
      default: {},
    }),
  },
  linkPressed: { backgroundColor: "#f0f9f9", transform: [{ scale: 0.98 }] },
  linkActive: { 
    backgroundColor: "#fff5eb", // Изменено на оранжевый оттенок
    borderLeftWidth: 3, // Уменьшено с 4
    borderLeftColor: "#ff9f5a", // Изменено на оранжевый
    shadowColor: "#ff9f5a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  linkTxt: { 
    marginLeft: 10, // Уменьшено с 14
    fontSize: 13, // Уменьшено с 15
    fontFamily: "Georgia", 
    color: "#2F332E",
    fontWeight: "600",
    lineHeight: 18,
  },
  linkTxtActive: {
    color: "#ff9f5a",
    fontWeight: "700",
  },
  linkDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 8, // Уменьшено с 12
    marginHorizontal: 12, // Уменьшено с 16
  },

  allTravels: {
    marginTop: 20,
    fontSize: 14,
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
    paddingVertical: 16,
    alignItems: "center",
  },
  closeBtn: { flexDirection: "row", alignItems: "center" },
  closeBtnPressed: { opacity: 0.7 },
  closeTxt: { color: "#fff", fontSize: 16, fontFamily: "Georgia", marginLeft: 8 },

  fallback: { paddingVertical: 40, alignItems: "center" },
});
