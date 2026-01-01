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

// ✅ УЛУЧШЕНИЕ: Импорт CSS для современных стилей (только для web)
if (Platform.OS === 'web') {
  require('./CompactSideBarTravel.web.css');
}

const Fallback = () => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
};

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
  const styles = useMemo(() => createStyles(themedColors), [themedColors]);
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
          {...(Platform.OS === 'web' ? { role: 'button', 'aria-label': 'Закрыть меню' } : {})}
        >
          <MaterialIcons name="close" size={20} color={textColor} />
        </Pressable>
      </View>
    ) : null,

    <View
      key="author-card"
      style={[styles.card, { backgroundColor: themedColors.surface }]}
      {...(Platform.OS === 'web' ? { 'data-sidebar-card': true } : {})}
    >
      <View style={styles.cardRow}>
        <View
          style={styles.avatarWrap}
          {...(Platform.OS === 'web' ? { 'data-sidebar-avatar': true } : {})}
        >
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
              {...Platform.select({
                web: authorUserId
                  ? { cursor: 'pointer', role: 'button', 'aria-label': `Открыть профиль автора ${userName || 'Пользователь'}` }
                  : {},
              })}
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
                  {...(Platform.OS === 'web'
                    ? { 'data-action-btn': true, role: 'button', 'aria-label': 'Редактировать путешествие' }
                    : {})}
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
                  {...(Platform.OS === 'web' ? {
                    'data-action-btn': true,
                    'data-disabled': pdfExport.isGenerating ? 'true' : 'false',
                    role: 'button',
                    'aria-label': 'Экспорт в PDF',
                  } : {})}
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
                <View
                  key={`${cat}-${idx}`}
                  style={styles.categoryTagWrapper}
                  {...(Platform.OS === 'web' ? { 'data-category-tag': true } : {})}
                >
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
          {shouldAddDivider ? (
            <View
              style={styles.linkDivider}
              {...(Platform.OS === 'web' ? { 'data-link-divider': true } : {})}
            />
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.link,
              currentActive === key && styles.linkActive,
              pressed && styles.linkPressed,
            ]}
            onPress={() => setActiveNavigateAndOpen(key as keyof SideBarProps['refs'])}
            android_ripple={{ color: themedColors.primarySoft }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: currentActive === key }}
            {...(Platform.OS === 'web' ? {
              'data-sidebar-link': true,
              'data-active': currentActive === key ? 'true' : 'false',
              'aria-selected': currentActive === key,
              role: 'button',
              'aria-label': label,
            } : {})}
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
                {...(Platform.OS === 'web' ? { 'data-icon': true } : {})}
              />
              <Text
                style={[
                  styles.linkTxt,
                  isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
                  currentActive === key && styles.linkTxtActive,
                  { color: currentActive === key ? textColor : mutedText },
                ]}
                {...(Platform.OS === 'web' ? { 'data-link-text': true } : {})}
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
        {...(Platform.OS === 'web'
          ? { role: 'link', 'aria-label': `Путешествия автора ${userName}` }
          : {})}
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
          {...(Platform.OS === 'web' ? { 'data-sidebar-menu': true } : {})}
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
          {...(Platform.OS === 'web' ? { 'data-sidebar-menu': true } : {})}
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
            {...(Platform.OS === 'web' ? { role: 'button', 'aria-label': 'Закрыть меню' } : {})}
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

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.surface,
    ...(Platform.OS === "web" ? {
      // На web прокрутка должна быть общей для страницы,
      // поэтому убираем собственный scroll/100vh/position: fixed
      position: "relative" as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Современное меню с изящными отступами
  menu: {
    paddingTop: Platform.select({
      ios: 16,
      android: 16,
      web: 20,
    }),
    alignSelf: "flex-start",
    ...(Platform.OS === 'web' ? {
      maxWidth: 350, 
      overflowX: 'hidden' as any,
      overflow: 'hidden' as any,
      width: '100%',
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Компактная карточка автора (оптимизация для отображения без скролла)
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: Platform.select({
      default: 12,
      web: 14,
    }),
    marginBottom: Platform.select({
      default: 10,
      web: 12,
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: '100%',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  cardRow: { 
    flexDirection: "row", 
    alignItems: "center",
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  avatarWrap: { 
    marginRight: DESIGN_TOKENS.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === 'web' ? {
      position: 'relative' as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Компактная аватарка (52px для экономии места)
  avatar: {
    width: Platform.select({
      default: 50,
      web: 52,
    }),
    height: Platform.select({
      default: 50,
      web: 52,
    }),
    borderRadius: Platform.select({
      default: 25,
      web: 26,
    }),
    borderWidth: 2,
    borderColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 12px rgba(122, 157, 143, 0.2), 0 2px 4px rgba(122, 157, 143, 0.1)',
    } as any : {}),
  },
  
  infoSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  // ✅ РЕДИЗАЙН: Компактные информационные строки
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 5,
      web: 6,
    }),
    paddingHorizontal: 0,
    marginBottom: 6,
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
  },
  infoText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: "Georgia",
    fontWeight: "500",
  },
  categoriesWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  // ✅ РЕДИЗАЙН: Стильные категории-бейджи
  categoryTagWrapper: {
    marginRight: 6,
    marginBottom: 6,
  },
  categoryTag: {
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontFamily: "Georgia",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: colors.primaryLight,
    maxWidth: 100,
    overflow: 'hidden',
  },
  categoryMore: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: "Georgia",
    fontWeight: "600",
    marginLeft: 4,
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(122, 157, 143, 0.1)',
    } as any : {}),
  },
  actionBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
    backgroundColor: colors.primaryLight,
  },
  actionBtnDisabled: {
    opacity: 0.4,
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.text,
    fontFamily: "Georgia", 
    flexShrink: 1,
    lineHeight: 20,
  },
  userNamePrimary: {
    fontWeight: "800",
    color: colors.text,
  },
  userCountry: {
    fontWeight: "600",
    color: colors.textMuted,
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
    color: colors.text, 
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
    color: colors.textMuted,
    fontFamily: 'Georgia',
    fontWeight: '600',
    lineHeight: 20,
    flexShrink: 1,
  },
  userDays: { 
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: colors.text, 
    fontFamily: "Georgia",
    lineHeight: 20,
  },
  exportSummary: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },

  // ✅ РЕДИЗАЙН: Современные пункты меню с плавными переходами
  link: {
    position: "relative",
    flexDirection: "row", 
    alignItems: "center", 
    paddingVertical: Platform.select({
      default: 10,
      web: 12,
    }),
    paddingHorizontal: Platform.select({
      default: 12,
      web: 14,
    }),
    paddingLeft: Platform.select({
      default: 18,
      web: 20,
    }),
    borderRadius: 12,
    marginBottom: 4,
    width: '100%',
    maxWidth: '100%',
    justifyContent: "space-between",
    backgroundColor: "transparent",
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer' as any,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    } : {}),
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
    top: '50%',
    marginTop: -12,
    height: 24,
    width: 3,
    borderRadius: 999,
    backgroundColor: "transparent",
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    } : {}),
  },
  activeIndicatorActive: {
    backgroundColor: colors.primary,
    width: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 8px rgba(122, 157, 143, 0.5)',
    } as any : {}),
  },
  linkPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.98 }],
  },
  linkActive: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 0,
    borderLeftColor: "transparent",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 4px rgba(122, 157, 143, 0.15)',
    } as any : {}),
  },
  linkTxt: { 
    marginLeft: Platform.select({
      default: 10,
      web: 12,
    }),
    fontSize: 15,
    fontFamily: "Georgia",
    color: colors.text,
    fontWeight: "500",
    lineHeight: 22,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  linkTxtActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  linkMetaPill: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 0,
    borderColor: "transparent",
    flexShrink: 0,
  },
  linkMetaText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "Georgia",
    fontWeight: "600",
    lineHeight: 18,
  },
  linkDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
    marginHorizontal: 12,
    ...(Platform.OS === 'web' ? {
      // React Native Web не поддерживает shorthand background
      backgroundImage: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
      backgroundRepeat: 'no-repeat',
    } as any : {}),
  },

  allTravels: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    textAlign: "center",
    fontWeight: "500",
    color: colors.accentDark,
    fontFamily: "Georgia",
    width: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },

  closeBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    alignItems: "center",
  },
  closeBtn: { flexDirection: "row", alignItems: "center" },
  closeBtnPressed: { opacity: 0.7 },
  closeTxt: { color: colors.textOnDark, fontSize: DESIGN_TOKENS.typography.sizes.md, fontFamily: "Georgia", marginLeft: 8 },

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
    backgroundColor: colors.surfaceMuted,
  },
  closeTopBtnPressed: {
    opacity: 0.7,
  },
  closeTopTxt: {
    marginLeft: 6,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
    fontFamily: "Georgia",
  },

  fallback: { paddingVertical: 40, alignItems: "center" },
});
