/**
 * #2661 — рендерер слоя «Погода» в WebView: патч по ключу ячейки, без
 * пересоздания неизменных подписей и без собственных запросов к OWM.
 * Исполняется РЕАЛЬНЫЙ скрипт на фейковом Leaflet.
 */
import { buildNativeWeatherTempLabelsScript } from '@/components/MapPage/Map/nativeWeatherTempLabelsScript';
import { buildNativeSetWeatherLabelsCommand } from '@/components/MapPage/Map/useNativeWeatherLabels';
import { WEATHER_LABELS_PANE } from '@/utils/mapWeatherLabels';

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({ useSafeAreaInsetsSafe: () => ({ top: 0 }) }));

const createHarness = () => {
  const panes: Record<string, { style: Record<string, string> }> = {};
  const group = {
    items: [] as unknown[],
    removeLayer: jest.fn((item: unknown) => {
      group.items = group.items.filter((entry) => entry !== item);
    }),
    clearLayers: jest.fn(() => {
      group.items = [];
    }),
  };
  const map = {
    getPane: (name: string) => panes[name],
    createPane: (name: string) => {
      panes[name] = { style: {} };
      return panes[name];
    },
  };
  const L = {
    divIcon: (options: unknown) => options,
    marker: jest.fn((latLng: unknown, options: { pane?: string }) => {
      const marker = {
        latLng,
        options,
        addTo: (layer: typeof group) => {
          layer.items.push(marker);
          return marker;
        },
      };
      return marker;
    }),
  };
  const win: Record<string, any> = {};
  const fetchSpy = jest.fn();
  const factory = new Function(
    'map',
    'L',
    'window',
    'fetch',
    `${buildNativeWeatherTempLabelsScript()}\nreturn makeWeatherTempLabelsController;`,
  );
  const makeController = factory(map, L, win, fetchSpy);
  return { group, panes, L, win, fetchSpy, controller: makeController(group) };
};

const label = (key: string) => ({ key, lat: 53.9, lon: 27.5, html: '<span>+9°</span>' });

describe('native weather labels renderer', () => {
  it('applies add/remove patches by cell key and never recreates existing labels', () => {
    const h = createHarness();
    h.controller.start();
    expect(h.panes[WEATHER_LABELS_PANE]).toBeDefined();

    h.win.__metravelSetWeatherLabels({ add: [label('11/1/1'), label('11/1/2')], removeKeys: [] });
    expect(h.group.items).toHaveLength(2);
    expect(h.L.marker.mock.calls[0][1].pane).toBe(WEATHER_LABELS_PANE);

    h.win.__metravelSetWeatherLabels({ add: [label('11/1/2'), label('11/1/3')], removeKeys: ['11/1/1'] });
    expect(h.L.marker).toHaveBeenCalledTimes(3);
    expect(h.group.removeLayer).toHaveBeenCalledTimes(1);
    expect(h.group.items).toHaveLength(2);
    expect(h.fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores patches while the layer is off and starts clean after re-enable', () => {
    const h = createHarness();
    h.win.__metravelSetWeatherLabels({ add: [label('a')], removeKeys: [] });
    expect(h.group.items).toHaveLength(0);

    h.controller.start();
    h.win.__metravelSetWeatherLabels({ add: [label('a')], removeKeys: [] });
    h.controller.stop();
    expect(h.group.items).toHaveLength(0);

    h.controller.start();
    h.win.__metravelSetWeatherLabels({ add: [label('a')], removeKeys: [] });
    expect(h.group.items).toHaveLength(1);
  });

  it('RN command calls the WebView channel with a serialized patch', () => {
    const command = buildNativeSetWeatherLabelsCommand({ add: [label('k')], removeKeys: ['x'] });
    expect(command).toContain('window.__metravelSetWeatherLabels(');
    expect(command).toContain('"removeKeys":["x"]');
  });
});
