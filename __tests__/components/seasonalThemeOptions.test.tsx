import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import featherGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';
import { SEASONAL_THEME_IDS } from '@/constants/seasonalThemes';
import { fireEvent, render } from '@testing-library/react-native';
import ThemeSection from '@/components/settings/ThemeSection';
import { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { getThemedColors } from '@/constants/designSystem';
import { Platform } from 'react-native';

describe('seasonal theme icons', () => {
  const originalPlatform = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });
  it('renders every preference with a supported Feather glyph on web', () => {
    const options = getSeasonalThemeOptions();
    expect(options.map(({ value }) => value)).toEqual(['auto', 'off', ...SEASONAL_THEME_IDS]);
    for (const option of options) {
      const icon = option.renderIcon(20, 'currentColor') as React.ReactElement<{ name: string }>;
      expect(icon.type).toBe(Feather);
      expect(featherGlyphs).toHaveProperty(icon.props.name);
    }
  });

  it.each(['web', 'android', 'ios'])('exposes exactly one checked radio in %s settings and updates it after selection', async platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    const options = getSeasonalThemeOptions();
    const colors = getThemedColors(false);
    const setTheme = jest.fn();
    const draw = (theme: 'auto' | 'easter') => (
      <ThemeSection
        styles={createSettingsStyles(colors)}
        colors={colors}
        theme={theme}
        setTheme={setTheme}
        themeOptions={options}
      />
    );
    const view = await render(draw('auto'));
    expect(view.getAllByRole('radio')).toHaveLength(7);
    expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(view.getByRole('radio', { checked: true }).props.accessibilityLabel).toBe(options[0].label);
    await fireEvent.press(view.getByRole('radio', { name: options.find(option => option.value === 'easter')!.label }));
    expect(setTheme).toHaveBeenCalledWith('easter');
    await view.rerender(draw('easter'));
    expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(view.getByRole('radio', { checked: true }).props.accessibilityLabel).toBe(options.find(option => option.value === 'easter')!.label);
  });
});
