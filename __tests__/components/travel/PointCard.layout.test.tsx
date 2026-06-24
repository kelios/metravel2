import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import PointCard from '@/components/travel/PointCard';
import { createPointListStyles } from '@/components/travel/PointList.styles';
import { getThemedColors } from '@/hooks/useTheme';

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="mock-image-card-media" {...props} />;
  },
}));

describe('travel PointCard native layout', () => {
  const colors = getThemedColors();
  const styles = createPointListStyles(colors);
  const noop = jest.fn();

  it('keeps the add-to-my-points action inside the overlay flow with map chips', () => {
    render(
      <PointCard
        point={{
          address:
            'Глубокое озеро, Большое Ситно, Малоситнянский сельский Совет, Полоцкий район, Витебская область',
          coord: '55.6949836,29.4528694',
        }}
        categoryLabel="Озеро"
        colors={{
          textOnDark: colors.textOnDark,
          textOnPrimary: colors.textOnPrimary,
        }}
        imageUrl="https://example.com/point.jpg"
        isMobile
        onAddPoint={noop}
        onCopy={noop}
        onOpenMap={noop}
        onShare={noop}
        responsive={{
          coordSize: 12,
          imageMinHeight: 240,
          titleSize: 14,
        }}
        styles={styles}
      />
    );

    const overlay = screen.getByTestId('travel-point-card-overlay');
    const imageWrapStyle = StyleSheet.flatten(screen.getByTestId('travel-point-card-image-wrap').props.style);

    expect(overlay.findByProps({ accessibilityLabel: 'Мои точки' })).toBeTruthy();
    // PointNavigationMenu renders a collapsed toggle by default; individual map app
    // buttons are only visible after user expands the menu. Assert the toggle is present.
    expect(overlay.findByProps({ accessibilityLabel: 'Открыть в навигаторе' })).toBeTruthy();
    expect(screen.getByText(/Глубокое озеро/)).toBeTruthy();
    expect(imageWrapStyle.height).toBe(320);
  });
});
