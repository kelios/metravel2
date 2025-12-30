// components/travel/CompactSideBarTravel.tsx
import React, { memo, Suspense, useCallback, useMemo, useState, lazy } from "react";
import {
  View,
  StyleSheet,
  Linking,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import type { Travel } from "@/src/types/types";
import { buildTravelSectionLinks, type TravelSectionLink } from "@/components/travel/sectionLinks";
import WeatherWidget from "@/components/WeatherWidget";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";
import type { BookSettings } from "@/components/export/BookSettingsModal";
import { useSingleTravelExport } from "@/components/travel/hooks/useSingleTravelExport";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.primary} />
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
    try {
      const dbg = typeof window !== 'undefined' && (window as any).__NAV_DEBUG__;
      if (dbg) {
        // eslint-disable-next-line no-console
        console.debug('[nav] emitOpenSection(web)', { key });
      }
    } catch {
      // noop
    }
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
  const { isTablet } = useResponsive();
  const isWeb = Platform.OS === 'web';
  const themedColors = useThemedColors();
  const textColor = themedColors.text;
  const mutedText = themedColors.textMuted;
  const travelAddress = travel.travelAddress;
  const travelOwnerId = (travel as any).userIds ?? (travel as any).userId ?? (travel as any).user?.id ?? null;
  const avatar = (travel as any).user?.avatar;
  const updatedAt = (travel as any).updated_at;
  const travelId = travel.id;
  const navLinksSource = Array.isArray(links) && links.length ? links : null;
  const [active, setActive] = useState<string>("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const {
    pdfExport,
    lastSettings,
    handleOpenPrintBookWithSettings,
  } = useSingleTravelExport(travel);

  // ✅ УЛУЧШЕНИЕ: Группировка пунктов меню по категориям
  const navLinks = navLinksSource ? navLinksSource : buildTravelSectionLinks(travel);

  // ✅ УЛУЧШЕНИЕ: Используем внешнюю активную секцию, если она передана, иначе локальную
  const currentActive = externalActiveSection !== undefined ? externalActiveSection : active;

  const notifyUnavailable = useCallback((label: string) => {
    if (Platform.OS === 'web') {
      try {
        window.alert?.('Раздел недоступен');
      } catch {
        // noop
      }
      return;
    }
    Alert.alert?.('Недоступно', `Раздел «${label}» недоступен`);
  }, []);

  const isSectionAvailable = useCallback(
    (key: string) => {
      // На web секции могут монтироваться лениво (Defer/ProgressiveWrapper).
      // Не блокируем клик ранней проверкой — scrollTo умеет дождаться DOM.
      if (Platform.OS === 'web') return true;

      if (key && refs && refs[key]?.current) return true;
      return false;
    },
    [refs]
  );

  const setActiveNavigateAndOpen = useCallback(
    (key: keyof SideBarProps["refs"]) => {
      const k = String(key);

      const linkLabel = navLinks.find((l) => l.key === k)?.label ?? 'Раздел';
      if (!isSectionAvailable(k)) {
        notifyUnavailable(linkLabel);
        return;
      }

      setActive(k);
      try {
        const dbg = typeof window !== 'undefined' && (window as any).__NAV_DEBUG__;
        if (dbg) {
          // eslint-disable-next-line no-console
          console.debug('[nav] sidebar click', { key: k, isMobile, os: Platform.OS });
        }
      } catch {
        // noop
      }
      emitOpenSection(k); // раскрыть секцию
      try {
        onNavigate(key); // скролл
      } catch {
        notifyUnavailable(linkLabel);
        return;
      }
      if (isMobile) closeMenu();
    },
    [closeMenu, isMobile, isSectionAvailable, navLinks, notifyUnavailable, onNavigate]
  );

  // Надёжная проверка права редактирования (типы могут отличаться)
  const canEdit = useMemo(() => {
    const a = String(storedUserId ?? "");
    const b = travelOwnerId != null ? String(travelOwnerId) : "";
    return !!(isSuperuser || (a && b && a === b));
  }, [isSuperuser, storedUserId, travelOwnerId]);

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
    if (travelOwnerId == null) return null;
    const v = String(travelOwnerId).trim();
    return v ? v : null;
  }, [travelOwnerId]);

  const handleOpenAuthorProfile = useCallback(() => {
    if (!authorUserId) return;
    openUrl(`/user/${authorUserId}`);
  }, [authorUserId]);

  // ✅ УЛУЧШЕНИЕ: Оптимизация URL аватара
  const avatarUri = useMemo(() => {
    if (!avatar) return "";
    
    const versionedUrl = buildVersionedImageUrl(
      avatar,
      updatedAt,
      travelId
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
  }, [avatar, updatedAt, travelId]);

  const coverUri = useMemo(() => {
    const rawFirst = (travel as any)?.gallery?.[0];
    const firstUrl = rawFirst
      ? typeof rawFirst === 'string'
        ? rawFirst
        : rawFirst?.url
      : '';

    if (!firstUrl) return '';

    const imgUpdatedAt = (rawFirst as any)?.updated_at ?? updatedAt;
    const imgId = (rawFirst as any)?.id ?? travelId;

    const versionedUrl = buildVersionedImageUrl(firstUrl, imgUpdatedAt, imgId);

    const coverSize = 48;
    const optimalSize = getOptimalImageSize(coverSize, coverSize);

    return (
      optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        height: optimalSize.height,
        format: 'webp',
        quality: 85,
        fit: 'cover',
      }) || versionedUrl
    );
  }, [travel, travelId, updatedAt]);

  const headerImageUri = coverUri || avatarUri;

  // Извлекаем координаты из travelAddress
  const firstCoord = useMemo(() => {
    if (travelAddress && Array.isArray(travelAddress) && travelAddress.length > 0) {
      const first = travelAddress[0] as any;
      return first?.coord || first?.coordsMeTravel?.[0] || null;
    }
    return null;
  }, [travelAddress]);

  // Извлекаем категории
  const categories = useMemo(() => {
    if (travelAddress && Array.isArray(travelAddress)) {
      const cats = new Set<string>();
      travelAddress.forEach((addr: any) => {
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
  }, [travelAddress]);

  const handleUserTravels = () => {
    const id = (travel as any).userIds ?? (travel as any).userId;
    if (id) {
      openUrl(`/search?user_id=${encodeURIComponent(id)}`);
    }
  };
  const handleEdit = () => canEdit && openUrl(`/travel/${travel.id}/`);

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

  const menuItems = [
    isMobile ? (
      <View key="close-top" style={styles.closeTopBar}>
        <Pressable
          onPress={closeMenu}
          style={({ pressed }) => [styles.closeTopBtn, pressed && styles.closeTopBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
          hitSlop={8}
        >
          <MaterialIcons name="close" size={20} color={textColor} />
        </Pressable>
      </View>
    ) : null,

    <View key="author-card" style={[styles.card, { backgroundColor: themedColors.surface }]}>
      <View style={styles.cardRow}>
        <View style={styles.avatarWrap}>
          {headerImageUri ? (
            <ImageCardMedia
              src={headerImageUri}
              alt={(travel as any)?.name || titleLine || userName || 'Обложка'}
              width={styles.avatar.width as any}
              height={styles.avatar.height as any}
              borderRadius={styles.avatar.borderRadius as any}
              fit="cover"
              blurBackground={false}
              priority="low"
              loading="lazy"
              style={styles.avatar}
            />
          ) : (
            <MaterialIcons name="image" size={60} color={mutedText} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.userRow}>
            <Pressable
              onPress={handleOpenAuthorProfile}
              disabled={!authorUserId}
              accessibilityRole={authorUserId ? 'button' : undefined}
              accessibilityLabel={
                authorUserId ? `Открыть профиль автора ${userName || 'Пользователь'}` : undefined
              }
              style={({ pressed }) => [
                styles.userNameWrap,
                pressed && authorUserId ? { opacity: 0.9 } : null,
              ]}
              {...Platform.select({ web: authorUserId ? { cursor: 'pointer' } : {} })}
            >
              <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
                <Text style={[styles.userNamePrimary, { color: textColor }]}>
                  {userName || 'Пользователь'}
                </Text>
                {countryName ? (
                  <Text style={[styles.userCountry, { color: mutedText }]}>{` | ${countryName}`}</Text>
                ) : null}
              </Text>
            </Pressable>

            <View style={styles.actionsRow}>
              {canEdit && (
                <Pressable
                  onPress={handleEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Редактировать путешествие"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                >
                  <MaterialIcons name="edit" size={18} color={textColor} />
                </Pressable>
              )}

              {Platform.OS === 'web' && (
                <Pressable
                  onPress={handleOpenExport}
                  disabled={pdfExport.isGenerating}
                  accessibilityRole="button"
                  accessibilityLabel="Экспорт в PDF"
                  style={({ pressed }) => [
                    styles.actionBtn,
                    pressed && !pdfExport.isGenerating ? styles.actionBtnPressed : null,
                    pdfExport.isGenerating ? styles.actionBtnDisabled : null,
                  ]}
                >
                  {pdfExport.isGenerating ? (
                    <ActivityIndicator size="small" color={mutedText} />
                  ) : (
                    <MaterialIcons name="picture-as-pdf" size={18} color={mutedText} />
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {(whenLine || daysText || (viewsSafe != null && Number.isFinite(viewsSafe))) ? (
            <View style={styles.metaRow}>
              {whenLine ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="calendar-today" size={14} color={mutedText} />
                  <Text style={[styles.metaText, { color: mutedText }]} numberOfLines={1}>
                    {whenLine}
                  </Text>
                </View>
              ) : null}
              {daysText ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="schedule" size={14} color={mutedText} />
                  <Text style={[styles.metaText, { color: mutedText }]} numberOfLines={1}>
                    {daysText}
                  </Text>
                </View>
              ) : null}
              {viewsSafe != null && Number.isFinite(viewsSafe) ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="visibility" size={14} color={mutedText} />
                  <Text style={[styles.metaText, { color: mutedText }]} numberOfLines={1}>
                    {viewsSafe.toLocaleString('ru-RU')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.infoSection}>
        {categories.length > 0 ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="category" size={14} color={mutedText} />
            <View
              style={[
                styles.categoriesWrap,
                { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1 },
              ]}
            >
              {(showAllCategories ? categories : categories.slice(0, 2)).map((cat, idx) => (
                <View key={`${cat}-${idx}`} style={styles.categoryTagWrapper}>
                  <Text style={[styles.categoryTag, { color: mutedText }]} numberOfLines={1}>
                    {cat}
                  </Text>
                </View>
              ))}
              {!showAllCategories && categories.length > 2 ? (
                <Pressable
                  onPress={() => setShowAllCategories(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Показать все категории (${categories.length})`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.categoryMoreBtn,
                    pressed ? styles.categoryMoreBtnPressed : null,
                  ]}
                >
                  <Text style={[styles.categoryMore, { color: mutedText }]}>
                    +{categories.length - 2}
                  </Text>
                </Pressable>
              ) : null}
              {showAllCategories && categories.length > 2 ? (
                <Pressable
                  onPress={() => setShowAllCategories(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть категории"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.categoryMoreBtn,
                    pressed ? styles.categoryMoreBtnPressed : null,
                  ]}
                >
                  <Text style={[styles.categoryMore, { color: mutedText }]}>Свернуть</Text>
                </Pressable>
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
            <MaterialIcons name="place" size={14} color={mutedText} />
            <Text
              style={[
                styles.infoText,
                { marginLeft: DESIGN_TOKENS.spacing.xs, flex: 1, color: mutedText },
              ]}
              numberOfLines={1}
            >
              {firstCoord}
            </Text>
            {Platform.OS === "web" ? (
              <MaterialIcons
                name="content-copy"
                size={12}
                color={mutedText}
                style={{ marginLeft: DESIGN_TOKENS.spacing.xs }}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>,

    ...navLinks.map(({ key, icon, label, meta }, index) => {
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
            onPress={() => setActiveNavigateAndOpen(key as keyof SideBarProps['refs'])}
            android_ripple={{ color: DESIGN_TOKENS.colors.primarySoft }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: currentActive === key }}
          >
            <View
              pointerEvents="none"
              style={[
                styles.activeIndicator,
                currentActive === key && styles.activeIndicatorActive,
              ]}
            />
            <View style={styles.linkLeft}>
              <MaterialIcons
                name={icon as any}
                size={Platform.select({
                  default: 18,
                  web: isTablet ? 20 : 18,
                })}
                color={currentActive === key ? textColor : mutedText}
              />
              <Text
                style={[
                  styles.linkTxt,
                  isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
                  currentActive === key && styles.linkTxtActive,
                  { color: currentActive === key ? textColor : mutedText },
                ]}
              >
                {label}
              </Text>
            </View>
            {meta ? (
              <View style={styles.linkMetaPill}>
                <Text style={[styles.linkMetaText, { color: mutedText }]}>{meta}</Text>
              </View>
            ) : null}
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
  ];
  
  return (
    <View style={[styles.root, { backgroundColor: themedColors.background }]}>
      {isWeb ? (
        <View
          style={[
            styles.menu,
            isMobile ? { width: '100%' } : { width: '100%', maxWidth: 350 },
            { paddingBottom: isMobile ? 80 : 32, paddingLeft: 12, paddingRight: 12 },
          ]}
        >
          {menuItems}
        </View>
      ) : (
        <ScrollView
          style={[styles.menu, { width: '100%' }]}
          contentContainerStyle={{
            paddingBottom: isMobile ? 80 : 32,
            paddingLeft: 10,
            paddingRight: 10,
          }}
          showsHorizontalScrollIndicator={false}
        >
          {menuItems}
        </ScrollView>
      )}

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
            <MaterialIcons name="close" size={20} color={themedColors.textInverse} />
            <Text style={[styles.closeTxt, { color: themedColors.textInverse }]}>Закрыть</Text>
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
    backgroundColor: DESIGN_TOKENS.colors.background,
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
      maxWidth: 350, 
      overflowX: 'hidden' as any,
      overflow: 'hidden' as any,
      width: '100%',
    } : {}), // ✅ UX: Прижато к левому краю
  },
  // ✅ РЕДИЗАЙН: Компактная карточка автора
  card: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
    padding: Platform.select({
      default: 10, // Мобильные
      web: 10, // Десктоп - уменьшено
    }),
    marginBottom: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп - уменьшено
    }),
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  cardRow: { 
    flexDirection: "row", 
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.sm, // Уменьшено с 12
  },
  avatarWrap: { 
    marginRight: DESIGN_TOKENS.spacing.sm, // Уменьшено с 14
    alignItems: "center",
    justifyContent: "center",
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
    borderColor: DESIGN_TOKENS.colors.borderLight,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 2,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
  },
  
  
  infoSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: DESIGN_TOKENS.colors.borderLight,
  },
  // ✅ РЕДИЗАЙН: Компактные информационные строки
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 4,
      web: 4,
    }),
    paddingHorizontal: 0,
    marginBottom: 6,
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
  },
  infoText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm, // Уменьшено с 14
    color: DESIGN_TOKENS.colors.textMuted,
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
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textSubtle,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    fontFamily: "Georgia",
    fontWeight: "600",
    borderWidth: 0,
    borderColor: "transparent",
    maxWidth: 90,
  },
  categoryMore: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textSubtle,
    fontFamily: "Georgia",
    fontWeight: "500",
    marginLeft: 3, // Уменьшено с 4
  },
  categoryMoreBtn: {
    marginLeft: 3,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
      default: {},
    }),
  },
  categoryMoreBtnPressed: {
    opacity: 0.85,
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
    gap: DESIGN_TOKENS.spacing.xs,
    marginLeft: 'auto',
    flexShrink: 0,
    alignSelf: 'center',
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
      default: {},
    }),
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
    fontSize: Platform.select({
      default: 15,
      web: 16,
    }),
    fontWeight: "700",
    color: DESIGN_TOKENS.colors.text,
    fontFamily: "Georgia", 
    flexShrink: 1,
    lineHeight: 20,
  },
  userNamePrimary: {
    fontWeight: "800",
    color: DESIGN_TOKENS.colors.text,
  },
  userCountry: {
    fontWeight: "600",
    color: DESIGN_TOKENS.colors.textMuted,
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
    color: DESIGN_TOKENS.colors.text, 
    fontFamily: "Georgia",
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    columnGap: 10,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  metaText: {
    fontSize: 14,
    color: DESIGN_TOKENS.colors.textMuted,
    fontFamily: 'Georgia',
    fontWeight: '600',
    lineHeight: 20,
    flexShrink: 1,
  },
  userDays: { 
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: DESIGN_TOKENS.colors.text, 
    fontFamily: "Georgia",
    lineHeight: 20,
  },
  exportSummary: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: 4,
  },

  // ✅ РЕДИЗАЙН: Компактные пункты меню
  link: { 
    position: "relative",
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
    paddingLeft: Platform.select({
      default: 14,
      web: 16,
    }),
    borderRadius: 8,
    marginBottom: 2,
    width: '100%',
    maxWidth: '100%',
    justifyContent: "space-between",
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
      default: {},
    }),
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  activeIndicatorActive: {
    backgroundColor: DESIGN_TOKENS.colors.text,
  },
  linkPressed: { backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary },
  linkActive: { 
    backgroundColor: "transparent",
    borderLeftWidth: 0,
    borderLeftColor: "transparent",
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  linkTxt: { 
    marginLeft: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп - уменьшено
    }),
    fontSize: 14,
    fontFamily: "Georgia", 
    color: DESIGN_TOKENS.colors.text,
    fontWeight: "600",
    lineHeight: 20,
  },
  linkTxtActive: {
    color: DESIGN_TOKENS.colors.text, // ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый
    fontWeight: "700",
  },
  linkMetaPill: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    borderWidth: 0,
    borderColor: "transparent",
    flexShrink: 0,
  },
  linkMetaText: {
    fontSize: 14,
    color: DESIGN_TOKENS.colors.textMuted,
    fontFamily: "Georgia",
    fontWeight: "600",
    lineHeight: 18,
  },
  linkDivider: {
    height: 1,
    backgroundColor: DESIGN_TOKENS.colors.borderLight,
    marginVertical: 10,
    marginHorizontal: 0,
  },

  allTravels: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    textAlign: "center",
    fontWeight: "500",
    color: DESIGN_TOKENS.colors.accentDark,
    fontFamily: "Georgia",
    width: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },

  closeBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DESIGN_TOKENS.colors.primaryDark,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    alignItems: "center",
  },
  closeBtn: { flexDirection: "row", alignItems: "center" },
  closeBtnPressed: { opacity: 0.7 },
  closeTxt: { color: DESIGN_TOKENS.colors.textOnDark, fontSize: DESIGN_TOKENS.typography.sizes.md, fontFamily: "Georgia", marginLeft: 8 },

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
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
  },
  closeTopBtnPressed: {
    opacity: 0.7,
  },
  closeTopTxt: {
    marginLeft: 6,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.text,
    fontFamily: "Georgia",
  },

  fallback: { paddingVertical: 40, alignItems: "center" },
});
