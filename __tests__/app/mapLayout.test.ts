import { Platform, StyleSheet } from 'react-native';

import { getStyles } from '@/app/(tabs)/map.styles';
import { METRICS } from '@/constants/layout';

describe('map layout header offset', () => {
  const originalOS = Platform.OS;

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
    const styles = getStyles(false, 0, headerOffset);

    expect(styles.container.paddingTop).toBe(0);
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
    const styles = getStyles(true, insetTop, headerOffset);

    // For mobile web: header offset handled by DOM, only inset applies
    expect(styles.tabsContainer.paddingTop).toBe(insetTop + 6);
    expect(styles.container.paddingTop).toBe(0);

    // Mobile overlay / panel transitions
    expect(styles.rightPanelMobileClosed.transform?.[0].translateX).toBe(400);
    expect(styles.rightPanelMobileClosed.opacity).toBe(0);
    expect(styles.rightPanelMobileOpen.opacity).toBe(1);
  });
});
