import { render } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
    },
    useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
  };
});

const userPointsMapProps: any[] = [];

jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    UserPointsMap: (props: any) => {
      userPointsMapProps.push(props);
      return <View testID="mock-userpoints-map" />;
    },
  };
});

jest.mock('@/api/external/nominatim', () => ({
  nominatimSearch: jest.fn(),
}));

const { PointsListGrid } = require('@/components/UserPoints/PointsListGrid');

describe('PointsListGrid', () => {
  const styles: any = {
    mapInner: {},
    locateFab: {},
    locateFabDisabled: {},
    mapContainer: {},
  };

  beforeEach(() => {
    userPointsMapProps.length = 0;
  });

  it('bounds the initial web side-panel list render', () => {
    (require('react-native').Platform as any).OS = 'web';

    const points = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      name: `Point ${index + 1}`,
      latitude: 53 + index / 1000,
      longitude: 27 + index / 1000,
    }));

    const utils = render(
      <PointsListGrid
        styles={styles}
        colors={{ text: '#111' }}
        viewMode="map"
        isLoading={false}
        filteredPoints={points}
        renderHeader={() => <></>}
        renderItem={({ item }) => {
          const { Text } = require('react-native');
          return <Text testID="userpoints-rendered-row">{String(item.name)}</Text>;
        }}
        renderEmpty={() => <></>}
        onRefresh={jest.fn()}
        currentLocation={null}
        onMapPress={jest.fn()}
        showManualAdd={false}
        manualCoords={null}
        manualColor={null}
        isLocating={false}
        onLocateMe={jest.fn()}
        showingRecommendations={false}
        onCloseRecommendations={jest.fn()}
        onRefreshRecommendations={jest.fn()}
        searchQuery=""
        onSearch={jest.fn()}
        hasFilters={false}
        onResetFilters={jest.fn()}
      />
    );

    expect(utils.getByTestId('userpoints-panel-content-list')).toBeTruthy();
    expect(utils.queryAllByTestId('userpoints-rendered-row')).toHaveLength(80);
  });
});
