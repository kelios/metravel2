import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import featherGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';

describe('seasonal theme icons', () => {
  it('renders every preference with a supported Feather glyph on web', () => {
    const options = getSeasonalThemeOptions();
    expect(options.map(({ value }) => value)).toEqual(['auto', 'off', 'halloween', 'christmas']);
    for (const option of options) {
      const icon = option.renderIcon(20, 'currentColor') as React.ReactElement<{ name: string }>;
      expect(icon.type).toBe(Feather);
      expect(featherGlyphs).toHaveProperty(icon.props.name);
    }
  });
});
