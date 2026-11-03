interface CacheEntry {
  coords: [number, number][];
  distance: number;
  duration: number;
  timestamp: number;
}

interface RateLimitState {
  lastRequestTime: number;
  requestCount: number;
  resetTime: number;
}

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_ENTRIES = 64;
const MAX_CACHE_COORDINATES = 50_000;
const MAX_CACHE_KEY_CHARS = 64_000;
const RATE_LIMIT_WINDOW = 1000 * 60; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30; // Conservative limit for free tier
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

class RouteCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cachedCoordinates = 0;
  private cachedKeyChars = 0;
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

  private evict(key: string, entry: CacheEntry): void {
    this.cache.delete(key);
    this.cachedCoordinates -= entry.coords.length;
    this.cachedKeyChars -= key.length;
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
      this.evict(key, entry);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(
    points: [number, number][],
    transportMode: string,
    coords: [number, number][],
    distance: number,
    duration: number = 0
  ): void {
    const key = this.generateKey(points, transportMode);
    const now = Date.now();
    for (const [cachedKey, entry] of this.cache) {
      if (cachedKey === key || now - entry.timestamp > CACHE_DURATION) {
        this.evict(cachedKey, entry);
      }
    }
    if (coords.length > MAX_CACHE_COORDINATES || key.length > MAX_CACHE_KEY_CHARS) return;

    this.cache.set(key, {
      coords,
      distance,
      duration,
      timestamp: now,
    });
    this.cachedCoordinates += coords.length;
    this.cachedKeyChars += key.length;
    for (const [oldestKey, entry] of this.cache) {
      if (
        this.cache.size <= MAX_CACHE_ENTRIES &&
        this.cachedCoordinates <= MAX_CACHE_COORDINATES &&
        this.cachedKeyChars <= MAX_CACHE_KEY_CHARS
      ) break;
      this.evict(oldestKey, entry);
    }
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
    this.cachedCoordinates = 0;
    this.cachedKeyChars = 0;
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
