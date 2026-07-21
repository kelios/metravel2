import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  COUNTRY_NAME_KEYS,
  DEFAULT_NEARBY_RADIUS_KM,
  buildQuestCityCatalog,
  filterKidsQuests,
  filterQuestsByMapSearchArea,
  getQuestCountryName,
  isCoordinateInMapViewport,
  isKidsQuest,
  isBikeQuest,
  resolveQuestMapCenter,
} from '@/screens/tabs/QuestsScreen.helpers';

describe('QuestsScreen helpers', () => {
  it('maps quest country codes shown in the catalog to country names', () => {
    expect(getQuestCountryName('DE')).toBe('Германия');
    expect(getQuestCountryName('FR')).toBe('Франция');
    expect(getQuestCountryName('NL')).toBe('Нидерланды');
    // Регресс: раньше эти коды отсутствовали и заголовок группы падал на сырой
    // код («GR», «HR», …) вместо русского названия страны.
    expect(getQuestCountryName('GR')).toBe('Греция');
    expect(getQuestCountryName('HR')).toBe('Хорватия');
    expect(getQuestCountryName('IT')).toBe('Италия');
    expect(getQuestCountryName('PT')).toBe('Португалия');
    expect(getQuestCountryName('RO')).toBe('Румыния');
    expect(getQuestCountryName('RS')).toBe('Сербия');
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
    const missing = codes.filter((code) => !COUNTRY_NAME_KEYS[code]);
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
    expect(DEFAULT_NEARBY_RADIUS_KM).toBe(30);
  });

  describe('isKidsQuest', () => {
    it('detects the kids tag among other tags', () => {
      expect(isKidsQuest(['family', 'kids', 'city'])).toBe(true);
      expect(isKidsQuest(['kids'])).toBe(true);
      expect(isKidsQuest(['age-5-7'])).toBe(true);
      expect(isKidsQuest(['age-8-10'])).toBe(true);
      expect(isKidsQuest(['age-11-14'])).toBe(true);
      expect(isKidsQuest(['teens'])).toBe(true);
    });

    it('is case- and whitespace-insensitive', () => {
      expect(isKidsQuest([' Kids '])).toBe(true);
      expect(isKidsQuest(['KIDS'])).toBe(true);
    });

    it('returns false without the kids tag or without tags', () => {
      expect(isKidsQuest(['family', 'city'])).toBe(false);
      expect(isKidsQuest([])).toBe(false);
      expect(isKidsQuest(undefined)).toBe(false);
      expect(isKidsQuest(null)).toBe(false);
    });
  });

  describe('isBikeQuest', () => {
    it('detects the bike tag and the velo synonym among other tags', () => {
      expect(isBikeQuest(['roadtrip', 'bike', 'nature'])).toBe(true);
      expect(isBikeQuest(['bike'])).toBe(true);
      expect(isBikeQuest(['velo'])).toBe(true);
    });

    it('is case- and whitespace-insensitive', () => {
      expect(isBikeQuest([' Bike '])).toBe(true);
      expect(isBikeQuest(['VELO'])).toBe(true);
    });

    it('returns false without the bike tag or without tags', () => {
      expect(isBikeQuest(['roadtrip', 'nature'])).toBe(false);
      expect(isBikeQuest([])).toBe(false);
      expect(isBikeQuest(undefined)).toBe(false);
      expect(isBikeQuest(null)).toBe(false);
    });
  });

  describe('quest audience filters', () => {
    const quests = [
      { id: 'regular-minsk', cityId: 'minsk', tags: ['city'] },
      { id: 'kids-minsk', cityId: 'minsk', tags: ['kids', 'family'] },
      { id: 'regular-brest', cityId: 'brest', tags: null },
      { id: 'kids-grodno', cityId: 'grodno', tags: [' Kids '] },
      { id: 'teens-vitebsk', cityId: 'vitebsk', tags: ['age-11-14', 'teens'] },
    ];

    it('keeps kids quests in their city and merges duplicate backend city ids', () => {
      const catalog = buildQuestCityCatalog(
        [
          { id: 'minsk-main', name: 'Минск', countryCode: 'BY' },
          { id: 'minsk-kids', name: ' минск ', countryCode: 'BY' },
          { id: 'brest', name: 'Брест', countryCode: 'BY' },
          { id: 'grodno', name: 'Гродно', countryCode: 'BY' },
          { id: 'vitebsk', name: 'Витебск', countryCode: 'BY' },
        ],
        quests.map((quest) => ({
          ...quest,
          cityId: quest.id === 'kids-minsk' ? 'minsk-kids' : quest.cityId === 'minsk' ? 'minsk-main' : quest.cityId,
          cityName: quest.cityId === 'minsk' ? 'Минск' : undefined,
          countryCode: 'BY',
        })),
      );

      expect(catalog.cities.map((city) => city.id)).toEqual(['minsk-main', 'brest', 'grodno', 'vitebsk']);
      expect(catalog.questsByCityId['minsk-main'].map((quest) => quest.id)).toEqual(['regular-minsk', 'kids-minsk']);
      expect(catalog.questsByCityId.brest.map((quest) => quest.id)).toEqual(['regular-brest']);
      expect(catalog.questsByCityId.grodno.map((quest) => quest.id)).toEqual(['kids-grodno']);
      expect(catalog.questsByCityId.vitebsk.map((quest) => quest.id)).toEqual(['teens-vitebsk']);
      expect(catalog.canonicalCityIdById['minsk-kids']).toBe('minsk-main');
    });

    it('also collects kids quests for the audience filter', () => {
      expect(filterKidsQuests(quests).map((quest) => quest.id)).toEqual([
        'kids-minsk',
        'kids-grodno',
        'teens-vitebsk',
      ]);
    });
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

  it('centers on the explicitly selected city over the user location', () => {
    // Регресс: выбор города в боковом меню не двигал карту, потому что
    // геолокация пользователя (далеко от города) была приоритетнее — маркер
    // города не появлялся.
    const center = resolveQuestMapCenter({
      searchTerm: '',
      mapPoints: [{ coord: '53.14,29.22' }],
      activeMapAreaCenter: null,
      userLoc: { lat: 50.06, lng: 19.94 },
      selectedCity: { lat: 53.14, lng: 29.22 },
    });

    expect(center).toEqual({ latitude: 53.14, longitude: 29.22 });
  });

  it('falls back to the user location when no city is selected (Рядом)', () => {
    const center = resolveQuestMapCenter({
      searchTerm: '',
      mapPoints: [{ coord: '53.9,27.56' }],
      activeMapAreaCenter: null,
      userLoc: { lat: 50.06, lng: 19.94 },
      selectedCity: null,
    });

    expect(center).toEqual({ latitude: 50.06, longitude: 19.94 });
  });
});
