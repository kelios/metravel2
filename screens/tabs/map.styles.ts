// src/screens/tabs/map.styles.ts
import { Platform, StyleSheet } from 'react-native';
import { LAYOUT, METRICS } from '@/constants/layout';
import {
  getMapToolbarBottom,
  MAP_LOCATION_QUALITY_PILL_STACK_OFFSET,
  MAP_TOOLBAR_STACK_GAP,
} from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles';
import type { ThemedColors } from '@/hooks/useTheme';
import * as corner from '@/screens/tabs/mapDesktopCorner';
import { getDesktopBranchInsets, NO_DESKTOP_INSETS } from '@/screens/tabs/mapDesktopInsets';
import { getDesktopOverlayStyles } from '@/screens/tabs/mapDesktopOverlay.styles';
import { webTextStyle } from '@/utils/webProps';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 45; // 360px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 40; // 320px
const PANEL_GAP = corner.MAP_PANEL_GAP; // 16px
const DESKTOP_SHELL_PADDING = METRICS.spacing.m;
const TRANSITION_MS = 200;
export const MAP_WEB_MOBILE_BREAKPOINT_PX = METRICS.breakpoints.tablet;
/** CSS-резерв дока. Пиксельный SSG-скелет сверяется с BOTTOM_DOCK_HEIGHT отдельно. */
export const WEB_MOBILE_DOCK_INSET = 'var(--mt-dock-h, 0px)';
export const WEB_HEADER_RESERVED_HEIGHT = 88;
// Tablet web keeps the desktop map chrome/header but uses the fixed mobile
// BottomDock. Reserve both pieces of chrome so Leaflet attribution and bottom
// controls stay above the dock instead of being painted underneath it.
const WEB_TABLET_HEADER_AND_DOCK_RESERVED_HEIGHT =
  `calc(${LAYOUT.headerHeight + METRICS.spacing.s}px + var(--mt-dock-h, 0px))`;
const PANEL_RADIUS = 20;
const CONTROL_RADIUS = 12;
// Размер вью иконочных контролов карты и есть их тач-таргет — floor проекта 44dp.
const CONTROL_SIZE = 44;
// Кластер круглых кнопок desktop-ветки в правом верхнем углу карты: верхний ряд —
// «Слои» у края, слева «Радиус»; «Подсказки» (#2217) — под «Слоями». Ряд не
// растёт влево: третий слот на окне 768–925 px заходит под пилюлю «Искать в
// этой области» по центру карты и перехватывает её клики. Слот — место от края,
// ряд — от верха; верхний ряд держит не больше DESKTOP_MAP_FAB_TOP_ROW_SLOTS.
const DESKTOP_MAP_FAB_INSET = 16;
const DESKTOP_MAP_FAB_GAP = 8;
export const DESKTOP_MAP_FAB_TOP_ROW_SLOTS = 2;
const desktopMapFabRight = (slot: number): number =>
  DESKTOP_MAP_FAB_INSET + slot * (CONTROL_SIZE + DESKTOP_MAP_FAB_GAP);
const desktopMapFabRowOffset = (row: number): number =>
  row * (CONTROL_SIZE + DESKTOP_MAP_FAB_GAP);
// #2217 — шапка панели desktop-ветки (web, iPad, Android-планшет): ряд
// принадлежит только вкладкам «Места», «Маршрут», «Фильтры», иконка над
// подписью. Нормативы — docs/design/map-panel-header-tablet.md, «Бюджет ширины
// после решения»; бюджет из этих стилей считает `__tests__/app/mapLayout.test.ts`.
export const MAP_PANEL_TAB_COUNT = 3;
// Содержимое самой широкой вкладки без полей при «999+» во всех пяти языках:
// «Маршрут» RU/BE/UK по границе широких резервных шрифтов (77,5 − 7 − 7;
// по SF — 58,9).
export const MAP_PANEL_TAB_CONTENT_WIDTH = 63.5;
// Запас между нужной и доступной шириной вкладки на любой ширине панели.
export const MAP_PANEL_TAB_WIDTH_RESERVE = 8;
// Подпись вкладки в любом языке: строке подписи при панели 320 остаётся 80 px,
// самая длинная сейчас — «Маршрут», 7 знаков, 58,9 px.
export const MAP_PANEL_TAB_LABEL_MAX_CHARS = 9;
// Потолок Dynamic Type подписи и бейджа вкладки: последняя ступень до
// «Увеличенных размеров» (1,353), запас самой широкой вкладки на native при нём
// не меньше 16,7 pt. Крупнее подпись показывает Large Content Viewer (iOS).
export const MAP_PANEL_TAB_MAX_FONT_SCALE = 1.35;
// Вертикальные поля гео-баннера на мобиле. Отдельная константа, потому что из
// неё же считается минимальная высота баннера под абсолютный крестик (#1780).
const GEO_BANNER_PADDING_VERTICAL_MOBILE = 7;

/** Right offsets of «Слои» and «Радиус» from the map edge: buttons and popovers read them. */
export const DESKTOP_LAYERS_FAB_RIGHT = desktopMapFabRight(0);
export const DESKTOP_RADIUS_FAB_RIGHT = desktopMapFabRight(1);
/**
 * #2219 — the free band of the map's top row (offsets from the map's edges).
 * Left: past the chevron's reach into the map. Right: before «Радиус» — the
 * buttons stand off the shell's right edge, the map off the row padding, both
 * shifted by the same side inset, so the band does not depend on the inset.
 */
export const DESKTOP_SEARCH_AREA_BAND_LEFT = corner.DESKTOP_MAP_CORNER_ROW_LEFT;
export const DESKTOP_SEARCH_AREA_BAND_RIGHT =
  DESKTOP_RADIUS_FAB_RIGHT + CONTROL_SIZE + DESKTOP_MAP_FAB_GAP - DESKTOP_SHELL_PADDING;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  themedColors: ThemedColors,
  usesWebBottomDock = false,
  // #2233 side insets; `dockReserve` = `useDockReservePx` (native; web: usesWebBottomDock).
  shellInsets?: { left: number; right: number; dockReserve?: number },
) => {
  const shadowMedium = themedColors.shadows.medium;
  const shadowHeavy = themedColors.shadows.heavy;
  // #2172 — native engine for the desktop-branch card shadow (web draws it with
  // CSS boxShadow in the web blocks). iOS needs the full shadow set, Android
  // only reads elevation.
  const nativeCardShadow = Platform.OS === 'ios' ? shadowMedium : { elevation: shadowMedium.elevation };
  // #2172 — native at width ≥ 768 (iPad, Android tablets) renders the same
  // desktop-branch cards as web: radius, border, shadow. Web blocks stay as is.
  const isNativeDesktop = Platform.OS !== 'web' && !isMobile;
  const desktopInsets = isMobile ? NO_DESKTOP_INSETS : getDesktopBranchInsets({ top: insetTop, left: shellInsets?.left, right: shellInsets?.right });
  // #2233 — row padding, defined once: the shell row and the native chevron read it.
  const desktopRowPaddingLeft = DESKTOP_SHELL_PADDING + desktopInsets.left;
  const desktopRowPaddingTop = DESKTOP_SHELL_PADDING - 4 + desktopInsets.top;
  const webViewportReservedHeight = isMobile
    ? WEB_MOBILE_DOCK_INSET
    : usesWebBottomDock
      ? WEB_TABLET_HEADER_AND_DOCK_RESERVED_HEIGHT
      : `${WEB_HEADER_RESERVED_HEIGHT}px`;
  const webPointerCursor = Platform.OS === 'web' ? { cursor: 'pointer' as const } : {};
  // Общее тело трёх круглых кнопок карты desktop-ветки («Подсказки», «Радиус»,
  // «Слои»): ключи отличаются только слотом `right` (Style key ownership).
  const desktopMapFab = {
    position: 'absolute' as const,
    top: DESKTOP_MAP_FAB_INSET + desktopInsets.top,
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    backgroundColor: themedColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themedColors.borderLight,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1001,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(15,23,42,0.18), 0 1px 4px rgba(0,0,0,0.08)',
          transition: 'background-color 0.15s ease',
        } as any)
      : shadowMedium),
  };

  return StyleSheet.create({
    ...getDesktopOverlayStyles({
      themedColors,
      rowPaddingLeft: desktopRowPaddingLeft,
      rowPaddingTop: desktopRowPaddingTop,
      panelWidth: PANEL_WIDTH_DESKTOP,
      bandLeft: DESKTOP_SEARCH_AREA_BAND_LEFT,
      bandRight: DESKTOP_SEARCH_AREA_BAND_RIGHT,
    }),
    container: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? ({
            // Height resolution order (see hooks/useMapViewportHeightVar.ts):
            //   1. --metravel-map-vh — JS-measured visible viewport (reliable in
            //      in-app WebViews where `dvh` collapses to 0 -> grey map).
            //   2. 100svh — stable SMALL viewport fallback before the JS var is
            //      set; more reliable than `dvh` in WebViews and equal to the
            //      visible area on Safari/desktop.
            height: `calc(var(--metravel-map-vh, 100svh) - ${webViewportReservedHeight})`,
            maxHeight: `calc(var(--metravel-map-vh, 100svh) - ${webViewportReservedHeight})`,
            minHeight: 0,
            overflow: 'hidden',
          } as any)
        : null),
      backgroundColor: themedColors.background,
    },
    // #2155 — the panel | map geometry is platform-independent. Native at
    // ≥ 768pt (iPad, Android tablets) takes the desktop branch too; with the
    // row direction only in the web block it stayed a column, the full-height
    // panel took all of it and the map host got 0pt. Only CSS-only keys stay
    // in the web block.
    mapContainer: {
      flex: 1,
      position: 'relative',
      flexDirection: isMobile ? 'column' : 'row',
      columnGap: isMobile ? 0 : PANEL_GAP,
      paddingLeft: isMobile ? 0 : desktopRowPaddingLeft,
      paddingRight: isMobile ? 0 : DESKTOP_SHELL_PADDING + desktopInsets.right,
      paddingTop: isMobile ? 0 : desktopRowPaddingTop,
      paddingBottom: isMobile ? 0 : DESKTOP_SHELL_PADDING - 4 + (isNativeDesktop ? Math.max(0, shellInsets?.dockReserve ?? 0) : 0),
      minHeight: 0,
      minWidth: 0,
      alignItems: 'stretch',
      backgroundColor: themedColors.background,
      ...(Platform.OS === 'web'
        ? ({
            display: 'flex',
            height: '100%',
            isolation: 'isolate',
          } as any)
        : null),
    },
      // #217 — stable host that always wraps the map node so the mobile↔desktop
      // breakpoint flip never re-parents (remounts) Leaflet. On desktop it is the
      // flex sibling to the right of the panel; on mobile it is the full-bleed
      // background under the absolute overlays + bottom sheet.
      mapHost: {
        flex: 1,
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        ...(Platform.OS === 'web'
          ? ({
              display: 'flex',
              height: '100%',
              minHeight: 0,
            } as any)
          : isNativeDesktop
            ? {
                // #2172 — the map card's shadow: `mapArea` clips the WebView
                // (overflow hidden drops an iOS shadow on the same view), so the
                // host draws it. The opaque background lets iOS build the
                // shadow path from the rounded rect instead of the moving map.
                borderRadius: PANEL_RADIUS,
                backgroundColor: themedColors.surface,
                ...nativeCardShadow,
              }
            : null),
      },
      mapArea: {
        flex: 1,
        // #2172 — the desktop-branch map never grows past its host: a 500pt
        // floor pushed it under the tab bar in a short Stage Manager window
        // (native has no clipping container). Web already resets it to 0.
        minHeight: isMobile ? 260 : 0,
        position: 'relative',
        zIndex: 0,
        ...(Platform.OS === 'web'
          ? ({
              isolation: 'isolate',
              display: 'flex',
              height: '100%',
              minHeight: isMobile ? 220 : 0,
              minWidth: 0,
              borderRadius: isMobile ? 0 : PANEL_RADIUS,
              overflow: 'hidden',
              backgroundColor: themedColors.surfaceAlpha40,
              borderWidth: isMobile ? 0 : StyleSheet.hairlineWidth,
              borderColor: themedColors.borderLight,
              boxShadow: isMobile ? 'none' : themedColors.boxShadows.card,
            } as any)
          : isNativeDesktop
            ? {
                // #2172 — same card as web; overflow clips the WebView to the
                // radius (uniform radius → cheap cornerRadius clip on iOS).
                borderRadius: PANEL_RADIUS,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: themedColors.borderLight,
              }
            : null),
      },
      rightPanel: {
        position: isMobile ? 'absolute' : 'relative',
        left: isMobile ? 0 : undefined,
        right: isMobile ? 0 : undefined,
        bottom: isMobile ? (Platform.OS === 'web' ? WEB_MOBILE_DOCK_INSET : 0) : undefined,
        top: isMobile ? undefined : 0,
        width: isMobile ? '100%' : PANEL_WIDTH_DESKTOP,
        maxWidth: isMobile ? '100%' : PANEL_WIDTH_DESKTOP + 40,
        maxHeight: isMobile ? '75vh' : undefined,
        height: isMobile ? undefined : '100%',
        backgroundColor: themedColors.surface,
        minHeight: 0,
        minWidth: 0,
        flexShrink: 0,
        ...(Platform.OS === 'web'
          ? ({
              alignSelf: isMobile ? 'auto' : 'stretch',
              backgroundColor: themedColors.surface,
              boxShadow: isMobile
                ? themedColors.boxShadows.medium
                : themedColors.boxShadows.card,
              // На мобильном живой backdrop-filter поверх скролла убивает GPU —
              // используем статичный фрост (см. CLAUDE.md), блюр только на десктопе.
              ...(isMobile
                ? { backgroundColor: themedColors.surfaceMuted }
                : {
                    backdropFilter: 'blur(20px) saturate(1.05)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
                  }),
              borderTopLeftRadius: isMobile ? 18 : PANEL_RADIUS,
              borderTopRightRadius: isMobile ? 18 : PANEL_RADIUS,
              borderBottomLeftRadius: isMobile ? 0 : PANEL_RADIUS,
              borderBottomRightRadius: isMobile ? 0 : PANEL_RADIUS,
              borderWidth: 1,
              borderColor: themedColors.borderLight,
              overflow: isMobile ? 'hidden' : 'visible',
            } as any)
          : isNativeDesktop
            ? {
                // #2172 — same card as web. No `overflow: 'hidden'`: iOS drops
                // the `shadow*` shadow of a clipping view, so the panel's children
                // round its corners instead. The collapse chevron is a row sibling
                // on native, not a child (`collapseToggleInPanel`). Android draws
                // by elevation first, so it must stay ≥ the map host's.
                borderRadius: PANEL_RADIUS,
                borderWidth: 1,
                borderColor: themedColors.borderLight,
                ...nativeCardShadow,
              }
            : Platform.OS === 'ios'
              ? shadowHeavy
              : { elevation: shadowHeavy.elevation }),
        zIndex: 1000,
        ...(Platform.OS === 'web' && !isMobile
          ? ({
              width: `min(${PANEL_WIDTH_DESKTOP}px, 34vw)`,
              minWidth: PANEL_WIDTH_TABLET,
            } as any)
          : null),
        ...(Platform.OS === 'web' && isMobile
          ? ({
              transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            } as any)
          : null),
      },
      // #1640 — the page H1 lives inside the panel header instead of a
      // full-width band above the map. h3 scale, not h1: at 24px the 49-char
      // title takes three lines in a 320-360px column, which is the same band
      // rotated 90°. Left-aligned on purpose — centring is what made the band
      // read as a banner.
      pageHeadingInPanel: {
        fontSize: 17,
        lineHeight: 22,
        letterSpacing: -0.2,
        fontWeight: '700',
        color: themedColors.text,
        textAlign: 'left',
        marginTop: 0,
        marginBottom: METRICS.spacing.s,
        marginHorizontal: 0,
        width: '100%',
      },
      // Keep one semantic H1 for SEO and assistive technology when the visible
      // desktop panel heading is unavailable, without covering the map canvas.
      pageHeadingVisuallyHidden: webTextStyle({
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }),
      // #1640 — a column so the page H1 can sit above the tab row inside the
      // same surface and the same single hairline border. The row itself moved
      // to `tabsRow`; padding, background and border stay here so the header
      // keeps its previous outer geometry.
      tabsContainer: {
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingTop: isMobile ? Math.max(10, insetTop + 2) : 14,
        paddingBottom: isMobile ? 8 : 10,
        paddingHorizontal: isMobile ? 10 : 12,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.borderLight,
        // #2172 native, #2245 web — the desktop panel does not clip (see
        // rightPanel), so the header rounds the panel's top corners itself.
        ...(isMobile ? null : { borderTopLeftRadius: PANEL_RADIUS, borderTopRightRadius: PANEL_RADIUS }),
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: isMobile ? themedColors.surfaceMuted : themedColors.surface,
              // Статичный фрост на мобильном вместо живого блюра (GPU), см. CLAUDE.md.
              ...(isMobile
                ? null
                : {
                    backdropFilter: 'blur(20px) saturate(1.05)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
                  }),
              boxShadow: '0 1px 0 rgba(15,23,42,0.06)',
            } as any)
          : null),
      },
      // The former `tabsContainer` row. Desktop (#2217): the tab segment is its
      // only child — «Подсказки» moved onto the map, «Сбросить» into the
      // filters footer.
      // #2263 — header keys (tabsRow…badgeText) are read only by the desktop branch.
      tabsRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
      },
      tabsSegment: {
        flexDirection: 'row',
        backgroundColor: themedColors.backgroundSecondary,
        borderRadius: 14,
        padding: 3,
        columnGap: 2,
        alignSelf: 'stretch',
        flex: 1,
        minWidth: 0,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      // Desktop (#2217): a column — the icon row over the label; the three tabs
      // split the segment evenly (`minWidth: 0`), the own 44 box is the target.
      tab: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        paddingHorizontal: 7,
        borderRadius: 11,
        rowGap: 2,
        minWidth: 0,
        minHeight: 44,
      },
      // The icon with the count badge to its right, above the label (#2217).
      tabIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        minHeight: 18,
      },
      tabPressed: {
        opacity: 0.7,
      },
      tabActive: {
        backgroundColor: themedColors.primary,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: `0 3px 12px ${themedColors.primaryAlpha30}, 0 1px 3px rgba(0,0,0,0.06)`,
            } as any)
          : null),
      },
      tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: themedColors.textMuted,
        letterSpacing: 0.15,
        lineHeight: 15,
        textAlign: 'center',
      },
      tabTextActive: {
        color: themedColors.textOnPrimary,
        fontWeight: '700',
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themedColors.surface,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surface,
              borderBottomLeftRadius: isMobile ? 0 : 24,
              borderBottomRightRadius: isMobile ? 0 : 24,
            } as any)
          : isNativeDesktop
            ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
            : null),
      },
      loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themedColors.overlay,
        zIndex: 1002,
      },
      // Desktop floating «Слои» control: a Google-Maps-style round button
      // pinned to the top-right of the map area (NOT over the left panel). Frost
      // surface + shadow, matching the other floating map controls.
      desktopLayersFab: {
        ...desktopMapFab,
        right: DESKTOP_LAYERS_FAB_RIGHT + desktopInsets.right,
      },
      desktopLayersFabActive: {
        backgroundColor: themedColors.surface,
        borderColor: themedColors.primary,
      },
      // Desktop floating «Радиус» control: the same cluster, immediately to the
      // left of «Слои».
      desktopRadiusFab: {
        ...desktopMapFab,
        right: DESKTOP_RADIUS_FAB_RIGHT + desktopInsets.right,
      },
      // #2217 — «Подсказки» left the panel header for the same cluster: second
      // row under «Слои», so the top row keeps two slots (see the cluster note).
      desktopHelpFab: {
        ...desktopMapFab,
        top: desktopMapFab.top + desktopMapFabRowOffset(1),
        right: DESKTOP_LAYERS_FAB_RIGHT + desktopInsets.right,
      },
      desktopRadiusFabActive: {
        backgroundColor: themedColors.surface,
        borderColor: themedColors.primary,
      },
      desktopRadiusFabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: themedColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
      },
      desktopRadiusFabBadgeText: {
        color: themedColors.textOnPrimary,
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
      },
      panelPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      panelPlaceholderText: {
        fontSize: 14,
        color: themedColors.textMuted,
      },
      badge: {
        backgroundColor: themedColors.backgroundSecondary,
        borderRadius: 10,
        minWidth: 18,
        minHeight: 16,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        // Desktop (#2217): the badge sits right of the icon in `tabIconRow`, whose
        // columnGap is the spacing; minHeight lets the scaled count grow.
        marginLeft: 0,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      badgeActive: {
        backgroundColor: themedColors.surfaceAlpha40,
        borderColor: themedColors.borderLight,
      },
      badgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: themedColors.textMuted,
      },
      badgeTextActive: {
        color: themedColors.textOnPrimary,
      },
      collapsedPanel: {
        width: 56,
        flexShrink: 0,
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        paddingHorizontal: 8,
        gap: 10,
        marginTop: 6,
        marginBottom: 6,
        backgroundColor: themedColors.surface,
        borderRadius: PANEL_RADIUS,
        borderWidth: 1,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surface,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: themedColors.boxShadows.card,
            } as any)
          : nativeCardShadow),
      },
      collapseToggle: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceAlpha40,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any)
          : null),
      },
      collapseToggleInPanel: {
        position: 'absolute',
        // Web: a child of the panel, 4px past its right edge. Native (#2172): a
        // sibling of the panel in the row at the same spot — inside the row's
        // bounds, so Android routes the native touch to it, not to the map
        // WebView under a child that sticks out of the panel. The native offsets
        // read the row padding (`desktopRowPaddingLeft/Top`, #2233) plus the native
        // panel width, so a side inset moves the panel and the chevron together.
        // Geometry of the map's top-left corner: `mapDesktopCorner.ts` (#2220).
        ...(Platform.OS === 'web'
          ? { top: corner.COLLAPSE_TOGGLE_TOP, right: -(corner.COLLAPSE_TOGGLE_OUTSET + corner.COLLAPSE_TOGGLE_SIZE) }
          : {
              top: desktopRowPaddingTop + corner.COLLAPSE_TOGGLE_TOP,
              left: desktopRowPaddingLeft + PANEL_WIDTH_DESKTOP + corner.COLLAPSE_TOGGLE_OUTSET,
            }),
        width: corner.COLLAPSE_TOGGLE_SIZE,
        height: corner.COLLAPSE_TOGGLE_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surface,
        borderWidth: 1,
        borderColor: themedColors.border,
        zIndex: 1002,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: themedColors.boxShadows.medium,
              transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
            } as any)
          : nativeCardShadow),
      },
      collapsedIconBtn: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any)
          : null),
      },
      collapsedBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: themedColors.primary,
        borderRadius: 7,
        minWidth: 14,
        height: 14,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
      },
      collapsedBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: themedColors.textOnPrimary,
      },
      resizeHandle: {
        position: 'absolute',
        right: -5,
        top: 0,
        bottom: 0,
        width: 10,
        zIndex: 1003,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'col-resize' } as any)
          : null),
      },
      locationQualityPill: {
        position: 'absolute',
        // #1780 — пилюля тоже целится под ряд кнопок, поэтому её вертикаль
        // читает тот же источник правды, что и баннер, а не свою копию высоты
        // тулбара (было `Math.max(insetTop, 8) + 92`). Позиция не изменилась:
        // getMapToolbarBottom даёт max(insetTop,8)+51, ярус добавляет прежние 41.
        // Ярус СВОЙ, а не MAP_TOOLBAR_STACK_GAP: пилюля и баннер взаимоисключены
        // (пилюля живёт при status === 'current', баннер — при остальных), и
        // держать её ниже баннера — осознанный выбор, а не следствие геометрии.
        // Phone only: the desktop branch puts the pill in the top-row band
        // (`desktopBandQualityPill`, #2220/#2304).
        top: getMapToolbarBottom(insetTop) + MAP_LOCATION_QUALITY_PILL_STACK_OFFSET,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: themedColors.warningSoft,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warning,
        zIndex: 1010,
        ...themedColors.shadows.light,
      },
      locationQualityText: {
        flexShrink: 1, // no `flex` shorthand: see desktopBandQualityPill (#2304)
        fontSize: 12,
        lineHeight: 15,
        fontWeight: '600',
        color: themedColors.text,
      },
      geoBanner: {
        position: 'absolute',
        // The permission state is primary mobile feedback, so keep it directly
        // below the safe-area toolbar (design states 1/3) instead of letting a
        // bottom sheet or browser footer cover it. Desktop retains the compact
        // bottom-left placement.
        // #1780 — высоту ряда кнопок больше НЕ дублируем хардкодом: она объявлена
        // в MapMobileTopOverlay.styles (ряд и баннер живут в разных поддеревьях,
        // см. mapFilterChips.ts). Прежний хардкод 54 оставлял до тач-рамки ряда
        // 3 pt, и на iPhone 16 Pro баннер читался как наложение на кнопки.
        top: isMobile ? getMapToolbarBottom(insetTop) + MAP_TOOLBAR_STACK_GAP : undefined,
        bottom: isMobile ? undefined : 20,
        left: isMobile ? 10 : 16,
        right: isMobile ? 10 : undefined,
        // Desktop: в режиме маршрута рядом с сообщением встают ДВЕ кнопки
        // («Разрешить» + «Указать старт») и текст «Геолокация недоступна»
        // усекался до «Геолокация недо…». 520 даёт запас, чтобы статус читался
        // целиком; вне режима маршрута баннер всё равно ужимается по контенту.
        maxWidth: isMobile ? undefined : 520,
        // #1780 — на мобиле баннер собран в две строки: статус сверху, действия
        // снизу. Инлайновая кнопка съедала 135 pt из 355 (замер на iPhone
        // 13 mini), и текст усекался до «Геолокация недос…». Desktop остаётся
        // одной строкой — там ширины хватает.
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        // Крестик выведен из потока, поэтому высоту баннера он больше НЕ держит.
        // Без ряда действий (status `unavailable` — ни «Повторить», ни «Открыть
        // настройки») в баннере остаётся одна строка ~15dp, и 44dp тач-таргет
        // вместе с видимым кружком вылезал бы за нижний край плашки на карту.
        // Пол высоты повторяет прежнюю высоту баннера с крестиком в потоке.
        minHeight: isMobile ? CONTROL_SIZE + GEO_BANNER_PADDING_VERTICAL_MOBILE * 2 : undefined,
        gap: 6,
        paddingHorizontal: isMobile ? 10 : 14,
        paddingVertical: isMobile ? GEO_BANNER_PADDING_VERTICAL_MOBILE : 9,
        backgroundColor: themedColors.warningSoft,
        borderRadius: isMobile ? 12 : 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warning,
        zIndex: 1010,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.warningSoft,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } as any)
          : themedColors.shadows.medium),
      },
      /**
       * Строка статуса: иконка + текст. На мобиле в ней же прячется место под
       * абсолютный крестик (paddingRight), поэтому он не занимает третью строку.
       */
      geoBannerMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        minWidth: 0,
        flex: isMobile ? undefined : 1,
        paddingRight: isMobile ? 30 : 0,
      },
      /** Ряд действий баннера: на мобиле — вторая строка, на десктопе — инлайн. */
      geoBannerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        flexShrink: 1,
      },
      geoBannerText: {
        // flex:1 + minWidth:0 обязательны: Text без flex в row на native не
        // усекается, а распирает строку и выдавливает кнопку за край.
        flex: 1,
        minWidth: 0,
        fontSize: isMobile ? 12 : 13,
        lineHeight: isMobile ? 15 : undefined,
        fontWeight: '500',
        color: themedColors.text,
      },
      geoBannerActionPrimary: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: isMobile ? 10 : 12,
        borderRadius: isMobile ? 999 : 10,
        backgroundColor: themedColors.warning,
        flexShrink: 1,
        ...webPointerCursor,
      },
      geoBannerActionPrimaryText: {
        color: themedColors.textOnPrimary,
        fontSize: isMobile ? 11 : 12,
        lineHeight: isMobile ? 13 : undefined,
        fontWeight: '700',
      },
      geoBannerActionSecondary: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: isMobile ? 10 : 12,
        borderRadius: isMobile ? 999 : 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.border,
        backgroundColor: themedColors.surface,
        flexShrink: 1,
        ...webPointerCursor,
      },
      geoBannerActionSecondaryText: {
        color: themedColors.text,
        fontSize: isMobile ? 11 : 12,
        lineHeight: isMobile ? 13 : undefined,
        fontWeight: '700',
      },
      // Прозрачная рамка тач-таргета вокруг видимого кружка 22/24dp: строка
      // баннера обтягивала крестик, поэтому `hitSlop` до пальца не доходил
      // (#1274). Строку это не растит — кнопки действий рядом уже 44dp.
      geoBannerClose: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        // #1780 — на мобиле баннер стал двухстрочным, и крестик в потоке уехал бы
        // третьей строкой. Абсолютная позиция держит его в правом верхнем углу и
        // не растит высоту; место под него резервирует geoBannerMain.paddingRight,
        // а тач-таргет целиком укладывается в minHeight баннера.
        ...(isMobile
          ? ({ position: 'absolute' as const, right: 2, top: 0 })
          : null),
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' } as any)
          : null),
      },
      /** Видимый кружок крестика — размер прежний. */
      geoBannerCloseShape: {
        width: isMobile ? 22 : 24,
        height: isMobile ? 22 : 24,
        borderRadius: isMobile ? 11 : 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.backgroundSecondary,
      },
  });
};

// Expo Router treats *.ts files under app/ as routes. Provide a harmless default export
// so the route loader stays satisfied while the styles remain importable.
export default function MapStylesPlaceholder() {
  return null;
}
