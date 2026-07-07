import {
  COUNTRY_NAMES,
  filterQuestsByMapSearchArea,
  isCoordinateInMapViewport,
} from '@/screens/tabs/QuestsScreen.helpers';

describe('QuestsScreen helpers', () => {
  it('maps quest country codes shown in the catalog to country names', () => {
    expect(COUNTRY_NAMES.DE).toBe('Германия');
    expect(COUNTRY_NAMES.FR).toBe('Франция');
    expect(COUNTRY_NAMES.NL).toBe('Нидерланды');
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
});
