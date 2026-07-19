import { distanceKm } from '@/hooks/map/useSearchThisArea';

// Прямой юнит на haversine, вынесенный из useMapScreenController. Формула должна
// остаться идентичной исходной (F-49): пороги «Искать в этой области» завязаны
// на неё, поэтому округление/константы не «улучшаем».

describe('distanceKm (haversine, F-49)', () => {
  it('нулевое расстояние для совпадающих точек', () => {
    expect(distanceKm({ latitude: 53.9, longitude: 27.5667 }, { latitude: 53.9, longitude: 27.5667 })).toBe(0);
  });

  it('1° широты ≈ 111 км', () => {
    const d = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(111);
    expect(d).toBeLessThan(112);
  });

  it('симметрично относительно порядка аргументов', () => {
    const a = { latitude: 53.9, longitude: 27.5667 };
    const b = { latitude: 53.4, longitude: 27.5667 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });

  it('соответствует опорной величине ~26 км для просадки fitBounds', () => {
    // 53.9 → 53.666 по долготе Минска ≈ 26 км (см. FIT_SETTLE в searchThisArea-тесте).
    const d = distanceKm({ latitude: 53.9, longitude: 27.5667 }, { latitude: 53.666, longitude: 27.5667 });
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(27);
  });
});
