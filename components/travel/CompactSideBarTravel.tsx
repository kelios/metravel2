// components/travel/CompactSideBarTravel.tsx
import React, { memo, Suspense, useCallback, useMemo, useState, lazy } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
  Alert,
} from "react-native";
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from "@/ui/paper";
import type { Travel } from "@/types/types";
import { buildTravelSectionLinks, type TravelSectionLink } from "@/components/travel/sectionLinks";
import WeatherWidget from "@/components/home/WeatherWidget";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, useTheme } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import Button from '@/components/ui/Button';
import SubscribeButton from '@/components/ui/SubscribeButton';
import { useUserProfileCached } from '@/hooks/useUserProfileCached';
import { globalFocusStyles } from '@/styles/globalFocus';

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

const TravelPdfExportControlLazy = lazy(() => import('@/components/travel/TravelPdfExportControl'));

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
  const { isTablet } = useResponsive();
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const { isDark } = useTheme();
  const themedColors = useThemedColors();
  const styles = useMemo(() => createStyles(themedColors), [themedColors]);
  const textColor = themedColors.text;
  const mutedText = isDark ? themedColors.textMuted : themedColors.textSecondary;
  const travelOwnerId = (travel as any).userIds ?? (travel as any).userId ?? (travel as any).user?.id ?? null;
  const { profile: authorProfile } = useUserProfileCached(travelOwnerId, { enabled: !!travelOwnerId });
  const avatar =
    (authorProfile as any)?.avatar ??
    (travel as any).user?.avatar ??
    (travel as any).avatar ??
    (travel as any).userAvatar ??
    (travel as any).user_avatar ??
    (travel as any).authorAvatar ??
    (travel as any).author_avatar ??
    null;
  const navLinksSource = Array.isArray(links) && links.length ? links : null;
  const [active, setActive] = useState<string>("");

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

  const navigateInternalUrl = useCallback(
    (url: string) => {
      if (!url || !url.startsWith('/')) return;
      router.push(url as any);
    },
    [router]
  );

  // Надёжная проверка права редактирования (типы могут отличаться)
  const canEdit = useMemo(() => {
    const a = String(storedUserId ?? "");
    const b = travelOwnerId != null ? String(travelOwnerId) : "";
    return !!(isSuperuser || (a && b && a === b));
  }, [isSuperuser, storedUserId, travelOwnerId]);

  // Проверка: это моё собственное путешествие (без учёта isSuperuser)
  const isOwnTravel = useMemo(() => {
    const a = String(storedUserId ?? "");
    const b = travelOwnerId != null ? String(travelOwnerId) : "";
    return !!(a && b && a === b);
  }, [storedUserId, travelOwnerId]);

  // ── Безопасные текстовые поля (ничего "null"/"undefined" не рендерим) ──
  const userName = (travel as any).userName || "";
  const monthName = (travel as any).monthName || ""; // напр. "Май"
  const yearStr =
    travel && (travel as any).year != null ? String((travel as any).year) : "";
  const whenLine = [monthName, yearStr].filter(Boolean).join(" ");

  const viewsSafe =
    (travel as any).countUnicIpView != null
      ? Number((travel as any).countUnicIpView)
      : null;

  const authorTravelsCtaLabel = 'Все путешествия автора';

  const authorUserId = useMemo(() => {
    if (travelOwnerId == null) return null;
    const v = String(travelOwnerId).trim();
    return v ? v : null;
  }, [travelOwnerId]);

  const handleOpenAuthorProfile = useCallback(() => {
    if (!authorUserId) return;
    navigateInternalUrl(`/user/${authorUserId}`);
  }, [authorUserId, navigateInternalUrl]);

  const normalizeMediaUrl = useCallback((raw: string) => {
    const value = String(raw ?? '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;

    if (value.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
      if (base) return `${base}${value}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return `${window.location.origin}${value}`;
      }
    }

    return value;
  }, []);

  const avatarUri = useMemo(() => {
    if (!avatar) return '';
    return normalizeMediaUrl(String(avatar));
  }, [avatar, normalizeMediaUrl]);

  const handleUserTravels = () => {
    const id = (travel as any).userIds ?? (travel as any).userId;
    if (id) {
      navigateInternalUrl(`/search?user_id=${encodeURIComponent(id)}`);
    }
  };
  const handleEdit = () => canEdit && navigateInternalUrl(`/travel/${travel.id}/`);

  const setWebTitle = useCallback(
    (title: string) => (el: any) => {
      if (Platform.OS === 'web' && el) {
        const node = el instanceof HTMLElement ? el : el._nativeTag ?? el;
        if (node?.setAttribute) node.setAttribute('title', title);
      }
    },
    []
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
          <Feather name="x" size={20} color={textColor} />
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
          {avatarUri ? (
            <ImageCardMedia
              src={avatarUri}
              alt={userName || 'Пользователь'}
              width={styles.avatar.width as any}
              height={styles.avatar.height as any}
              borderRadius={styles.avatar.borderRadius as any}
              fit="contain"
              blurBackground
              priority="low"
              loading="lazy"
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
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
                globalFocusStyles.focusable,
                pressed && authorUserId ? { opacity: 0.9 } : null,
              ]}
              {...Platform.select({
                web: authorUserId
                  ? {
                      cursor: 'pointer',
                      role: 'button',
                      'aria-label': `Открыть профиль автора ${userName || 'Пользователь'}`,
                      'data-author-name': true,
                      title: `Открыть профиль автора ${userName || 'Пользователь'}`,
                    }
                  : {},
              })}
            >
              <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
                <Text style={[styles.userNamePrimary, { color: textColor }]}>
                  {userName || 'Пользователь'}
                </Text>
              </Text>
            </Pressable>

            <View style={styles.actionsRow}>
              {canEdit && (
                <Pressable
                  onPress={handleEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Редактировать путешествие"
                  style={({ pressed }) => [
                    styles.actionBtn,
                    globalFocusStyles.focusable,
                    pressed && styles.actionBtnPressed,
                  ]}
                  ref={setWebTitle('Редактировать')}
                  {...(Platform.OS === 'web'
                    ? {
                        'data-action-btn': true,
                        role: 'button',
                        'aria-label': 'Редактировать путешествие',
                      }
                    : {})}
                >
                  <Feather name="edit" size={18} color={textColor} />
                </Pressable>
              )}

              {Platform.OS === 'web' && (
                <Suspense fallback={null}>
                  <TravelPdfExportControlLazy
                    travel={travel}
                    mutedText={mutedText}
                    actionBtnStyle={styles.actionBtn}
                    actionBtnPressedStyle={styles.actionBtnPressed}
                    actionBtnDisabledStyle={styles.actionBtnDisabled}
                  />
                </Suspense>
              )}

              {!isOwnTravel && authorUserId && (
                <SubscribeButton
                  targetUserId={authorUserId}
                  iconOnly
                  style={[styles.actionBtn, globalFocusStyles.focusable]}
                />
              )}

              {!isOwnTravel && authorUserId && (
                <Pressable
                  onPress={() => navigateInternalUrl(`/messages?userId=${encodeURIComponent(authorUserId)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Написать автору ${userName || 'Пользователь'}`}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    globalFocusStyles.focusable,
                    pressed && styles.actionBtnPressed,
                  ]}
                  ref={setWebTitle('Написать автору')}
                  {...(Platform.OS === 'web'
                    ? {
                        'data-action-btn': true,
                        role: 'button',
                        'aria-label': `Написать автору ${userName || 'Пользователь'}`,
                      }
                    : {})}
                >
                  <Feather name="mail" size={18} color={textColor} />
                </Pressable>
              )}
            </View>
          </View>

          {(whenLine || (viewsSafe != null && Number.isFinite(viewsSafe))) ? (
            <View style={styles.metaRow}>
              {whenLine ? (
                <View style={styles.metaPill}>
                  <Feather name="calendar" size={14} color={mutedText} />
                  <Text style={[styles.metaText, { color: mutedText }]} numberOfLines={1}>
                    {whenLine}
                  </Text>
                </View>
              ) : null}
              {viewsSafe != null && Number.isFinite(viewsSafe) ? (
                <View
                  style={styles.metaPill}
                  accessibilityRole={Platform.OS === 'web' ? undefined : 'text'}
                  accessibilityLabel={`${viewsSafe.toLocaleString('ru-RU')} просмотров`}
                  {...(Platform.OS === 'web'
                    ? {
                        'aria-label': `${viewsSafe.toLocaleString('ru-RU')} просмотров`,
                      }
                    : {})}
                >
                  <Feather name="eye" size={14} color={mutedText} />
                  <Text style={[styles.metaText, { color: mutedText }]} numberOfLines={1}>
                    {viewsSafe.toLocaleString('ru-RU')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {userName ? (
            <View style={styles.allTravelsWrap}>
              <Button
                label={authorTravelsCtaLabel}
                onPress={handleUserTravels}
                variant="secondary"
                size="sm"
                fullWidth
                accessibilityLabel={authorTravelsCtaLabel}
                style={styles.allTravelsButton}
                labelStyle={styles.allTravelsButtonLabel}
                labelNumberOfLines={2}
                {...(Platform.OS === 'web'
                  ? ({ testID: 'open-author-travels', } as any)
                  : {})}
              />
            </View>
          ) : null}
        </View>
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
              'aria-current': currentActive === key ? 'page' : undefined,
              role: 'button',
              'aria-label': label,
            } : {})}
          >
            <View
              style={[
                styles.activeIndicator,
                currentActive === key && styles.activeIndicatorActive,
                { pointerEvents: 'none' },
              ]}
            />
            <View style={styles.linkLeft}>
              <Feather
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

    <Suspense key="weather" fallback={<Fallback />}>
      <WeatherWidget points={travel.travelAddress as any} />
    </Suspense>,
  ];
  
  const menuPaddingBottom = isMobile ? 80 : isWeb ? 20 : 32;
  const menuPaddingHorizontal = 10;

  return (
    <View style={[styles.root, { backgroundColor: themedColors.background }]}>
      <View
        style={{ flex: 1, minHeight: 0 }}
        {...(Platform.OS === 'web' ? { 'data-sidebar-menu': true } : {})}
      >
        <ScrollView
          style={[
            styles.menu,
            { width: '100%' },
          ]}
          contentContainerStyle={{
            paddingBottom: menuPaddingBottom,
            paddingLeft: menuPaddingHorizontal,
            paddingRight: menuPaddingHorizontal,
          }}
          showsVerticalScrollIndicator={Platform.OS !== 'web'}
        >
          {menuItems}
        </ScrollView>
      </View>

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
            <Feather name="x" size={20} color={themedColors.textInverse} />
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
      position: "relative" as any,
      display: 'flex' as any,
      flexDirection: 'column' as any,
      minHeight: 0 as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Современное меню с изящными отступами
  menu: {
    paddingTop: Platform.select({
      ios: 16,
      android: 16,
      web: 16,
    }),
    alignSelf: "flex-start",
    ...(Platform.OS === 'web' ? {
      maxWidth: 350,
      flex: 1,
      minHeight: 0 as any,
      overflowY: 'auto' as any,
      overflowX: 'hidden' as any,
      width: '100%',
      alignSelf: 'stretch' as any,
    } : {}),
  },
  // ✅ РЕДИЗАЙН: Компактная карточка автора (оптимизация для отображения без скролла)
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: Platform.select({
      default: 14,
      web: 14,
    }),
    marginBottom: Platform.select({
      default: 10,
      web: 8,
    }),
    shadowColor: colors.shadows.medium.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web' ? {
      boxShadow: colors.boxShadows.card,
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  cardRow: { 
    flexDirection: "row", 
    alignItems: "flex-start",
    marginBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.sm,
      web: DESIGN_TOKENS.spacing.xs,
    }),
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
      web: 44,
    }),
    height: Platform.select({
      default: 50,
      web: 44,
    }),
    borderRadius: Platform.select({
      default: 25,
      web: 22,
    }),
    borderWidth: 2,
    borderColor: colors.borderLight,
    shadowColor: colors.shadows.light.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: colors.boxShadows.light,
    } as any : {}),
  },
  avatarPlaceholder: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderLight,
  },
  
  // ✅ РЕДИЗАЙН: Компактные информационные строки
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: 5,
      web: 4,
    }),
    paddingHorizontal: 0,
    marginBottom: Platform.select({ default: 6, web: 4 }),
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
    marginRight: Platform.select({ default: 6, web: 4 }),
    marginBottom: Platform.select({ default: 6, web: 4 }),
  },
  categoryTag: {
    fontSize: Platform.select({ default: 13, web: 12 }),
    color: colors.primaryText,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: Platform.select({ default: 10, web: 8 }),
    paddingVertical: Platform.select({ default: 4, web: 3 }),
    borderRadius: 999,
    fontFamily: "Georgia",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: colors.primaryLight,
    maxWidth: Platform.select({ default: 100, web: 92 }),
    overflow: 'hidden',
  },
  categoryMore: {
    fontSize: Platform.select({ default: 13, web: 12 }),
    color: colors.primaryText,
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
    marginBottom: 2,
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
    width: Platform.select({ default: 42, web: 40 }),
    height: Platform.select({ default: 42, web: 40 }),
    borderRadius: Platform.select({ default: 12, web: 12 }),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadows.light.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease',
      boxShadow: colors.boxShadows.light,
    } as any : {}),
  },
  actionBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
    backgroundColor: colors.backgroundSecondary,
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
      web: 15,
    }),
    fontWeight: "700",
    color: colors.text,
    fontFamily: "Georgia", 
    flexShrink: 1,
    lineHeight: Platform.select({ default: 20, web: 19 }),
    letterSpacing: -0.2,
  },
  userNamePrimary: {
    fontWeight: "800",
    color: colors.text,
  },
  userSubtitle: {
    marginTop: 2,
    fontSize: Platform.select({ default: 13, web: 12 }),
    fontFamily: 'Georgia',
    fontWeight: '500',
    lineHeight: Platform.select({ default: 18, web: 17 }),
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
    marginTop: Platform.select({ default: 6, web: 6 }),
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  metaText: {
    fontSize: Platform.select({ default: 13, web: 12 }),
    color: colors.textMuted,
    fontFamily: 'Georgia',
    fontWeight: '500',
    lineHeight: Platform.select({ default: 20, web: 18 }),
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
      web: 8,
    }),
    paddingHorizontal: Platform.select({
      default: 12,
      web: 12,
    }),
    paddingLeft: Platform.select({
      default: 18,
      web: 16,
    }),
    borderRadius: 12,
    marginBottom: Platform.select({ default: 4, web: 2 }),
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
    marginTop: Platform.select({ default: -12, web: -9 }),
    height: Platform.select({ default: 24, web: 18 }),
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
      web: 10,
    }),
    fontSize: Platform.select({ default: 15, web: 14 }),
    fontFamily: "Georgia",
    color: colors.text,
    fontWeight: "500",
    lineHeight: Platform.select({ default: 22, web: 20 }),
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  linkTxtActive: {
    color: colors.primaryText,
    fontWeight: "700",
  },
  linkMetaPill: {
    marginLeft: Platform.select({ default: 10, web: 8 }),
    paddingHorizontal: Platform.select({ default: 8, web: 6 }),
    paddingVertical: Platform.select({ default: 3, web: 2 }),
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 0,
    borderColor: "transparent",
    flexShrink: 1,
    maxWidth: Platform.select({ default: 140, web: 120 }),
  },
  linkMetaText: {
    fontSize: Platform.select({ default: 14, web: 12 }),
    color: colors.textMuted,
    fontFamily: "Georgia",
    fontWeight: "600",
    lineHeight: Platform.select({ default: 18, web: 16 }),
    flexWrap: 'wrap',
  },
  linkDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: Platform.select({ default: 16, web: 10 }),
    marginHorizontal: 12,
    ...(Platform.OS === 'web' ? {
      // React Native Web не поддерживает shorthand background
      backgroundImage: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
      backgroundRepeat: 'no-repeat',
    } as any : {}),
  },

  allTravels: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    textAlign: "center",
    color: colors.primaryText,
    fontFamily: "Georgia",
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  allTravelsWrap: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    width: '100%',
  },
  sidebarActionsRow: {
    flexDirection: 'column' as const,
    gap: 6,
    marginTop: 6,
    width: '100%',
  },
  allTravelsButton: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderLight,
  },
  allTravelsButtonLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
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
  const navigateInternalUrl = useCallback(
    (url: string) => {
      if (!url || !url.startsWith('/')) return;
      router.push(url as any);
    },
    [router]
  );
