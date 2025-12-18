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
import { MaterialIcons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
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

  const authorUserId = useMemo(() => {
    const ownerId = (travel as any).userIds ?? (travel as any).userId ?? (travel as any).user?.id ?? null;
    if (ownerId == null) return null;
    const v = String(ownerId).trim();
    return v ? v : null;
  }, [travel]);

  const handleOpenAuthorProfile = useCallback(() => {
    if (!authorUserId) return;
    openUrl(`/user/${authorUserId}`);
  }, [authorUserId]);

  // ✅ УЛУЧШЕНИЕ: Оптимизация URL аватара
  const avatarUri = useMemo(() => {
    const rawUri = (travel as any).user?.avatar;
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
  }, [(travel as any).user?.avatar, (travel as any).updated_at, travel.id]);

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
              ? (isMobile ? '100%' : isTablet ? 260 : 280)
              : '100%', // Native-платформы — полная ширина
          },
        ]}
        contentContainerStyle={{ 
          paddingBottom: isMobile ? 80 : 32,
          paddingLeft: Platform.OS === 'web' ? 16 : 10, // ✅ UX: Отступ слева
          paddingRight: Platform.OS === 'web' ? 8 : 10, // ✅ UX: Меньший отступ справа
        }}
        showsHorizontalScrollIndicator={false}
      >
        {[
          isMobile ? (
            <View key="close-top" style={styles.closeTopBar}>
              <Pressable
                onPress={closeMenu}
                style={({ pressed }) => [styles.closeTopBtn, pressed && styles.closeTopBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Закрыть меню"
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color="#111827" />
              </Pressable>
            </View>
          ) : null,

          <View key="author-card" style={styles.card}>
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
                    {...(Platform.OS === "web" ? ({ loading: "lazy" } as any) : {})}
                  />
                ) : (
                  <MaterialIcons name="image" size={60} color="#ccc" />
                )}
                {viewsSafe != null && Number.isFinite(viewsSafe) && (
                  <View style={styles.viewsRow}>
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
                    <Pressable
                      onPress={handleOpenAuthorProfile}
                      disabled={!authorUserId}
                      accessibilityRole={authorUserId ? 'button' : undefined}
                      accessibilityLabel={
                        authorUserId
                          ? `Открыть профиль автора ${userName || 'Пользователь'}`
                          : undefined
                      }
                      style={({ pressed }) => [
                        styles.userNameWrap,
                        pressed && authorUserId ? { opacity: 0.9 } : null,
                      ]}
                      {...Platform.select({ web: authorUserId ? { cursor: 'pointer' } : {} })}
                    >
                      <Text style={styles.userName} numberOfLines={1}>
                        {titleLine}
                      </Text>
                    </Pressable>
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
                        style={({ pressed }) => [
                          styles.actionBtn,
                          pressed && styles.actionBtnPressed,
                        ]}
                      >
                        <MaterialIcons name="edit" size={18} color="#2F332E" />
                      </Pressable>
                    )}

                    {Platform.OS === 'web' && (
                      <Pressable
                        onPress={handleOpenExport}
                        hitSlop={8}
                        disabled={pdfExport.isGenerating}
                        accessibilityRole="button"
                        accessibilityLabel="Экспорт в PDF"
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.actionBtnPdf,
                          pressed && !pdfExport.isGenerating ? styles.actionBtnPressed : null,
                          pdfExport.isGenerating ? styles.actionBtnDisabled : null,
                        ]}
                      >
                        {pdfExport.isGenerating ? (
                          <ActivityIndicator size="small" color="#b83a3a" />
                        ) : (
                          <MaterialCommunityIcons name="file-pdf-box" size={18} color="#b83a3a" />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>

                {whenLine ? (
                  <View style={styles.keyInfoRow}>
                    <MaterialIcons name="calendar-today" size={14} color="#6b7280" />
                    <Text style={styles.userYear}>{whenLine}</Text>
                  </View>
                ) : null}

                {daysText ? (
                  <View style={styles.keyInfoRow}>
                    <MaterialIcons name="schedule" size={14} color="#6b7280" />
                    <Text style={styles.userDays}>{daysText}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.infoSection}>
              {categories.length > 0 ? (
                <View style={styles.infoRow}>
                  <MaterialIcons name="category" size={14} color="#6b7280" />
                  <View
                    style={[
                      styles.categoriesWrap,
                      { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1 },
                    ]}
                  >
                    {categories.slice(0, 2).map((cat, idx) => (
                      <View key={idx} style={styles.categoryTagWrapper}>
                        <Text style={styles.categoryTag} numberOfLines={1}>
                          {cat}
                        </Text>
                      </View>
                    ))}
                    {categories.length > 2 ? (
                      <Text style={styles.categoryMore}>+{categories.length - 2}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {!categories.length && firstCoord ? (
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
                  <MaterialIcons name="place" size={14} color="#6b7280" />
                  <Text
                    style={[
                      styles.infoText,
                      { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {firstCoord}
                  </Text>
                  {Platform.OS === "web" ? (
                    <MaterialIcons
                      name="content-copy"
                      size={12}
                      color="#9ca3af"
                      style={{ marginLeft: DESIGN_TOKENS.spacing.xs }}
                    />
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          </View>,

          ...navLinks.map(({ key, icon, label }, index) => {
            const shouldAddDivider =
              (index > 0 &&
                ((key === "recommendation" || key === "plus") &&
                  navLinks[index - 1]?.key !== "description" &&
                  navLinks[index - 1]?.key !== "recommendation")) ||
              (key === "map" && index > 0) ||
              (key === "popular" && index > 0);

            return (
              <React.Fragment key={key}>
                {shouldAddDivider ? <View style={styles.linkDivider} /> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.link,
                    currentActive === key && styles.linkActive,
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
                    size={Platform.select({
                      default: 18,
                      web: isTablet ? 20 : 18,
                    })}
                    color={currentActive === key ? "#1f2937" : "#2F332E"}
                  />
                  <Text
                    style={[
                      styles.linkTxt,
                      isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
                      currentActive === key && styles.linkTxtActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              </React.Fragment>
            );
          }),

          userName ? (
            <Pressable
              key="all-travels"
              onPress={handleUserTravels}
              accessibilityRole="link"
              accessibilityLabel={`Путешествия автора ${userName}`}
            >
              <Text style={styles.allTravels}>Путешествия {userName}</Text>
            </Pressable>
          ) : null,

          <Suspense key="weather" fallback={<Fallback />}>
            <WeatherWidget points={travel.travelAddress as any} />
          </Suspense>,
        ]}
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
      // На web прокрутка должна быть общей для страницы,
      // поэтому убираем собственный scroll/100vh/position: fixed
      position: "relative" as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Компактное меню с уменьшенными отступами
  menu: { 
    paddingTop: Platform.select({
      ios: 10,
      android: 10,
      web: 12,
    }),
    alignSelf: "flex-start", // ✅ UX: Прижато к левому краю
    ...(Platform.OS === 'web' ? { 
      maxWidth: 400, 
      overflowX: 'hidden' as any,
      width: '100%',
    } : {}), // ✅ UX: Прижато к левому краю
  },

  // ✅ РЕДИЗАЙН: Компактная карточка автора
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: Platform.select({
      default: 10, // Мобильные
      web: 10, // Десктоп - уменьшено
    }),
    marginBottom: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп - уменьшено
    }),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 4,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 4
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
    width: '100%',
    maxWidth: '100%',
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
      default: 48, // Мобильные
      web: 48, // Десктоп - уменьшено
    }),
    height: Platform.select({
      default: 48, // Мобильные
      web: 48, // Десктоп - уменьшено
    }),
    borderRadius: Platform.select({
      default: 24, // Мобильные
      web: 24, // Десктоп - уменьшено
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
    marginTop: 8, // Ещё более компактно
    paddingTop: 8, // Ещё более компактно
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  // ✅ РЕДИЗАЙН: Компактные информационные строки
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 4, // Мобильные
      web: 5, // Десктоп - уменьшено
    }),
    paddingHorizontal: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп - уменьшено
    }),
    marginBottom: 6,
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
    flexWrap: 'wrap',
    rowGap: 6,
    marginBottom: DESIGN_TOKENS.spacing.xs, // Уменьшено с 8
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    marginLeft: 'auto',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
      default: {},
    }),
  },
  actionBtnPdf: {
    backgroundColor: 'rgba(185, 28, 28, 0.06)',
    borderColor: 'rgba(185, 28, 28, 0.2)',
  },
  actionBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  userNameWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
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
      default: 6, // Мобильные
      web: 7, // Десктоп - уменьшено
    }),
    paddingHorizontal: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп - уменьшено
    }),
    borderRadius: 8,
    marginBottom: 2,
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
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
      default: 6, // Мобильные
      web: 8, // Десктоп - уменьшено
    }),
    fontSize: Platform.select({
      default: 11, // Мобильные
      web: 12, // Десктоп - уменьшено
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
    width: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
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

  closeTopBar: {
    alignItems: "flex-end",
    marginBottom: DESIGN_TOKENS.spacing.sm,
    paddingRight: 4,
  },
  closeTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  closeTopBtnPressed: {
    opacity: 0.7,
  },
  closeTopTxt: {
    marginLeft: 6,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: "#111827",
    fontFamily: "Georgia",
  },

  fallback: { paddingVertical: 40, alignItems: "center" },
});
