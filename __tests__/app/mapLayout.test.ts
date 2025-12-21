import { Platform, StyleSheet } from 'react-native';

import { getStyles } from '@/app/(tabs)/map.styles';

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

  it('applies header offset on web for desktop layout', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    const headerOffset = 88;
    const styles = getStyles(false, 0, headerOffset);

    expect(styles.container.paddingTop).toBe(headerOffset);
    expect(styles.rightPanel.top).toBe(headerOffset);
    expect(styles.overlay.top).toBe(headerOffset);
    // tabsContainer adds base 8px + headerOffset when not mobile
    expect(styles.tabsContainer.paddingTop).toBe(8 + headerOffset);
  });

  it('applies header offset with inset on web for mobile layout', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    const headerOffset = 88;
    const insetTop = 12;
    const styles = getStyles(true, insetTop, headerOffset);

    // For mobile: paddingTop = insetTop + 6 + headerOffset
    expect(styles.tabsContainer.paddingTop).toBe(insetTop + 6 + headerOffset);
    expect(styles.container.paddingTop).toBe(headerOffset);
  });
});
