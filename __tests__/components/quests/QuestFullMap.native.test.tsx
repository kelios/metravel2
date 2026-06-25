import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(),
}));

const QuestFullMap = require('../../../components/quests/QuestFullMap.native').default;

describe('QuestFullMap native marker status', () => {
  const steps = [
    { lat: 50.061541, lng: 19.936191, title: 'Рынок' },
    { lat: 50.061721, lng: 19.939094, title: 'Мариацкий костел' },
    { lat: 50.0573148, lng: 19.9407374, title: 'Финиш' },
  ];

  it('exposes route points as loading until WebView confirms visible Leaflet markers', () => {
    const { getByTestId, getByText } = render(
      <QuestFullMap steps={steps} title="Карта квеста" height={420} />
    );

    expect(getByText('3 точки загружаются на карту')).toBeTruthy();

    fireEvent(getByTestId('quest-map-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'quest-map-status',
          expectedMarkers: 3,
          markerNodes: 3,
          visibleMarkers: 3,
        }),
      },
    });

    expect(getByText('3 точки на карте')).toBeTruthy();
  });

  it('keeps the missing-marker regression visible when WebView reports no marker nodes', () => {
    const { getByTestId, getByText, queryByText } = render(
      <QuestFullMap steps={steps} title="Карта квеста" height={420} />
    );

    fireEvent(getByTestId('quest-map-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'quest-map-status',
          expectedMarkers: 3,
          markerNodes: 0,
          visibleMarkers: 0,
          settled: false,
        }),
      },
    });

    expect(getByText('3 точки загружаются на карту')).toBeTruthy();
    expect(queryByText('Точки карты не отрисовались')).toBeNull();

    fireEvent(getByTestId('quest-map-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'quest-map-status',
          expectedMarkers: 3,
          markerNodes: 0,
          visibleMarkers: 0,
          settled: true,
        }),
      },
    });

    expect(getByText('Точки карты не отрисовались')).toBeTruthy();
    expect(queryByText('3 точки на карте')).toBeNull();
  });

  it('includes bounded native WebView refresh hooks for intermittent Android marker rendering', () => {
    const { getByTestId } = render(
      <QuestFullMap steps={steps} title="Карта квеста" height={420} />
    );

    const html = getByTestId('quest-map-webview').props.source.html;
    expect(html).toContain('updateWhenIdle: false');
    expect(html).toContain('updateWhenZooming: false');
    expect(html).toContain('keepBuffer: 1');
    expect(html).toContain('preferCanvas: true');
    expect(html).toContain('fadeAnimation: false');
    expect(html).toContain("scheduleMapRefresh('init')");
    expect(html).toContain("postMapStatus('final')");
    expect(html).toContain('settled: settled');
  });

  it('keeps a safe native height when callers pass the compact mobile size', () => {
    const rendered = render(
      <QuestFullMap steps={steps} title="Карта квеста" height={360} />
    );

    const wrap = rendered.UNSAFE_getAllByType(View).find((node) => {
      const style = node.props?.style;
      return Array.isArray(style) && style.some((entry) => entry?.height === 420);
    });
    expect(wrap?.props?.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ height: 420 }),
      ]),
    );
  });
});
