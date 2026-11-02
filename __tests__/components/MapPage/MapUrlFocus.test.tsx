import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import { MapLogicComponent } from '@/components/MapPage/Map/MapLogicComponent';
import { useMapApi } from '@/components/MapPage/Map/useMapApi';
import { __resetProgrammaticMapMoveForTests } from '@/components/MapPage/Map/programmaticMoveSignal';
import type { MapUiApi } from '@/types/mapUi';

jest.mock('@/utils/routeExport', () => ({ buildGpx: jest.fn(), buildKml: jest.fn(), downloadTextFileWeb: jest.fn() }));
jest.mock('@/config/mapWebLayers', () => ({ WEB_MAP_BASE_LAYERS: [] }));
jest.mock('@/utils/mapWebLayers', () => ({ createLeafletLayer: jest.fn() }));

describe('explicit URL/place focus takes precedence over late startup fitting', () => {
  const originalRaf = global.requestAnimationFrame;
  beforeAll(() => { global.requestAnimationFrame = callback => { callback(0); return 0; }; });
  afterAll(() => { global.requestAnimationFrame = originalRaf; });
  beforeEach(() => __resetProgrammaticMapMoveForTests());

  it.each(['49.2502602,19.9347267', '49.261877,19.930121'])('retains focus %s after results settle and still accepts a new radius', async coord => {
    let zoom = 11;
    const map = {
      setView: jest.fn((_center: number[], nextZoom: number) => { zoom = nextZoom; }),
      fitBounds: jest.fn(() => { zoom = 9; }),
      getZoom: () => zoom,
      getCenter: () => ({ lat: 49.25, lng: 19.93 }),
      closePopup: jest.fn(), on: jest.fn(), off: jest.fn(), invalidateSize: jest.fn(),
    };
    const bounds = { pad: () => bounds, getSouthWest: () => ({ lat: 49, lng: 19 }),
      getNorthEast: () => ({ lat: 50, lng: 20 }), isValid: () => true, extend: jest.fn() };
    const L = { latLng: (lat: number, lng: number) => ({ lat, lng }), latLngBounds: () => bounds };
    let api: MapUiApi | null = null;
    const onMapUiApiReady = (value: MapUiApi | null) => { api = value; };
    const apiProps = { map, L, onMapUiApiReady, travelData: [], userLocation: null, routePoints: [],
      leafletBaseLayerRef: { current: null }, leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null } };
    const hook = await renderHook(() => useMapApi(apiProps));
    const initialViewReady = jest.fn();
    const props = {
      mapClickHandler: jest.fn(), mode: 'radius' as const, coordinates: { lat: 49.25, lng: 19.93 },
      userLocation: null, disableFitBounds: false, L, travelData: [], initialResultsSettled: false,
      onInitialViewReady: initialViewReady, circleCenter: { lat: 49.25, lng: 19.93 }, radiusInMeters: 50000,
      setMapZoom: jest.fn(), mapRef: { current: null }, onMapReady: jest.fn(),
      savedMapViewRef: { current: null }, hasInitializedRef: { current: false }, lastModeRef: { current: null },
      lastAutoFitKeyRef: { current: null }, leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() }, leafletControlRef: { current: null },
      useMap: () => map, useMapEvents: jest.fn(),
    };
    const logic = await render(<MapLogicComponent {...props} />);
    await act(async () => { api?.focusOnCoord?.(coord, { zoom: 16 }); });
    expect(zoom).toBe(16);

    const point = { id: 'target', coord, address: 'Requested place' };
    await logic.rerender(<MapLogicComponent {...props} initialResultsSettled travelData={[point]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(zoom).toBe(16);
    expect(initialViewReady).toHaveBeenCalledTimes(1);

    await logic.rerender(<MapLogicComponent {...props} initialResultsSettled travelData={[point, { ...point, id: 'next-page' }]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(zoom).toBe(16);

    await logic.rerender(<MapLogicComponent {...props} initialResultsSettled radiusInMeters={10000} travelData={[point]} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    await logic.unmount();
    await hook.unmount();
  });
});
