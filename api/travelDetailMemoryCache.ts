// api/travelDetailMemoryCache.ts
// Guest-only in-memory caches for travel details (API-3). Extracted from
// travelDetailsQueries.ts so that module stays under the 800-LOC guard.
import type { Travel } from '@/types/types';
import { useAuthStore } from '@/stores/authStore';

const travelCache = new Map<number, Travel>();
const travelSlugCache = new Map<string, Travel>();

/**
 * The caches hold at most this many public payloads (insertion order, oldest
 * evicted) and are dropped whenever the session owner changes: a payload fetched
 * by a signed-in session may carry private fields and must never be served to
 * the next guest in the same tab.
 */
const GUEST_TRAVEL_CACHE_LIMIT = 50;

export const getSlugCacheKey = (slug: string): string =>
    String(slug || '').replace(/^\/+/, '').trim();

const remember = <K>(cache: Map<K, Travel>, key: K, travel: Travel): void => {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, travel);
    if (cache.size <= GUEST_TRAVEL_CACHE_LIMIT) return;
    for (const oldestKey of cache.keys()) {
        cache.delete(oldestKey);
        break;
    }
};

export const guestTravelMemoryCache = {
    getById: (id: number): Travel | undefined => travelCache.get(id),
    getBySlugKey: (slugKey: string): Travel | undefined => travelSlugCache.get(slugKey),
    rememberById: (id: number, travel: Travel): void => remember(travelCache, id, travel),
    rememberBySlugKey: (slugKey: string, travel: Travel): void =>
        remember(travelSlugCache, slugKey, travel),
};

export const clearTravelDetailMemoryCache = (): void => {
    travelCache.clear();
    travelSlugCache.clear();
};

export const invalidateTravelDetailMemoryCache = (
    ...travelKeys: Array<string | number | null | undefined>
): void => {
    travelKeys.forEach((key) => {
        if (key == null) return;
        const normalizedKey = String(key).trim();
        if (!normalizedKey) return;

        const numericId = Number(normalizedKey);
        if (Number.isFinite(numericId) && numericId > 0) {
            travelCache.delete(numericId);
            return;
        }

        travelSlugCache.delete(getSlugCacheKey(normalizedKey));
    });
};

// `undefined` — no fetch has observed the session yet. Compared lazily on every
// read instead of a module-scope store subscription, so the module stays inert
// for callers (and tests) that never touch the detail queries.
let observedSessionIdentity: string | null | undefined;

/**
 * Synchronous on purpose: callers keep their original `await` shape (one token
 * read on native, none on web), so in-flight dedupe timing is unchanged.
 *
 * Returns the auth-store view of the session. Native callers still treat the
 * stored access token as authoritative; on web the session is an HttpOnly
 * cookie invisible to JS, so this flag is the only signal — reading the (always
 * empty) token store there treated every signed-in web user as a guest and let
 * their payloads land in the guest caches above.
 */
export const observeTravelDetailSession = (): { isAuthenticated: boolean } => {
    const { isAuthenticated, userId } = useAuthStore.getState();
    const identity = isAuthenticated ? String(userId ?? '') : null;
    if (observedSessionIdentity !== undefined && observedSessionIdentity !== identity) {
        clearTravelDetailMemoryCache();
    }
    observedSessionIdentity = identity;
    return { isAuthenticated };
};
