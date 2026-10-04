import { Platform, StyleSheet } from 'react-native';

import { getDesktopBranchTopInset, getStyles } from '@/screens/tabs/map.styles';
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

  it.each(['ios', 'android'])('%s tablet: the panel never clips, so the collapse chevron past its edge stays tappable', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });

    const styles = getStyles(false, 0, themedColors);

    expect(styles.rightPanel.overflow).toBeUndefined();
    expect(styles.collapseToggleInPanel.right).toBeLessThan(0);
    expect(styles.rightPanel.borderRadius).toBe(20);
    // Android draws siblings by elevation before zIndex: the panel (and its
    // chevron) must not sink under the map host.
    expect(styles.rightPanel.elevation ?? 0).toBeGreaterThanOrEqual(styles.mapHost.elevation ?? 0);
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
    expect(getDesktopBranchTopInset(STATUS_BAR)).toBe(STATUS_BAR);
    // Phones own their inset in the sheet/top overlay layer.
    expect(getStyles(true, STATUS_BAR, themedColors).mapContainer.paddingTop).toBe(0);

    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const web = getStyles(false, STATUS_BAR, themedColors);
    expect(web.mapContainer.paddingTop).toBe(12);
    expect(web.desktopLayersFab.top).toBe(16);
    expect(getDesktopBranchTopInset(STATUS_BAR)).toBe(0);
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
      panelContent: styles.panelContent,
      mapHost: styles.mapHost,
    });
    expect(pick(getStyles(false, 0, themedColors))).toEqual(WEB_DESKTOP);
    expect(pick(getStyles(true, 0, themedColors))).toEqual(WEB_MOBILE);
  });
});
