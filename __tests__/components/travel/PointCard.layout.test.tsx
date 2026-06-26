import { fireEvent, render, screen } from '@testing-library/react-native';
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

  it('keeps native point card details below the image with compact actions', () => {
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

    const infoPanel = screen.getByTestId('travel-point-card-info-panel');
    const imageMedia = screen.getByTestId('mock-image-card-media');
    const imageWrapStyle = StyleSheet.flatten(screen.getByTestId('travel-point-card-image-wrap').props.style);

    expect(screen.queryByTestId('travel-point-card-overlay')).toBeNull();
    expect(imageMedia.props.fit).toBe('cover');
    expect(imageMedia.props.blurBackground).toBe(false);
    expect(infoPanel.findByProps({ accessibilityLabel: 'Скопировать координаты' })).toBeTruthy();
    const navigationToggle = infoPanel.findByProps({ accessibilityLabel: 'Карта' });
    expect(navigationToggle).toBeTruthy();
    fireEvent.press(navigationToggle);
    expect(infoPanel.findByProps({ accessibilityLabel: 'Открыть точку в Google Maps' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Открыть точку в Organic Maps' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Открыть точку в Waze' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Открыть точку в Яндекс Навигаторе' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Открыть точку в OpenStreetMap' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Поделиться' })).toBeTruthy();
    expect(infoPanel.findByProps({ accessibilityLabel: 'Мои точки' })).toBeTruthy();
    expect(screen.getByText(/Глубокое озеро/)).toBeTruthy();
    expect(imageWrapStyle.height).toBe(320);
  });
});
