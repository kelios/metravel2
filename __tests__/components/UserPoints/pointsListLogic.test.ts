import {
  POINTS_PRESETS,
  haversineKm,
  normalizeCategoryIdsFromPoint,
  pickRandomDistinct,
  sortPointsByPresetProximity,
} from '@/components/UserPoints/pointsListLogic';

describe('pointsListLogic', () => {
  it('exposes presets for quick recommendations', () => {
    expect(POINTS_PRESETS.length).toBeGreaterThan(0);
    expect(POINTS_PRESETS.some((p) => p.id === 'nature')).toBe(true);
  });

  it('calculates haversine distance', () => {
    const d = haversineKm(53.9, 27.56, 53.9, 27.57);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(2);
  });

  it('normalizes category ids from multiple payload shapes', () => {
    expect(normalizeCategoryIdsFromPoint({ category_ids: [1, '2', ' 3 '] })).toEqual(['1', '2', '3']);
    expect(normalizeCategoryIdsFromPoint({ categoryId: '9' })).toEqual(['9']);
    expect(normalizeCategoryIdsFromPoint({ category: 7 })).toEqual(['7']);
    expect(normalizeCategoryIdsFromPoint(null)).toEqual([]);
  });

  it('returns unique random items with requested count', () => {
    const spy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.9);

    const result = pickRandomDistinct([10, 20, 30, 40], 3);
    expect(result.length).toBe(3);
    expect(new Set(result).size).toBe(3);

    spy.mockRestore();
  });

  it('sorts points by nearby preset category score', () => {
    const activePreset = POINTS_PRESETS.find((p) => p.id === 'nature') ?? null;
    const points = [
      { id: 1, name: 'A', latitude: 53.9, longitude: 27.56, categoryIds: ['lake'] },
      { id: 2, name: 'B', latitude: 53.9002, longitude: 27.5602, categoryIds: ['rock'] },
      { id: 3, name: 'C', latitude: 54.5, longitude: 28.2, categoryIds: ['city'] },
    ];

    const sorted = sortPointsByPresetProximity(points, activePreset, (names) =>
      names.includes('Скала') ? ['rock'] : []
    );

    expect(sorted[0]?.id).toBe(1);
  });
});
