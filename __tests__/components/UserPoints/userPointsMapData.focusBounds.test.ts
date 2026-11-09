import { getUserPointsFocusBounds } from '@/components/UserPoints/userPointsMapData';

// #3131: стартовая область карты — там, где точек больше всего, а не рамка по
// выбросам, из-за которой карта открывалась на весь мир.
describe('getUserPointsFocusBounds', () => {
  const cluster = Array.from({ length: 20 }, (_, i) => ({
    latitude: 53 + (i % 5) * 0.5,
    longitude: 24 + Math.floor(i / 5) * 0.5,
  }));

  it('returns null without coordinates', () => {
    expect(getUserPointsFocusBounds([])).toBeNull();
    expect(getUserPointsFocusBounds([{ latitude: NaN, longitude: 1 }])).toBeNull();
  });

  it('keeps the dense 90 % and drops far outliers', () => {
    const outliers = [
      { latitude: 18.5, longitude: -69.9 }, // Карибы
      { latitude: 19.1, longitude: 72.9 }, // Индия
    ];
    const bounds = getUserPointsFocusBounds([...cluster, ...outliers]);
    expect(bounds).not.toBeNull();
    const [[minLat, minLng], [maxLat, maxLng]] = bounds!;
    expect(minLat).toBeGreaterThanOrEqual(53);
    expect(maxLat).toBeLessThanOrEqual(55);
    expect(minLng).toBeGreaterThanOrEqual(24);
    expect(maxLng).toBeLessThanOrEqual(26);
  });

  it('covers all points when there are two or fewer', () => {
    const bounds = getUserPointsFocusBounds([
      { latitude: 53.9, longitude: 27.5 },
      { latitude: 18.5, longitude: -69.9 },
    ]);
    expect(bounds).toEqual([
      [18.5, -69.9],
      [53.9, 27.5],
    ]);
  });

  it('share=1 keeps every point', () => {
    const outlier = { latitude: -20.2, longitude: 57.5 };
    const bounds = getUserPointsFocusBounds([...cluster, outlier], 1);
    expect(bounds![0][0]).toBe(-20.2);
  });
});

describe('getUserPointsCenter (#3135)', () => {
  const { getUserPointsCenter } = require('@/components/UserPoints/userPointsMapData')
  it('геолокация → центр коллекции → null (без зашитой столицы)', () => {
    expect(getUserPointsCenter({ lat: 50, lng: 20 }, [{ latitude: 10, longitude: 10 }] as any)).toEqual({ lat: 50, lng: 20 })
    expect(getUserPointsCenter(undefined, [{ latitude: 10, longitude: 10 }, { latitude: 20, longitude: 30 }] as any)).toEqual({ lat: 15, lng: 20 })
    expect(getUserPointsCenter(undefined, [])).toBeNull()
  })
  it('пины с координатой-строкой или null не дают NaN: считаются только конечные числа', () => {
    const pins = [{ latitude: '10', longitude: '10' }, { latitude: null, longitude: null }, { latitude: 20, longitude: 30 }]
    expect(getUserPointsCenter(undefined, pins as any)).toEqual({ lat: 15, lng: 20 })
    expect(getUserPointsCenter(undefined, [{ latitude: null, longitude: undefined }] as any)).toBeNull()
  })
})
