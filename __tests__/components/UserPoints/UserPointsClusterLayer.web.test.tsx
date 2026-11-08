/**
 * #3131: слой личных точек на web-карте — кластеры leaflet.markercluster и один
 * ленивый попап вместо 2656 смонтированных `<Marker><Popup/></Marker>`.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { UserPointsClusterLayer } from '@/components/UserPoints/UserPointsClusterLayer.web';
import { PointStatus, type ImportedPoint } from '@/types/userPoints';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
  useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
}));

jest.mock('react-dom', () => ({
  __esModule: true,
  createPortal: (node: any) => node,
}));

type FakeMarker = {
  latlng: [number, number];
  options: Record<string, any>;
  handlers: Record<string, Array<(event?: any) => void>>;
  setIcon: jest.Mock;
  setLatLng: jest.Mock;
  bindPopup: jest.Mock;
  unbindPopup: jest.Mock;
  openPopup: jest.Mock;
  closePopup: jest.Mock;
  setZIndexOffset: jest.Mock;
  getLatLng: jest.Mock;
  getElement: jest.Mock;
  getPopup: jest.Mock;
  popup: { options: Record<string, any>; update: jest.Mock; isOpen: jest.Mock };
  on: jest.Mock;
  off: jest.Mock;
  fire: (name: string, event?: any) => void;
  _icon: { setAttribute: jest.Mock };
};

const createRuntime = () => {
  const markers: FakeMarker[] = [];
  const group = {
    addLayers: jest.fn(),
    removeLayers: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    clearLayers: jest.fn(),
    refreshClusters: jest.fn(),
    zoomToShowLayer: jest.fn((_marker: any, cb?: () => void) => cb?.()),
    on: jest.fn(),
    off: jest.fn(),
  };
  const map = {
    layers: new Set<any>(),
    addLayer: jest.fn(function (this: any, layer: any) {
      map.layers.add(layer);
    }),
    removeLayer: jest.fn((layer: any) => {
      map.layers.delete(layer);
    }),
    hasLayer: jest.fn((layer: any) => map.layers.has(layer)),
    eachLayer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    closePopup: jest.fn(),
  };
  const L = {
    divIcon: jest.fn((opts: any) => ({ divIcon: true, ...opts })),
    markerClusterGroup: jest.fn(() => group),
    marker: jest.fn((latlng: [number, number], options: Record<string, any>) => {
      const handlers: FakeMarker['handlers'] = {};
      const marker: FakeMarker = {
        latlng,
        options: { ...options },
        handlers,
        setIcon: jest.fn(),
        setLatLng: jest.fn(),
        bindPopup: jest.fn((_content: any, popupOptions: Record<string, any>) => {
          marker.popup.options = { ...popupOptions };
        }),
        unbindPopup: jest.fn(),
        openPopup: jest.fn(),
        closePopup: jest.fn(),
        setZIndexOffset: jest.fn(),
        getLatLng: jest.fn(() => ({ lat: latlng[0], lng: latlng[1] })),
        getElement: jest.fn(() => marker._icon),
        popup: { options: {}, update: jest.fn(), isOpen: jest.fn(() => true) },
        getPopup: jest.fn(() => marker.popup),
        on: jest.fn((name: string, handler: (event?: any) => void) => {
          (handlers[name] ||= []).push(handler);
        }),
        off: jest.fn(),
        fire: (name: string, event?: any) => {
          for (const handler of handlers[name] ?? []) handler(event);
        },
        _icon: { setAttribute: jest.fn() },
      };
      markers.push(marker);
      return marker;
    }),
    DomEvent: { stopPropagation: jest.fn() },
    MarkerCluster: function MarkerCluster() {},
  };
  return { L, map, group, markers };
};

const basePoint: ImportedPoint = {
  id: 1,
  name: 'Point',
  latitude: 53.9,
  longitude: 27.56,
  color: 'red',
  status: PointStatus.PLANNING,
  source: 'osm',
  imported_at: '2026-07-03T08:00:00Z',
  created_at: '2026-07-03T08:00:00Z',
  updated_at: '2026-07-03T08:00:00Z',
};

const makePoints = (count: number): ImportedPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    ...basePoint,
    id: index + 1,
    name: `Point ${index + 1}`,
    latitude: 53.9 + index * 0.01,
    longitude: 27.56 + index * 0.01,
  }));

const colors = { backgroundTertiary: '#eee' };

describe('UserPointsClusterLayer (web, #3131)', () => {
  const iconFor = (color: string | undefined, opts?: { active?: boolean; emphasize?: boolean }) =>
    `${color}|${opts?.active ? 'active' : 'idle'}|${opts?.emphasize ? 'site' : 'plain'}`;

  const renderLayer = async (
    runtime: ReturnType<typeof createRuntime>,
    props: Partial<React.ComponentProps<typeof UserPointsClusterLayer>> = {},
  ) => {
    const registerPointMarker = jest.fn();
    const onMarkerClick = jest.fn();
    const renderPopup = jest.fn((point: ImportedPoint) => <Text testID="popup-content">{point.name}</Text>);
    await render(
      <UserPointsClusterLayer
        L={runtime.L}
        map={runtime.map}
        points={makePoints(3)}
        isCompactPopup={false}
        colors={colors}
        getMarkerIconCached={iconFor}
        onMarkerClick={onMarkerClick}
        registerPointMarker={registerPointMarker}
        renderPopup={renderPopup}
        {...props}
      />,
    );
    return { registerPointMarker, onMarkerClick, renderPopup };
  };

  it('puts every point into one markerClusterGroup instead of standalone markers', async () => {
    const runtime = createRuntime();
    const { registerPointMarker } = await renderLayer(runtime);

    expect(runtime.L.markerClusterGroup).toHaveBeenCalledTimes(1);
    expect(runtime.map.addLayer).toHaveBeenCalledWith(runtime.group);
    expect(runtime.L.marker).toHaveBeenCalledTimes(3);
    expect(runtime.group.addLayers).toHaveBeenCalledTimes(1);
    expect(runtime.group.addLayers.mock.calls[0][0]).toHaveLength(3);
    // Индекс карты получает обёртку маркера по id и координате — для MapUiApi.
    expect(registerPointMarker).toHaveBeenCalledWith(
      expect.objectContaining({ pointId: 1, coordKey: '53.9,27.56', marker: expect.objectContaining({ pointId: 1 }) }),
    );
    // Маркеры не попадают в tab-порядок, пока точка не выбрана.
    expect(runtime.markers.every((marker) => marker.options.keyboard === false)).toBe(true);
    expect(runtime.markers[0].options.title).toBe('Point 1');
  });

  it('mounts popup content lazily — only for the marker whose popup opened', async () => {
    const runtime = createRuntime();
    const { renderPopup } = await renderLayer(runtime);

    expect(renderPopup).not.toHaveBeenCalled();
    expect(screen.queryByTestId('popup-content')).toBeNull();
    // Leaflet получает функцию-контент, а не готовый DOM на каждую точку.
    expect(runtime.markers[1].bindPopup).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ className: expect.stringContaining('metravel-user-point-popup'), closeButton: false }),
    );

    await act(async () => {
      runtime.markers[1].fire('popupopen');
    });
    expect(renderPopup).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('popup-content').props.children).toBe('Point 2');
    // Leaflet мерил пустой контейнер — после монтирования содержимого попап
    // пересчитывает раскладку и автопан (как `<Popup>` react-leaflet).
    expect(runtime.markers[1].popup.update).toHaveBeenCalled();
    expect(runtime.markers[0].popup.update).not.toHaveBeenCalled();

    await act(async () => {
      runtime.markers[1].fire('popupclose');
    });
    expect(screen.queryByTestId('popup-content')).toBeNull();
  });

  it('diffs by id: removes gone markers, keeps survivors, re-icons the active one', async () => {
    const runtime = createRuntime();
    const points = makePoints(3);
    const { onMarkerClick } = await renderLayer(runtime, { points });

    await screen.rerender(
      <UserPointsClusterLayer
        L={runtime.L}
        map={runtime.map}
        points={points.slice(0, 2)}
        activePointId={2}
        isCompactPopup={false}
        colors={colors}
        getMarkerIconCached={iconFor}
        onMarkerClick={onMarkerClick}
        registerPointMarker={jest.fn()}
        renderPopup={() => null}
      />,
    );

    expect(runtime.group.removeLayers).toHaveBeenCalledTimes(1);
    expect(runtime.group.removeLayers.mock.calls[0][0]).toEqual([runtime.markers[2]]);
    // Выжившие маркеры не пересоздаются.
    expect(runtime.L.marker).toHaveBeenCalledTimes(3);
    // Активная точка получает активную иконку и становится фокусируемой.
    expect(runtime.markers[1].setIcon).toHaveBeenCalledWith('red|active|plain');
    expect(runtime.markers[1].options.keyboard).toBe(true);
    expect(runtime.markers[0].setIcon).not.toHaveBeenCalled();
  });

  it('updates autoPan padding of existing popups when the popup layout turns compact', async () => {
    const runtime = createRuntime();
    const points = makePoints(2);
    const props = {
      L: runtime.L,
      map: runtime.map,
      points,
      colors,
      getMarkerIconCached: iconFor,
      registerPointMarker: jest.fn(),
      renderPopup: () => null,
    };
    await render(<UserPointsClusterLayer {...props} isCompactPopup={false} />);
    expect(runtime.markers[0].popup.options.autoPanPadding).toEqual([28, 120]);

    await screen.rerender(<UserPointsClusterLayer {...props} isCompactPopup />);
    expect(runtime.L.marker).toHaveBeenCalledTimes(2);
    expect(runtime.markers[0].popup.options.autoPanPadding).toEqual([16, 92]);
  });

  it('routes marker clicks to the screen with a handle that reveals clustered markers', async () => {
    const runtime = createRuntime();
    const { onMarkerClick } = await renderLayer(runtime);

    await act(async () => {
      runtime.markers[0].fire('click', { originalEvent: { stopPropagation: jest.fn() } });
    });
    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    const [point, handle] = onMarkerClick.mock.calls[0];
    expect(point.id).toBe(1);

    // Маркер внутри кластера (не на карте): сначала zoomToShowLayer, потом openPopup.
    handle.openPopup();
    expect(runtime.group.zoomToShowLayer).toHaveBeenCalledWith(runtime.markers[0], expect.any(Function));
    expect(runtime.markers[0].openPopup).toHaveBeenCalledTimes(1);

    runtime.map.layers.add(runtime.markers[0]);
    handle.openPopup();
    expect(runtime.group.zoomToShowLayer).toHaveBeenCalledTimes(1);
    expect(runtime.markers[0].openPopup).toHaveBeenCalledTimes(2);
  });

  it('tears the group down and unregisters markers on unmount', async () => {
    const runtime = createRuntime();
    const { registerPointMarker } = await renderLayer(runtime);
    registerPointMarker.mockClear();

    await screen.unmount();

    expect(runtime.map.removeLayer).toHaveBeenCalledWith(runtime.group);
    expect(runtime.group.clearLayers).toHaveBeenCalled();
    expect(registerPointMarker).toHaveBeenCalledWith(expect.objectContaining({ pointId: 1, marker: null }));
    expect(registerPointMarker).toHaveBeenCalledTimes(3);
  });
});
