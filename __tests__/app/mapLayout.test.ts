import { Platform, StyleSheet } from 'react-native';

import {
  DESKTOP_MAP_FAB_TOP_ROW_SLOTS,
  MAP_PANEL_TAB_CONTENT_WIDTH,
  MAP_PANEL_TAB_COUNT,
  MAP_PANEL_TAB_WIDTH_RESERVE,
  getDesktopBranchTopInset,
  getStyles,
} from '@/screens/tabs/map.styles';
import { METRICS } from '@/constants/layout';

describe('map layout header offset', () => {
  const originalOS = Platform.OS;
  const themedColors: any = {
    primary: '#000000',
    primaryDark: '#000000',
    primaryLight: '#000000',
    text: '#000000',
    textMuted: '#666666',
    textInverse: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceLight: '#f5f5f5',
    surfaceMuted: '#f5f5f5',
    surfaceElevated: '#ffffff',
    border: '#e5e5e5',
    overlay: 'rgba(0,0,0,0.35)',
    shadows: {
      light: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
      medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    },
    boxShadows: {
      light: '0 2px 6px rgba(0,0,0,0.08)',
      medium: '0 6px 16px rgba(0,0,0,0.12)',
      modal: '0 10px 30px rgba(0,0,0,0.18)',
    },
  };

  beforeAll(() => {
    // Ensure StyleSheet returns plain objects in tests
    jest.spyOn(StyleSheet, 'create').mockImplementation((styles) => styles as any);
  });

  afterAll(() => {
    (StyleSheet.create as jest.Mock).mockRestore?.();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('does not add header offset on web (desktop layout handled by DOM flow)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    const styles = getStyles(false, 0, themedColors);

    expect(styles.container.paddingTop ?? 0).toBe(0);
    expect(styles.rightPanel.top).toBe(0);
    // tabsContainer only has base padding without header offset
    expect(styles.tabsContainer.paddingTop).toBe(14);

    // right panel uses tokenized widths (min string on web)
    expect(styles.rightPanel.width).toBe(`min(${METRICS.baseUnit * 45}px, 34vw)`);
    expect(styles.rightPanel.maxWidth).toBe(METRICS.baseUnit * 45 + 40);
    // gap between map and panel on desktop
    expect(styles.mapContainer.columnGap).toBe(METRICS.spacing.m);
    expect(styles.container.height).toBe('calc(var(--metravel-map-vh, 100svh) - 88px)');
  });

  it('does not add header offset on web for mobile layout', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    const insetTop = 12;
    const styles = getStyles(true, insetTop, themedColors);

    // For mobile web: header offset handled by DOM, only inset applies
    // Math.max(10, insetTop + 2) = Math.max(10, 14) = 14
    expect(styles.tabsContainer.paddingTop).toBe(Math.max(10, insetTop + 2));
    expect(styles.container.paddingTop ?? 0).toBe(0);
    expect(styles.container.height).toBe(
      'calc(var(--metravel-map-vh, 100svh) - var(--mt-dock-h, 0px))',
    );
  });
});

// #2155 — native at ≥ 768pt (iPad 820/1180, Android tablets) takes the desktop
// branch. The panel | map row used to live only in the web block, so native kept
// a column: the full-height panel took all of it and the map host got 0pt.
describe('map shell geometry is platform-independent (#2155)', () => {
  const originalOS = Platform.OS;
  const themedColors: any = {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f5',
    surfaceAlpha40: 'rgba(255,255,255,0.4)',
    borderLight: '#eeeeee',
    overlay: 'rgba(0,0,0,0.35)',
    shadows: {
      medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    },
    boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
  };

  beforeAll(() => {
    jest.spyOn(StyleSheet, 'create').mockImplementation((styles) => styles as any);
  });

  afterAll(() => {
    (StyleSheet.create as jest.Mock).mockRestore?.();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it.each(['ios', 'android'])('%s tablet width: panel and map share one row', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(false, 0, themedColors);

    expect(styles.mapContainer.flexDirection).toBe('row');
    expect(styles.mapContainer.columnGap).toBe(METRICS.spacing.m);
    expect(styles.mapContainer.alignItems).toBe('stretch');
    expect(styles.rightPanel.width).toBe(METRICS.baseUnit * 45);
    expect(styles.rightPanel.position).toBe('relative');
    expect(styles.rightPanel.flexShrink).toBe(0);
    expect(styles.mapHost.flex).toBe(1);
    expect(styles.mapHost.minWidth).toBe(0);
    // Shell paddings + gap stay within the 48pt budget of the card.
    const horizontal =
      styles.mapContainer.paddingLeft + styles.mapContainer.paddingRight + styles.mapContainer.columnGap;
    expect(horizontal).toBeLessThanOrEqual(48);
  });

  it.each(['ios', 'android'])('%s phone width: map is full-bleed, panel absolute', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(true, 0, themedColors);

    // Exact set: a future key leaking into the iPhone shell fails here.
    expect(styles.mapContainer).toEqual({
      flex: 1,
      position: 'relative',
      flexDirection: 'column',
      columnGap: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: 0,
      minWidth: 0,
      alignItems: 'stretch',
      backgroundColor: '#ffffff',
    });
    expect(styles.rightPanel.position).toBe('absolute');
  });

  it('web keeps the same shell values for desktop and mobile', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    expect(getStyles(false, 0, themedColors).mapContainer).toEqual({
      flex: 1,
      position: 'relative',
      flexDirection: 'row',
      columnGap: 16,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
      minHeight: 0,
      minWidth: 0,
      alignItems: 'stretch',
      backgroundColor: '#ffffff',
      display: 'flex',
      height: '100%',
      isolation: 'isolate',
    });
    expect(getStyles(true, 0, themedColors).mapContainer).toEqual({
      flex: 1,
      position: 'relative',
      flexDirection: 'column',
      columnGap: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: 0,
      minWidth: 0,
      alignItems: 'stretch',
      backgroundColor: '#ffffff',
      display: 'flex',
      height: '100%',
      isolation: 'isolate',
    });
  });
});

// #2172 — the desktop branch (width ≥ 768) is one card model on every platform:
// iPad and Android tablets get the web cards (radius, border, shadow by the
// native engine) and a map that never grows past its host. Web stays exact.
describe('desktop-branch cards on native tablets (#2172)', () => {
  const originalOS = Platform.OS;
  const themedColors: any = {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f5',
    surfaceAlpha40: 'rgba(255,255,255,0.4)',
    borderLight: '#eeeeee',
    border: '#e5e5e5',
    overlay: 'rgba(0,0,0,0.35)',
    primary: '#000000',
    textOnPrimary: '#ffffff',
    shadows: {
      light: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
      medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    },
    boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
  };

  beforeAll(() => {
    jest.spyOn(StyleSheet, 'create').mockImplementation((styles) => styles as any);
  });

  afterAll(() => {
    (StyleSheet.create as jest.Mock).mockRestore?.();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it.each(['ios', 'android'])('%s tablet: the map card never grows past its host', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(false, 0, themedColors);

    // A 500pt floor pushed the map under the tab bar in a short Stage Manager window.
    expect(styles.mapArea.minHeight).toBe(0);
    expect(styles.mapArea.borderRadius).toBe(20);
    expect(styles.mapArea.overflow).toBe('hidden');
    expect(styles.mapHost.borderRadius).toBe(20);
    expect(styles.mapHost.backgroundColor).toBe('#ffffff');
  });

  it.each(['ios', 'android'])('%s tablet: the collapse chevron sits beside the panel inside the row, above the map', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(false, 0, themedColors);

    // A row sibling at the panel's right edge, never sticking out of its parent:
    // Android routes the native touch by parent bounds, so a chevron past the
    // panel edge also tapped the map WebView under it (#2113 device QA).
    expect(styles.collapseToggleInPanel.right).toBeUndefined();
    expect(styles.collapseToggleInPanel.left).toBe(16 + METRICS.baseUnit * 45 + 4);
    expect(styles.collapseToggleInPanel.top).toBe(12 + 16);
    expect(styles.collapseToggleInPanel.zIndex).toBeGreaterThan(styles.rightPanel.zIndex);
    // Android orders touch dispatch and drawing by elevation before zIndex: the
    // panel and the chevron must not sink under the map host.
    expect(styles.rightPanel.elevation ?? 0).toBeGreaterThanOrEqual(styles.mapHost.elevation ?? 0);
    expect(styles.collapseToggleInPanel.elevation ?? 0).toBeGreaterThanOrEqual(styles.mapHost.elevation ?? 0);
    // The panel keeps its own shadow, so it does not clip (iOS drops the shadow
    // of a clipping view); its children round the corners instead.
    expect(styles.rightPanel.overflow).toBeUndefined();
    expect(styles.rightPanel.borderRadius).toBe(20);
  });

  it.each(['ios', 'android'])('%s phone: the map floor and the sheet keep their values', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(true, 0, themedColors);

    expect(styles.mapArea).toEqual({ flex: 1, minHeight: 260, position: 'relative', zIndex: 0 });
    expect(styles.mapHost).toEqual({ flex: 1, position: 'relative', minWidth: 0, minHeight: 0 });
    expect(styles.rightPanel.elevation).toBe(themedColors.shadows.heavy.elevation);
    expect(styles.rightPanel.borderRadius).toBeUndefined();
  });

  it.each(['ios', 'android'])('%s tablet clears the status bar itself; web and phones do not take the inset', (os) => {
    const STATUS_BAR = 24;
    Object.defineProperty(Platform, 'OS', { value: os });
    const tablet = getStyles(false, STATUS_BAR, themedColors);
    expect(tablet.mapContainer.paddingTop).toBe(12 + STATUS_BAR);
    expect(tablet.desktopLayersFab.top).toBe(16 + STATUS_BAR);
    expect(tablet.desktopRadiusFab.top).toBe(16 + STATUS_BAR);
    expect(tablet.collapseToggleInPanel.top).toBe(12 + STATUS_BAR + 16);
    expect(getDesktopBranchTopInset(STATUS_BAR)).toBe(STATUS_BAR);
    // Phones own their inset in the sheet/top overlay layer.
    expect(getStyles(true, STATUS_BAR, themedColors).mapContainer.paddingTop).toBe(0);

    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const web = getStyles(false, STATUS_BAR, themedColors);
    expect(web.mapContainer.paddingTop).toBe(12);
    expect(web.desktopLayersFab.top).toBe(16);
    expect(getDesktopBranchTopInset(STATUS_BAR)).toBe(0);
  });

  // #2217 — the top row of the on-map cluster shares its band with the centred
  // «Искать в этой области» pill: on a 768–925 px window a third slot reaches
  // under the pill's right end and takes its clicks. A new control goes down the
  // map edge, not left along the row.
  it.each(['web', 'ios'])('%s: the top row of the on-map cluster holds two controls, «Подсказки» sits under «Слои»', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    const styles: Record<string, any> = getStyles(false, 0, themedColors);
    const topRowTop = styles.desktopLayersFab.top;
    const topRow = Object.keys(styles)
      .filter((key) => /^desktop[A-Za-z]*Fab$/.test(key) && styles[key].top === topRowTop)
      .sort();

    expect(topRow).toEqual(['desktopLayersFab', 'desktopRadiusFab']);
    expect(topRow.length).toBeLessThanOrEqual(DESKTOP_MAP_FAB_TOP_ROW_SLOTS);
    expect(styles.desktopHelpFab.right).toBe(styles.desktopLayersFab.right);
    expect(styles.desktopHelpFab.top).toBe(topRowTop + 44 + 8);
  });

  it('web keeps the exact panel and map card styles', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
  const WEB_DESKTOP = {
    mapArea: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
      zIndex: 0,
      isolation: 'isolate',
      display: 'flex',
      height: '100%',
      minWidth: 0,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#eeeeee',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    rightPanel: {
      position: 'relative',
      top: 0,
      width: 'min(360px, 34vw)',
      maxWidth: 400,
      height: '100%',
      backgroundColor: '#ffffff',
      minHeight: 0,
      minWidth: 320,
      flexShrink: 0,
      alignSelf: 'stretch',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(20px) saturate(1.05)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      borderWidth: 1,
      borderColor: '#eeeeee',
      overflow: 'visible',
      zIndex: 1000,
    },
    collapseToggleInPanel: {
      position: 'absolute',
      top: 16,
      right: -48,
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e5e5',
      zIndex: 1002,
      cursor: 'pointer',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
      transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
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
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#eeeeee',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    // #2245 — the panel does not clip on desktop, so the header rounds the
    // panel's top corners itself (radius = PANEL_RADIUS).
    tabsContainer: {
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingTop: 14,
      paddingBottom: 10,
      paddingHorizontal: 12,
      backgroundColor: '#ffffff',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#eeeeee',
      backdropFilter: 'blur(20px) saturate(1.05)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      boxShadow: '0 1px 0 rgba(15,23,42,0.06)',
    },
    panelContent: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    mapHost: {
      flex: 1,
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      height: '100%',
    },
  };

  const WEB_MOBILE = {
    mapArea: {
      flex: 1,
      minHeight: 220,
      position: 'relative',
      zIndex: 0,
      isolation: 'isolate',
      display: 'flex',
      height: '100%',
      minWidth: 0,
      borderRadius: 0,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: 0,
      borderColor: '#eeeeee',
      boxShadow: 'none',
    },
    rightPanel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 'var(--mt-dock-h, 0px)',
      width: '100%',
      maxWidth: '100%',
      maxHeight: '75vh',
      backgroundColor: '#f5f5f5',
      minHeight: 0,
      minWidth: 0,
      flexShrink: 0,
      alignSelf: 'auto',
      boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 1,
      borderColor: '#eeeeee',
      overflow: 'hidden',
      zIndex: 1000,
      transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    collapseToggleInPanel: {
      position: 'absolute',
      top: 16,
      right: -48,
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e5e5',
      zIndex: 1002,
      cursor: 'pointer',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
      transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
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
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#eeeeee',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    // The phone sheet clips its children itself: no header radii.
    tabsContainer: {
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 10,
      backgroundColor: '#f5f5f5',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#eeeeee',
      boxShadow: '0 1px 0 rgba(15,23,42,0.06)',
    },
    panelContent: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    mapHost: {
      flex: 1,
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      height: '100%',
    },
  };

    const pick = (styles: any) => ({
      mapArea: styles.mapArea,
      rightPanel: styles.rightPanel,
      collapseToggleInPanel: styles.collapseToggleInPanel,
      collapsedPanel: styles.collapsedPanel,
      tabsContainer: styles.tabsContainer,
      panelContent: styles.panelContent,
      mapHost: styles.mapHost,
    });
    expect(pick(getStyles(false, 0, themedColors))).toEqual(WEB_DESKTOP);
    expect(pick(getStyles(true, 0, themedColors))).toEqual(WEB_MOBILE);
  });

  // #2263 — the panel-header keys are read only by `MapPanelHeader`, which only
  // the desktop branch renders (`isMobile === false`): a phone value there is
  // dead code that reads like live behaviour.
  it.each(['web', 'ios', 'android'])('%s: panel-header keys do not depend on isMobile', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    const desktop: Record<string, any> = getStyles(false, 0, themedColors);
    const phone: Record<string, any> = getStyles(true, 0, themedColors);
    for (const key of ['tabsRow', 'tabsSegment', 'tab', 'tabText', 'badge', 'badgeText']) {
      expect({ key, style: phone[key] }).toEqual({ key, style: desktop[key] });
    }
  });

  // #2245 (MAP-PANEL-UNCLIPPED-CORNERS-001) — a panel that does not clip its
  // children only rounds its own background: an edge child with its own fill
  // (the header on top, `panelContent` at the bottom) paints square corners over
  // the page unless it carries radii at least as large as the panel's.
  it.each([
    ['web', false],
    ['web', true],
    ['ios', false],
    ['android', false],
  ] as const)('%s (isMobile=%s): an unclipped panel has its corners rounded by the edge children', (os, isMobile) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    const styles: Record<string, any> = getStyles(isMobile, 0, themedColors);
    const panel = styles.rightPanel;
    if (panel.overflow === 'hidden') return;

    const radius = (style: any, corner: string) => style[corner] ?? style.borderRadius ?? 0;
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius']) {
      expect(radius(panel, corner)).toBeGreaterThan(0);
      expect(radius(styles.tabsContainer, corner)).toBeGreaterThanOrEqual(radius(panel, corner));
    }
    for (const corner of ['borderBottomLeftRadius', 'borderBottomRightRadius']) {
      expect(radius(styles.panelContent, corner)).toBeGreaterThanOrEqual(radius(panel, corner));
    }
  });
});

// #2217 — the desktop-branch panel header row belongs to the tabs only. One
// tab's share of the narrowest panel each platform renders, computed from the
// styles that build the row, must hold the widest tab content of all five
// languages with «999+» plus the reserve (norms next to the styles,
// docs/design/map-panel-header-tablet.md). Before #2217 three header actions
// (161 px) shared this row and the tab got (panel − 207) / 2 — 56.5 at 320.
describe('map panel header: tab width budget (#2217)', () => {
  const originalOS = Platform.OS;
  const themedColors: any = {
    background: '#ffffff',
    backgroundSecondary: '#f7f7f7',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f5',
    surfaceAlpha40: 'rgba(255,255,255,0.25)',
    borderLight: '#eeeeee',
    border: '#e5e5e5',
    overlay: 'rgba(0,0,0,0.35)',
    primary: '#000000',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    shadows: {
      light: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
      medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    },
    boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
  };

  // A hairline is 1 CSS px on web (react-native-web) and one physical pixel on
  // native — never wider than 1 pt; the budget takes the widest.
  const drawn = (borderWidth: unknown) =>
    borderWidth === StyleSheet.hairlineWidth ? 1 : Number(borderWidth);

  // Panel border, header side paddings, segment hairline and padding, the gaps
  // between the tabs: what is left, split evenly between the tabs.
  const tabShare = (styles: any, panelWidth: number) => {
    const segment = styles.tabsSegment;
    const inner =
      panelWidth -
      2 * drawn(styles.rightPanel.borderWidth) -
      2 * Number(styles.tabsContainer.paddingHorizontal) -
      2 * drawn(segment.borderWidth) -
      2 * Number(segment.padding) -
      (MAP_PANEL_TAB_COUNT - 1) * Number(segment.columnGap);
    return inner / MAP_PANEL_TAB_COUNT;
  };

  // The widest tab with its own side paddings, plus the reserve.
  const required = (styles: any) =>
    MAP_PANEL_TAB_CONTENT_WIDTH + 2 * Number(styles.tab.paddingHorizontal) + MAP_PANEL_TAB_WIDTH_RESERVE;

  beforeAll(() => {
    jest.spyOn(StyleSheet, 'create').mockImplementation((styles) => styles as any);
  });

  afterAll(() => {
    (StyleSheet.create as jest.Mock).mockRestore?.();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('web: the narrowest panel (rightPanel.minWidth) holds the widest tab with the reserve', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const styles = getStyles(false, 0, themedColors);
    const narrowest = Number(styles.rightPanel.minWidth);

    expect(narrowest).toBe(320);
    // (320 − 38) / 3 — the design doc's «минимум 320: 94,0».
    expect(tabShare(styles, narrowest)).toBeCloseTo(94, 5);
    expect(tabShare(styles, narrowest)).toBeGreaterThanOrEqual(required(styles));
  });

  it.each(['ios', 'android'])('%s: the 360 pt tablet panel holds the widest tab with the reserve', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    const styles = getStyles(false, 0, themedColors);
    const panel = Number(styles.rightPanel.width);

    expect(panel).toBe(360);
    expect(tabShare(styles, panel)).toBeGreaterThanOrEqual(required(styles));
  });

  it.each(['web', 'ios', 'android'])('%s: the row is the segment alone; the tab is a 44 column', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    const styles = getStyles(false, 0, themedColors);

    expect(styles.tabsRow.columnGap).toBeUndefined();
    expect(styles.tabsSegment.flex).toBe(1);
    expect(styles.tab).toMatchObject({
      flex: 1,
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 44,
      paddingHorizontal: 7,
    });
    expect(styles.tabIconRow.flexDirection).toBe('row');
    expect(styles.badge.marginLeft).toBe(0);
    // The header actions are gone with their readers.
    for (const key of ['panelHeaderActions', 'resetButton', 'resetButtonCompact', 'resetButtonLabel', 'tabIconBubble', 'tabIconBubbleActive']) {
      expect(styles).not.toHaveProperty(key);
    }
  });
});
