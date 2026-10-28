import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { SEASONAL_THEME_IDS } from '@/constants/seasonalThemes';
import { getSeasonalThemePalette } from '@/constants/seasonalThemePalettes';
import NativeDecoration from '@/components/layout/SeasonalThemeDecoration.native';
import WebDecoration from '@/components/layout/SeasonalThemeDecoration.web';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn() }));

describe('native seasonal header decoration', () => {
  it.each(SEASONAL_THEME_IDS)('bounds the %s motif and excludes it from interaction/accessibility', async season => {
    (useTheme as jest.Mock).mockReturnValue({ activeSeasonalTheme: season, isDark: false });
    const view = await render(<NativeDecoration />);
    const layer = view.getByTestId('seasonal-theme-decoration', { includeHiddenElements: true });
    expect(layer.props).toMatchObject({
      pointerEvents: 'none',
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ ...StyleSheet.absoluteFill, overflow: 'hidden' });
    expect(view.getByTestId(`seasonal-motif-${season}`, { includeHiddenElements: true })).toBeTruthy();
    for (const other of SEASONAL_THEME_IDS.filter(value => value !== season)) {
      expect(view.queryByTestId(`seasonal-motif-${other}`, { includeHiddenElements: true })).toBeNull();
    }
  });

  it.each(SEASONAL_THEME_IDS)('updates the %s scene colors with dark mode', async season => {
    (useTheme as jest.Mock).mockReturnValue({ activeSeasonalTheme: season, isDark: false });
    const view = await render(<NativeDecoration />);
    const light = getSeasonalThemePalette(season, false)!;
    expect(JSON.stringify(view.toJSON())).toContain(light.sceneJewel);
    expect(JSON.stringify(view.toJSON())).toContain(light.sceneWordmark);
    (useTheme as jest.Mock).mockReturnValue({ activeSeasonalTheme: season, isDark: true });
    await view.rerender(<NativeDecoration />);
    const dark = getSeasonalThemePalette(season, true)!;
    expect(JSON.stringify(view.toJSON())).toContain(dark.sceneJewel);
    expect(JSON.stringify(view.toJSON())).toContain(dark.sceneWordmark);
  });

  it('disappears when there is no active season', async () => {
    (useTheme as jest.Mock).mockReturnValue({ activeSeasonalTheme: null, isDark: false });
    expect(await (await render(<NativeDecoration />)).toJSON()).toBeNull();
  });

  it('leaves web decoration under existing CSS ownership', async () => {
    expect(await (await render(<WebDecoration />)).toJSON()).toBeNull();
  });
});
