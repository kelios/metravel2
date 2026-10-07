import { buildNativeMapUiApi } from '@/components/MapPage/Map/nativeMapUiApi';
import { NATIVE_MAP_VIEW_COMMANDS_SCRIPT } from '@/components/MapPage/Map/nativeMapViewCommandsScript';
import { NATIVE_ROUTE_POINT_MARKERS_SCRIPT } from '@/components/MapPage/Map/nativeRoutePointMarkersScript';
import type { MapFitPadding } from '@/types/mapUi';

it('native fit reads current sheet geometry at invocation and sends asymmetric padding', () => {
  const commands: string[] = [];
  let height = 280;
  const api = buildNativeMapUiApi({ injectMapCommand: script => commands.push(script), setOverlayEnabled: jest.fn(), getResultCoords: () => [{ lat: 53.9, lng: 27.56 }, { lat: 54, lng: 28 }], canFitToResults: true, getFitPadding: (): MapFitPadding => ({ topLeft: [50, 50], bottomRight: [50, height], maxShare: 1 }) });
  const receive = jest.fn();
  const bridge = { __metravelMapFitCoords: receive };
  api.fitToResults();
  height = 590;
  api.fitToResults();
  commands.forEach(command => new Function('window', command)(bridge));
  expect(receive.mock.calls.map(call => call[2].bottomRight)).toEqual([[50, 280], [50, 590]]);
  expect(receive.mock.calls[1][2].maxShare).toBe(1);
});

it('the real native command also applies padding for a singleton result', () => {
  const fitBounds = jest.fn(), setView = jest.fn();
  const map = { fitBounds, setView, getSize: () => ({ x: 390, y: 844 }), getZoom: () => 12 };
  const bridge: Record<string, any> = {};
  // Execute the production fit-options and view commands, rather than copying their geometry.
  new Function('window', 'map', 'L', `let __metravelProgrammaticMoveUntil=0; ${NATIVE_ROUTE_POINT_MARKERS_SCRIPT}\n${NATIVE_MAP_VIEW_COMMANDS_SCRIPT}`)(bridge, map, { latLngBounds: (coords: unknown) => coords });
  bridge.__metravelMapFitCoords([[53.9, 27.56]], 14, { topLeft: [50, 50], bottomRight: [50, 590], maxShare: 1 });
  expect(fitBounds).toHaveBeenCalledWith([[53.9, 27.56]], { maxZoom: 14, paddingTopLeft: [50, 50], paddingBottomRight: [50, 590] });
  expect(setView).not.toHaveBeenCalled();
  bridge.__metravelMapFitCoords([[53.9, 27.56]], 14);
  expect(setView).toHaveBeenCalledTimes(1);
});
