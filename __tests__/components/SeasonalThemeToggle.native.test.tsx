import { fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { SEASONAL_THEME_IDS } from '@/constants/seasonalThemes';
import SeasonalThemeToggle from '@/components/layout/SeasonalThemeToggle';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';
import { i18n } from '@/i18n';

jest.mock('@/hooks/useTheme', () => {
  const { getThemedColors } = require('@/constants/designSystem');
  return { useTheme: jest.fn(), useThemedColors: () => getThemedColors(false) };
});

describe.each(['android', 'ios'])('seasonal menu on %s', platform => {
  const originalPlatform = Platform.OS;
  const setSeasonalTheme = jest.fn();

  beforeEach(() => {
    setSeasonalTheme.mockClear();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    (useTheme as jest.Mock).mockReturnValue({ seasonalTheme: 'auto', setSeasonalTheme, seasonalCalendar: null });
  });

  afterEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    await i18n.changeLanguage('ru');
  });

  it('exposes all seven choices with exactly one checked radio and accepts each choice', async () => {
    const view = await render(<SeasonalThemeToggle compact />);
    expect(view.getAllByRole('radio')).toHaveLength(7);
    expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1);

    for (const preference of ['auto', 'off', ...SEASONAL_THEME_IDS]) {
      await fireEvent.press(view.getByTestId(`seasonal-theme-toggle-${preference}`));
      expect(setSeasonalTheme).toHaveBeenLastCalledWith(preference);
      (useTheme as jest.Mock).mockReturnValue({ seasonalTheme: preference, setSeasonalTheme, seasonalCalendar: null });
      await view.rerender(<SeasonalThemeToggle compact />);
      expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1);
      expect(view.getByTestId(`seasonal-theme-toggle-${preference}`).props.accessibilityState.checked).toBe(true);
    }
  });

  it.each(['ru', 'be', 'uk', 'pl', 'en'])('keeps %s labels and 44dp targets in a wrapping row', async locale => {
    await i18n.changeLanguage(locale);
    const view = await render(<SeasonalThemeToggle compact layout="horizontal" showLabels />);
    expect(StyleSheet.flatten(view.getByTestId('seasonal-theme-toggle').props.style)).toMatchObject({ flexWrap: 'wrap' });
    for (const option of getSeasonalThemeOptions()) {
      expect(view.getByText(option.label)).toBeTruthy();
      expect(StyleSheet.flatten(view.getByTestId(`seasonal-theme-toggle-${option.value}`).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
