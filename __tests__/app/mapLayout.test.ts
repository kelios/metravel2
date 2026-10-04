import { Platform, StyleSheet } from 'react-native';

import { getStyles } from '@/screens/tabs/map.styles';
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
    expect(styles.overlay.top).toBe(0);
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
