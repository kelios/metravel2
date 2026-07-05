// __tests__/components/Map.ios.test.tsx
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';

const mockInjectJavaScript = jest.fn();
const mockUseMapClusters = jest.fn(() => ({
  data: { clusters: [], markers: [], totalCount: 0, source: '', generatedAt: '' },
  isLoading: false,
  isFetching: false,
  isError: false,
  isDebouncing: false,
}));

jest.mock('@/hooks/map/useMapClusters', () => ({
  useMapClusters: (...args: unknown[]) => mockUseMapClusters(...args),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const RN = require('react-native');

  const WebView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
    }));
    return React.createElement(RN.View, props);
  });

  return {
    __esModule: true,
    WebView,
    default: WebView,
  };
});

describe('Map.ios Component', () => {
  let Map: any;

  beforeAll(async () => {
    Map = (await import('@/components/MapPage/Map.ios')).default;
  });

  beforeEach(() => {
    mockInjectJavaScript.mockClear();
    mockUseMapClusters.mockClear();
    mockUseMapClusters.mockReturnValue({
      data: { clusters: [], markers: [], totalCount: 0, source: '', generatedAt: '' },
      isLoading: false,
      isFetching: false,
      isError: false,
      isDebouncing: false,
    });
  });

  const mockTravel = {
    travelAddress: {
      data: [
        {
          id: 1,
          lat: '53.9',
          lng: '27.5',
          coord: '53.9,27.5',
          address: 'Test Address, Minsk',
          travelImageThumbUrl: 'https://example.com/image.jpg',
          categoryName: 'Attraction',
        },
        {
          id: 2,
          lat: '53.8',
          lng: '27.6',
          coord: '53.8,27.6',
          address: 'Another Address',
          travelImageThumbUrl: '',
          categoryName: 'Restaurant',
        },
      ],
    },
  };

  const mockCoordinates = {
    latitude: 53.9,
    longitude: 27.5,
  };

  const getWebViewHtml = (rendered: ReturnType<typeof render>) => {
    const webView = getWebView(rendered);
    return webView.props.source.html as string;
  };

  const getWebView = (rendered: ReturnType<typeof render>) => {
    const webView = rendered.UNSAFE_getAllByType(View).find(
      (node) => typeof node.props?.source?.html === 'string'
    );
    expect(webView).toBeTruthy();
    return webView!;
  };

  const getInjectedPayloadScript = (rendered: ReturnType<typeof render>) => {
    const webView = getWebView(rendered);
    act(() => {
      webView.props.onLoadEnd();
    });
    expect(mockInjectJavaScript).toHaveBeenCalled();
    return mockInjectJavaScript.mock.calls.at(-1)?.[0] as string;
  };

  it('should render without crashing', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    expect(getWebViewHtml(rendered)).toContain('<div id="map"></div>');
  });

  it('should render WebView map markup', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getWebViewHtml(rendered)).toContain("L.map('map', {");
    expect(getWebViewHtml(rendered)).toContain('zoomControl: false');
  });

  it('keeps native WebView tiles fresh after Android layout and pan changes', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );

    const html = getWebViewHtml(rendered);
    expect(html).toContain('updateWhenIdle: false');
    expect(html).toContain('updateWhenZooming: false');
    expect(html).toContain('keepBuffer: 1');
    expect(html).toContain('preferCanvas: true');
    expect(html).toContain('fadeAnimation: false');
    expect(html).toContain("window.__metravelScheduleInvalidate('init')");
    expect(html).toContain("window.__metravelScheduleInvalidate('moveend')");
    expect(html).toContain("window.__metravelScheduleInvalidate('renderPoints')");
    expect(html).toContain("window.addEventListener('resize'");
  });

  it('should use inline div icons for Android WebView markers', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );

    const html = getWebViewHtml(rendered);
    expect(html).toContain('L.divIcon');
    expect(html).toContain('metravel-marker-pin');
    expect(html).not.toContain('filter: drop-shadow');
    expect(html).not.toContain('data:image/svg+xml');
  });

  it('should send marker selection through the WebView bridge', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );

    const html = getWebViewHtml(rendered);
    expect(html).toContain("marker.on('click'");
    expect(html).toContain("type: 'SELECT_PLACE'");
    expect(html).toContain('index: pointIndex');
    expect(html).toContain('id: point.id == null ? null : String(point.id)');
    expect(html).toContain('coord: point.coord == null ? null : String(point.coord)');
    expect(html).not.toContain("type: 'MAP_CLICK', lat: lat, lng: lng");
    expect(html).not.toContain('marker.bindPopup(popupContent');
  });

  it('should route marker selection messages to onMarkerSelect', () => {
    const onMarkerSelect = jest.fn();
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} onMarkerSelect={onMarkerSelect} />
    );

    const webView = getWebView(rendered);
    act(() => {
      webView.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'SELECT_PLACE', index: 1 }) },
      });
    });

    expect(onMarkerSelect).toHaveBeenCalledWith(mockTravel.travelAddress.data[1]);
  });

  it('should expose native map controls through the WebView bridge', () => {
    const onMapUiApiReady = jest.fn();
    const rendered = render(
      <Map
        travel={mockTravel}
        coordinates={mockCoordinates}
        onMapUiApiReady={onMapUiApiReady}
      />
    );

    const html = getWebViewHtml(rendered);
    expect(html).toContain('window.__metravelMapZoomIn');
    expect(html).toContain('window.__metravelMapZoomOut');
    expect(html).toContain('window.__metravelMapCenterOnUser');
    expect(onMapUiApiReady).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomIn: expect.any(Function),
        zoomOut: expect.any(Function),
        centerOnUser: expect.any(Function),
      }),
    );
  });

  it('should render route polyline payload in route mode', () => {
    const rendered = render(
      <Map
        travel={mockTravel}
        coordinates={mockCoordinates}
        mode="route"
        routePoints={[
          [27.5667, 53.9],
          [19.9368564, 50.0619474],
        ]}
      />
    );

    const injectedScript = getInjectedPayloadScript(rendered);
    expect(injectedScript).toContain('"mode":"route"');
    expect(injectedScript).toContain('"routePoints":[[53.9,27.5667],[50.0619474,19.9368564]]');
    expect(injectedScript).toContain('"routeLine":[[53.9,27.5667],[50.0619474,19.9368564]]');
    const html = getWebViewHtml(rendered);
    expect(html).toContain('const routeLine = Array.isArray(data.routeLine) ? data.routeLine : routePoints');
    expect(html).toContain('L.polyline(routeLine');
    expect(html).toContain('L.circleMarker(point');
    expect(html).toContain('map.fitBounds(routePolyline.getBounds()');
  });

  it('should include all travel points in the map payload', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    const injectedScript = getInjectedPayloadScript(rendered);
    expect(injectedScript).toContain('"id":1');
    expect(injectedScript).toContain('"id":2');
  });

  it('requests server clusters from native viewport bbox and filters', () => {
    const rendered = render(
      <Map
        travel={mockTravel}
        coordinates={mockCoordinates}
        mapClusterFilters={{ query: 'замок', category: [5] }}
      />
    );

    const webView = getWebView(rendered);
    act(() => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'MAP_VIEWPORT',
            bbox: { south: 53.1, west: 27.1, north: 54.1, east: 28.1 },
            zoom: 9,
          }),
        },
      });
    });

    expect(mockUseMapClusters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bbox: { south: 53.1, west: 27.1, north: 54.1, east: 28.1 },
        zoom: 9,
        filters: { query: 'замок', category: [5] },
        enabled: true,
      }),
    );
  });

  it('injects server clusters into the native WebView payload', () => {
    mockUseMapClusters.mockReturnValue({
      data: {
        clusters: [
          {
            id: 'cluster-1',
            center: { lat: 53.95, lng: 27.6 },
            count: 12,
            bounds: { south: 53.8, west: 27.4, north: 54.1, east: 27.8 },
            previewItems: [],
          },
        ],
        markers: [],
        totalCount: 12,
        source: 'server',
        generatedAt: '2026-07-04T00:00:00Z',
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      isDebouncing: false,
    });
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );

    const injectedScript = getInjectedPayloadScript(rendered);
    expect(injectedScript).toContain('"clusters":[{"key":"cluster-1"');
    expect(injectedScript).toContain('"count":12');
    expect(injectedScript).toContain('"usesServerClusters":true');
    expect(getWebViewHtml(rendered)).toContain('makeClusterIcon');
    expect(getWebViewHtml(rendered)).toContain("__metravelPostViewport('MAP_VIEWPORT')");
  });

  it('should handle empty travel data', () => {
    const emptyTravel = { 
      travelAddress: { 
        data: [] 
      } 
    };
    
    const rendered = render(
      <Map travel={emptyTravel} coordinates={mockCoordinates} />
    );
    
    expect(getInjectedPayloadScript(rendered)).toContain('"points":[]');
  });

  it('should use default coordinates when not provided', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={null} />
    );
    
    const injectedScript = getInjectedPayloadScript(rendered);
    expect(getWebViewHtml(rendered)).toContain('setView([53.8828449, 27.7273595], 10)');
    expect(injectedScript).toContain('"center":{"lat":53.8828449,"lng":27.7273595}');
  });

  it('should parse coordinates correctly', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getWebViewHtml(rendered)).toContain("String(point.coord).split(',').map(Number)");
  });

  it('should not render travel marker callouts inside the native WebView', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    const html = getWebViewHtml(rendered);
    expect(html).not.toContain('popup-chip');
    expect(html).not.toContain('Подробнее');
    expect(html).not.toContain('>Маршрут<');
    expect(html).toContain("type: 'SELECT_PLACE'");
  });

  it('should display point address in callout', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getInjectedPayloadScript(rendered)).toContain('Test Address, Minsk');
  });

  it('should display point category in callout', () => {
    const rendered = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getInjectedPayloadScript(rendered)).toContain('Attraction');
  });

  it('should handle missing image gracefully', () => {
    const travelWithoutImage = {
      travelAddress: {
        data: [{
          ...mockTravel.travelAddress.data[1],
          travelImageThumbUrl: '',
        }],
      },
    };

    const rendered = render(
      <Map travel={travelWithoutImage} coordinates={mockCoordinates} />
    );
    
    expect(getInjectedPayloadScript(rendered)).toContain('"travelImageThumbUrl":""');
  });
});
