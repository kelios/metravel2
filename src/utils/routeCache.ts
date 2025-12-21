interface CacheEntry {
  coords: [number, number][];
  distance: number;
  timestamp: number;
}

interface RateLimitState {
  lastRequestTime: number;
  requestCount: number;
  resetTime: number;
}

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const RATE_LIMIT_WINDOW = 1000 * 60; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30; // Conservative limit for free tier
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

class RouteCache {
  private cache: Map<string, CacheEntry> = new Map();
  private rateLimitState: RateLimitState = {
    lastRequestTime: 0,
    requestCount: 0,
    resetTime: Date.now() + RATE_LIMIT_WINDOW,
  };

  private generateKey(
    points: [number, number][],
    transportMode: string
  ): string {
    const pointsStr = points.map(p => p.join(',')).join('|');
    return `${transportMode}:${pointsStr}`;
  }

  get(
    points: [number, number][],
    transportMode: string
  ): CacheEntry | null {
    const key = this.generateKey(points, transportMode);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(
    points: [number, number][],
    transportMode: string,
    coords: [number, number][],
    distance: number
  ): void {
    const key = this.generateKey(points, transportMode);
    this.cache.set(key, {
      coords,
      distance,
      timestamp: Date.now(),
    });
  }

  canMakeRequest(): boolean {
    const now = Date.now();

    // Reset rate limit window if expired
    if (now >= this.rateLimitState.resetTime) {
      this.rateLimitState = {
        lastRequestTime: 0,
        requestCount: 0,
        resetTime: now + RATE_LIMIT_WINDOW,
      };
    }

    // Check if we've exceeded the rate limit
    if (this.rateLimitState.requestCount >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    // Check minimum interval between requests
    if (now - this.rateLimitState.lastRequestTime < MIN_REQUEST_INTERVAL) {
      return false;
    }

    return true;
  }

  recordRequest(): void {
    this.rateLimitState.lastRequestTime = Date.now();
    this.rateLimitState.requestCount++;
  }

  getTimeUntilNextRequest(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimitState.lastRequestTime;
    const timeUntilMinInterval = Math.max(0, MIN_REQUEST_INTERVAL - timeSinceLastRequest);

    if (this.rateLimitState.requestCount >= MAX_REQUESTS_PER_MINUTE) {
      const timeUntilReset = Math.max(0, this.rateLimitState.resetTime - now);
      return Math.max(timeUntilMinInterval, timeUntilReset);
    }

    return timeUntilMinInterval;
  }

  clear(): void {
    this.cache.clear();
    this.rateLimitState = {
      lastRequestTime: 0,
      requestCount: 0,
      resetTime: Date.now() + RATE_LIMIT_WINDOW,
    };
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      requestCount: this.rateLimitState.requestCount,
      timeUntilReset: Math.max(0, this.rateLimitState.resetTime - Date.now()),
      canMakeRequest: this.canMakeRequest(),
    };
  }
}

export const routeCache = new RouteCache();
