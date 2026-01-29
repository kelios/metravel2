import { Platform, StyleSheet } from 'react-native';

import { getStyles } from '@/src/screens/tabs/map.styles';
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

    const headerOffset = 88;
    const styles = getStyles(false, 0, headerOffset, 1280, themedColors);

    expect(styles.container.paddingTop ?? 0).toBe(0);
    expect(styles.rightPanel.top).toBe(0);
    expect(styles.overlay.top).toBe(0);
    // tabsContainer only has base padding without header offset
    expect(styles.tabsContainer.paddingTop).toBe(8);

    // right panel uses tokenized widths (min string on web)
    expect(styles.rightPanel.width).toBe(`min(${METRICS.baseUnit * 48}px, 35vw)`);
    expect(styles.rightPanel.maxWidth).toBe(METRICS.baseUnit * 48 + 40);
    // gap between map and panel on desktop
    expect(styles.content.columnGap).toBe(METRICS.spacing.m);
  });

  it('does not add header offset on web for mobile layout', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    const headerOffset = 88;
    const insetTop = 12;
    const styles = getStyles(true, insetTop, headerOffset, 360, themedColors);

    // For mobile web: header offset handled by DOM, only inset applies
    expect(styles.tabsContainer.paddingTop).toBe(insetTop + 6);
    expect(styles.container.paddingTop ?? 0).toBe(0);

    // Mobile overlay / panel transitions
    expect(styles.rightPanelMobileClosed.transform?.[0].translateY).toBe('100%');
    expect(styles.rightPanelMobileClosed.opacity).toBe(0);
    expect(styles.rightPanelMobileOpen.opacity).toBe(1);
  });
});
