import { routeCache } from '@/src/utils/routeCache';

describe('routeCache', () => {
  beforeEach(() => {
    routeCache.clear();
    jest.clearAllTimers();
  });

  describe('caching', () => {
    it('should cache route successfully', () => {
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const coords: [number, number][] = [[27.5590, 53.9006], [27.5645, 53.9053], [27.5700, 53.9100]];
      const distance = 5000;

      routeCache.set(points, 'car', coords, distance);

      const cached = routeCache.get(points, 'car');
      expect(cached).not.toBeNull();
      expect(cached?.coords).toEqual(coords);
      expect(cached?.distance).toEqual(distance);
    });

    it('should return null for uncached route', () => {
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const cached = routeCache.get(points, 'car');
      expect(cached).toBeNull();
    });

    it('should differentiate routes by transport mode', () => {
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const carCoords: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const bikeCoords: [number, number][] = [[27.5590, 53.9006], [27.5620, 53.9030], [27.5700, 53.9100]];

      routeCache.set(points, 'car', carCoords, 5000);
      routeCache.set(points, 'bike', bikeCoords, 6000);

      const carCached = routeCache.get(points, 'car');
      const bikeCached = routeCache.get(points, 'bike');

      expect(carCached?.coords).toEqual(carCoords);
      expect(bikeCached?.coords).toEqual(bikeCoords);
    });

    it('should differentiate routes by points', () => {
      const points1: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const points2: [number, number][] = [[27.5590, 53.9006], [27.5800, 53.9200]];
      const coords1: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const coords2: [number, number][] = [[27.5590, 53.9006], [27.5800, 53.9200]];

      routeCache.set(points1, 'car', coords1, 5000);
      routeCache.set(points2, 'car', coords2, 6000);

      const cached1 = routeCache.get(points1, 'car');
      const cached2 = routeCache.get(points2, 'car');

      expect(cached1?.distance).toEqual(5000);
      expect(cached2?.distance).toEqual(6000);
    });

    it('should expire cache after duration', () => {
      jest.useFakeTimers();
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const coords: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];

      routeCache.set(points, 'car', coords, 5000);
      expect(routeCache.get(points, 'car')).not.toBeNull();

      // Advance time by 1 hour + 1 second
      jest.advanceTimersByTime(1000 * 60 * 60 + 1000);

      expect(routeCache.get(points, 'car')).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('rate limiting', () => {
    it('should allow request when not rate limited', () => {
      expect(routeCache.canMakeRequest()).toBe(true);
    });

    it('should record request', () => {
      routeCache.recordRequest();
      const stats = routeCache.getStats();
      expect(stats.requestCount).toBe(1);
    });

    it('should enforce minimum interval between requests', () => {
      jest.useFakeTimers();
      routeCache.recordRequest();
      expect(routeCache.canMakeRequest()).toBe(false);

      // Advance time by 500ms (minimum interval)
      jest.advanceTimersByTime(500);
      expect(routeCache.canMakeRequest()).toBe(true);

      jest.useRealTimers();
    });

    it('should enforce rate limit per minute', () => {
      jest.useFakeTimers();
      const MAX_REQUESTS = 30;

      // Make 30 requests
      for (let i = 0; i < MAX_REQUESTS; i++) {
        routeCache.recordRequest();
        jest.advanceTimersByTime(500); // Advance time to allow next request
      }

      // 31st request should be blocked
      expect(routeCache.canMakeRequest()).toBe(false);

      // Advance time by 1 minute to reset
      jest.advanceTimersByTime(1000 * 60);
      expect(routeCache.canMakeRequest()).toBe(true);

      jest.useRealTimers();
    });

    it('should calculate time until next request', () => {
      jest.useFakeTimers();
      routeCache.recordRequest();

      const timeUntilNext = routeCache.getTimeUntilNextRequest();
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(500);

      jest.useRealTimers();
    });

    it('should reset rate limit after window expires', () => {
      jest.useFakeTimers();

      routeCache.recordRequest();
      expect(routeCache.canMakeRequest()).toBe(false);

      // Advance time by 1 minute + 1 second
      jest.advanceTimersByTime(1000 * 60 + 1000);

      expect(routeCache.canMakeRequest()).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', () => {
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const coords: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];

      routeCache.set(points, 'car', coords, 5000);
      routeCache.recordRequest();

      const stats = routeCache.getStats();

      expect(stats.cacheSize).toBe(1);
      expect(stats.requestCount).toBe(1);
      expect(stats.canMakeRequest).toBe(false);
      expect(stats.timeUntilReset).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear cache and rate limit state', () => {
      const points: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];
      const coords: [number, number][] = [[27.5590, 53.9006], [27.5700, 53.9100]];

      routeCache.set(points, 'car', coords, 5000);
      routeCache.recordRequest();

      routeCache.clear();

      expect(routeCache.get(points, 'car')).toBeNull();
      expect(routeCache.canMakeRequest()).toBe(true);
      expect(routeCache.getStats().cacheSize).toBe(0);
      expect(routeCache.getStats().requestCount).toBe(0);
    });
  });
});
