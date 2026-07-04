/**
 * Web parity: on web the travel point card must collapse the sprawling map-app
 * button grid into a single «Навигация» control that opens the shared popup —
 * i.e. render exactly like the mobile card (compact + popupAligned). Guards the
 * PointListCardRenderer flags that route web through the compact path.
 */

// Hoisted by jest. Forces Platform.OS = 'web' before the SUT loads.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN.Platform, 'OS', { value: 'web', configurable: true, writable: true });
  RN.Platform.select = (obj: any) => obj.web ?? obj.default;
  return RN;
});

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="mock-image-card-media" {...props} />;
  },
}));

import { render, screen } from '@testing-library/react-native';

import PointListCardRenderer from '@/components/travel/PointListCardRenderer';
import { getThemedColors } from '@/hooks/useTheme';

describe('PointListCardRenderer (web) — mobile-parity compact card', () => {
  const colors = getThemedColors();
  const noop = jest.fn();

  const mapActions = [
    { key: 'gmaps', icon: 'map-pin' as const, label: 'Google Maps', title: 'Открыть точку в Google Maps', onPress: noop },
    { key: 'organic', icon: 'compass' as const, label: 'Organic Maps', title: 'Открыть точку в Organic Maps', onPress: noop },
    { key: 'waze', icon: 'navigation' as const, label: 'Waze', title: 'Открыть точку в Waze', onPress: noop },
  ];

  const renderCard = () =>
    render(
      <PointListCardRenderer
        colors={{ textOnDark: colors.textOnDark, textOnPrimary: colors.textOnPrimary }}
        isMobile={false}
        isWebGrid
        item={{ id: '1', address: 'Брестская крепость (Цитадель)', coord: '52.0826,23.6558' }}
        itemModel={{
          addDisabled: false,
          categoryLabel: 'Достопримечательность',
          handleAddPointClick: noop,
          imageUrl: 'https://example.com/point.jpg',
          inlineActions: [
            { key: 'article', icon: 'book-open', label: 'Статья', title: 'Открыть статью', onPress: noop },
          ],
          isAdding: false,
          mapActions,
          onCardPress: noop,
          onCopyCoord: noop,
          onMediaPress: noop,
          onShareCoord: noop,
        }}
        numColumns={1}
        onCopy={noop}
        onOpenMap={noop}
        onShare={noop}
        responsive={{ coordSize: 12, imageMinHeight: 220, titleSize: 16 }}
        styles={{}}
      />
    );

  it('collapses map-app buttons into a single «Навигация» popup control', () => {
    renderCard();

    // The single overflow control only exists in the compact/popup path — on the
    // old non-compact web card overflowActions was empty and it never rendered.
    expect(screen.getByLabelText('Навигация и действия')).toBeTruthy();

    // The map-app buttons are NOT laid out inline anymore (they moved into the popup).
    expect(screen.queryByLabelText('Открыть точку в Google Maps')).toBeNull();
    expect(screen.queryByLabelText('Открыть точку в Organic Maps')).toBeNull();
  });

  it('keeps the coord + save affordances visible like the mobile card', () => {
    renderCard();

    expect(screen.getByLabelText('Скопировать координаты')).toBeTruthy();
    expect(screen.getByLabelText('Сохранить')).toBeTruthy();
  });
});
