import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  COUNTRY_NAMES,
  DEFAULT_NEARBY_RADIUS_KM,
  filterQuestsByMapSearchArea,
  isCoordinateInMapViewport,
  resolveQuestMapCenter,
} from '@/screens/tabs/QuestsScreen.helpers';

describe('QuestsScreen helpers', () => {
  it('maps quest country codes shown in the catalog to country names', () => {
    expect(COUNTRY_NAMES.DE).toBe('Германия');
    expect(COUNTRY_NAMES.FR).toBe('Франция');
    expect(COUNTRY_NAMES.NL).toBe('Нидерланды');
    // Регресс: раньше эти коды отсутствовали и заголовок группы падал на сырой
    // код («GR», «HR», …) вместо русского названия страны.
    expect(COUNTRY_NAMES.GR).toBe('Греция');
    expect(COUNTRY_NAMES.HR).toBe('Хорватия');
    expect(COUNTRY_NAMES.IT).toBe('Италия');
    expect(COUNTRY_NAMES.PT).toBe('Португалия');
    expect(COUNTRY_NAMES.RO).toBe('Румыния');
    expect(COUNTRY_NAMES.RS).toBe('Сербия');
  });

  it('has a Russian name for every country code geoCountry can return', () => {
    // Любой код из getCountryCodeByCoords должен иметь запись в COUNTRY_NAMES,
    // иначе заголовок группы в каталоге показывает сырой ISO-код.
    const source = readFileSync(
      resolve(__dirname, '../../utils/geoCountry.ts'),
      'utf8',
    );
    const codes = Array.from(source.matchAll(/code:\s*'([A-Z]{2})'/g)).map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    const missing = codes.filter((code) => !COUNTRY_NAMES[code]);
    expect(missing).toEqual([]);
  });

  it('keeps quests inside the visible map bounds when searching this area', () => {
    const quests = [
      { id: 'west', lat: 53.9, lng: 27.5 },
      { id: 'east', lat: 53.95, lng: 28.1 },
      { id: 'outside', lat: 55.9, lng: 30.5 },
    ];

    const result = filterQuestsByMapSearchArea(
      quests,
      {
        latitude: 53.92,
        longitude: 27.8,
        bbox: {
          south: 53.7,
          west: 27.3,
          north: 54.1,
          east: 28.3,
        },
      },
      15,
    );

    expect(result.map((quest) => quest.id).sort()).toEqual(['east', 'west']);
  });

  it('uses the visible bbox as the primary filter and ignores radius inside a valid bbox', () => {
    const quests = [
      { id: 'inBboxFarFromCenter', lat: 54.05, lng: 28.25 },
      { id: 'outsideBbox', lat: 55.9, lng: 30.5 },
    ];

    // A tiny fallback radius (1 km) must NOT drop the in-bbox quest that sits far
    // from the area center: valid bbox is the sole gate, radius is fallback-only.
    const result = filterQuestsByMapSearchArea(
      quests,
      {
        latitude: 53.92,
        longitude: 27.8,
        bbox: { south: 53.7, west: 27.3, north: 54.1, east: 28.3 },
      },
      1,
    );

    expect(result.map((quest) => quest.id)).toEqual(['inBboxFarFromCenter']);
  });

  it('uses a single nearby distance threshold', () => {
    expect(DEFAULT_NEARBY_RADIUS_KM).toBe(10);
  });

  it('falls back to the selected radius only when map bounds are unavailable', () => {
    const quests = [
      { id: 'near', lat: 53.9, lng: 27.5 },
      { id: 'far', lat: 54.5, lng: 28.5 },
    ];

    const result = filterQuestsByMapSearchArea(
      quests,
      {
        latitude: 53.9,
        longitude: 27.56,
      },
      15,
    );

    expect(result.map((quest) => quest.id)).toEqual(['near']);
  });

  it('supports viewports that cross the antimeridian', () => {
    expect(
      isCoordinateInMapViewport(10, 179.5, { south: 0, west: 170, north: 20, east: -170 }),
    ).toBe(true);
    expect(
      isCoordinateInMapViewport(10, -179.5, { south: 0, west: 170, north: 20, east: -170 }),
    ).toBe(true);
    expect(
      isCoordinateInMapViewport(10, 0, { south: 0, west: 170, north: 20, east: -170 }),
    ).toBe(false);
  });

  it('centers the map on text search results instead of the previous city or map area', () => {
    const center = resolveQuestMapCenter({
      searchTerm: 'минск',
      mapPoints: [
        { coord: '53.9,27.56' },
        { coord: '53.92,27.58' },
      ],
      activeMapAreaCenter: { latitude: 50.06, longitude: 19.94 },
      userLoc: { lat: 52.23, lng: 21.01 },
      selectedCity: { lat: 50.06, lng: 19.94 },
    });

    expect(center.latitude).toBeCloseTo(53.91);
    expect(center.longitude).toBeCloseTo(27.57);
  });

  it('keeps the map-area center first when there is no text search', () => {
    const center = resolveQuestMapCenter({
      searchTerm: '',
      mapPoints: [{ coord: '53.9,27.56' }],
      activeMapAreaCenter: { latitude: 50.06, longitude: 19.94 },
      userLoc: { lat: 52.23, lng: 21.01 },
      selectedCity: { lat: 53.9, lng: 27.56 },
    });

    expect(center).toEqual({ latitude: 50.06, longitude: 19.94 });
  });
});
