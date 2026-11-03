import { Travel } from '@/types/types';
import { apiClient } from '@/api/client';
import { devError, devWarn } from '@/utils/logger';
import { getSecureItem } from '@/utils/secureStorage';
import { shouldUseStoredAuthToken } from '@/utils/authPlatform';
import {
    getPublicStalePayloadMeta,
    isRecoverablePublicStaleError,
    markPublicStalePayload,
    readPublicStalePayload,
    savePublicStalePayload,
} from '@/utils/publicStaleCache';
import { normalizeTravelItem } from './travelsNormalize';
import {
    LONG_TIMEOUT,
    TOKEN_KEY,
    isAbortError,
} from './travelQueryShared';
import {
    getSlugCacheKey,
    guestTravelMemoryCache,
    observeTravelDetailSession,
} from './travelDetailMemoryCache';

export {
    clearTravelDetailMemoryCache,
    invalidateTravelDetailMemoryCache,
} from './travelDetailMemoryCache';

type GuestTravelRequest = {
    controller: AbortController;
    observers: number;
    promise: Promise<Travel>;
};

const travelInFlight = new Map<string, GuestTravelRequest>();

type PublicTravelRequestOptions = { signal?: AbortSignal; skipAuth?: boolean };
type FetchTravelOptions = PublicTravelRequestOptions & { forceRefresh?: boolean };

type ResolveTravelSlugResponse = {
    id?: unknown;
    slug?: unknown;
    url?: unknown;
    canonical_url?: unknown;
    status?: unknown;
    item?: unknown;
};

type TravelPreloadWindow = Window & typeof globalThis & {
    __metravelTravelPreload?: {
        data?: unknown;
        slug?: string;
        isId?: boolean;
        source?: string;
    };
    __metravelTravelPreloadPending?: boolean;
    __metravelTravelPreloadPromise?: Promise<unknown>;
};

const createTravelAbortError = (): Error =>
    Object.assign(new Error('Aborted'), { name: 'AbortError' });

const assertTravelRequestActive = (signal?: AbortSignal): void => {
    if (signal?.aborted) throw createTravelAbortError();
};

const runSharedGuestTravelRequest = async (
    key: string,
    request: (signal: AbortSignal) => Promise<Travel>,
    signal?: AbortSignal,
): Promise<Travel> => {
    assertTravelRequestActive(signal);
    const pending = travelInFlight.get(key) ?? startGuestTravelRequest(key, request);
    pending.observers += 1;

    return new Promise((resolve, reject) => {
        let observing = true;
        const release = () => {
            if (!observing) return false;
            observing = false;
            signal?.removeEventListener('abort', onAbort);
            pending.observers -= 1;
            return true;
        };
        const onAbort = () => {
            if (!release()) return;
            if (pending.observers === 0 && travelInFlight.get(key) === pending) {
                travelInFlight.delete(key);
                pending.controller.abort();
            }
            reject(createTravelAbortError());
        };
        signal?.addEventListener('abort', onAbort);
        pending.promise.then(
            (travel) => {
                if (release()) resolve(travel);
            },
            (error: unknown) => {
                if (release()) reject(error);
            },
        );
        if (signal?.aborted) onAbort();
    });
};

const startGuestTravelRequest = (
    key: string,
    request: (signal: AbortSignal) => Promise<Travel>,
): GuestTravelRequest => {
    const controller = new AbortController();
    const pending: GuestTravelRequest = {
        controller,
        observers: 0,
        promise: request(controller.signal).finally(() => {
            if (travelInFlight.get(key) === pending) travelInFlight.delete(key);
        }),
    };
    travelInFlight.set(key, pending);
    return pending;
};

const hasMinimumTravelIdentity = (travel: Travel | undefined): travel is Travel => {
    if (!travel) return false;
    const hasName = typeof travel.name === 'string' && travel.name.trim().length > 0;
    return hasAnyTravelIdentity(travel) && hasName;
};

// Lighter check than hasMinimumTravelIdentity: a payload with an id or slug is a
// real travel even if minimal; a 301-followed HTML page parses into `{}` and fails.
const hasAnyTravelIdentity = (travel: Travel | undefined): boolean => {
    if (!travel) return false;
    return (
        (typeof travel.id === 'number' && Number.isFinite(travel.id) && travel.id > 0) ||
        (typeof travel.slug === 'string' && travel.slug.trim().length > 0)
    );
};

// The resolve-slug `item` may be a lightweight card payload (rich_text/points/media
// only, without description/travelAddress/coordsMeTravel/countries). Returning it as
// the detail loses the article body and the route map on SPA navigation. Card payloads
// are recognized by `points` replacing the legacy route arrays; an item with a legacy
// description and no card markers is a full detail even without route arrays.
const hasFullTravelDetailPayload = (travel: Travel | undefined): boolean => {
    if (!travel) return false;
    const t = travel as Record<string, unknown>;
    if (typeof t.description !== 'string' || t.description.length === 0) {
        return false;
    }
    const hasRouteFields =
        Array.isArray(t.travelAddress) || Array.isArray(t.coordsMeTravel);
    const looksLikeCardPayload = Array.isArray(t.points) && !hasRouteFields;
    return !looksLikeCardPayload;
};

const consumeDirectApiWindowPreload = (
    key: string | number,
    isId: boolean
): Travel | undefined => {
    if (typeof window === 'undefined') return undefined;
    const win = window as TravelPreloadWindow;
    const preload = win.__metravelTravelPreload;
    if (preload?.source !== 'direct-api' || !preload.data) return undefined;

    const matches = isId
        ? preload.isId && String(preload.slug) === String(key)
        : !preload.isId && getSlugCacheKey(String(preload.slug || '')) === String(key);
    if (!matches) return undefined;

    try {
        const normalized = normalizeTravelItem(preload.data);
        if (!hasMinimumTravelIdentity(normalized)) return undefined;
        return normalized;
    } catch {
        return undefined;
    }
};

const waitForDirectApiWindowPreload = async (
    key: string | number,
    isId: boolean
): Promise<Travel | undefined> => {
    if (typeof window === 'undefined') return undefined;
    const immediate = consumeDirectApiWindowPreload(key, isId);
    if (immediate) return immediate;

    const win = window as TravelPreloadWindow;
    if (!win.__metravelTravelPreloadPending && !win.__metravelTravelPreloadPromise) return undefined;

    try {
        await Promise.race([
            win.__metravelTravelPreloadPromise ?? Promise.resolve(),
            new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
    } catch {
        // noop
    }

    return consumeDirectApiWindowPreload(key, isId);
};

const getErrorStatus = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') return null;
    const rawStatus =
        (error as { status?: unknown }).status ??
        ((error as { response?: { status?: unknown } }).response?.status);
    const status = Number(rawStatus);
    return Number.isFinite(status) ? status : null;
};

const readStaleTravelDetail = async (endpoint: string): Promise<Travel | null> => {
    const stale = await readPublicStalePayload<Travel>(endpoint);
    if (!stale) return null;
    const meta = getPublicStalePayloadMeta(stale);
    const normalized = normalizeTravelItem(stale);
    return meta ? markPublicStalePayload(normalized, meta) : normalized;
};

const saveStaleTravelDetail = async (endpoint: string, travel: Travel): Promise<void> => {
    await savePublicStalePayload(endpoint, travel, { method: 'GET' });
};

// Canonical backend resolver for exact, redirected, and fuzzy travel slugs.
// A full detail in `item` avoids a second request.
const fetchTravelByResolvedSlug = async (
    slug: string,
    options: PublicTravelRequestOptions,
): Promise<Travel | null> => {
    const response = await apiClient.get<ResolveTravelSlugResponse>(
        `/travels/resolve-slug/${encodeURIComponent(slug)}/`,
        LONG_TIMEOUT,
        { ...options, skipAuth: true }
    );
    assertTravelRequestActive(options.signal);

    let lightResolvedItem: Travel | null = null;
    if (response?.item) {
        const normalized = normalizeTravelItem(response.item as Travel);
        if (hasAnyTravelIdentity(normalized)) {
            if (hasFullTravelDetailPayload(normalized)) return normalized;
            lightResolvedItem = normalized;
        }
    }

    const detailLikeResponse = normalizeTravelItem(response as Travel);
    if (hasMinimumTravelIdentity(detailLikeResponse)) return detailLikeResponse;

    const id = Number(response?.id ?? lightResolvedItem?.id);
    if (!Number.isFinite(id) || id <= 0) return lightResolvedItem;

    const detailedTravel = await fetchTravel(id, options);
    const normalized = normalizeTravelItem(detailedTravel);
    if (!hasAnyTravelIdentity(normalized)) return null;

    if (__DEV__) {
        devWarn('Resolved travel via canonical slug resolver', {
            requestedSlug: slug,
            resolvedSlug: normalized.slug,
            id,
            status: response?.status,
        });
    }
    return normalized;
};

export const fetchTravel = async (
    id: number,
    options?: FetchTravelOptions
): Promise<Travel> => {
    // Native: the stored token is authoritative. Web: the auth store decides
    // (HttpOnly cookie session, see travelDetailMemoryCache). Inlined on purpose:
    // the guest in-flight dedupe depends on exactly this microtask shape.
    assertTravelRequestActive(options?.signal);
    const session = observeTravelDetailSession();
    const isAuthenticated = !options?.skipAuth && (shouldUseStoredAuthToken()
        ? Boolean(await getSecureItem(TOKEN_KEY))
        : session.isAuthenticated);
    assertTravelRequestActive(options?.signal);
    const cacheKey = `id:${id}`;

    if (!isAuthenticated && !options?.forceRefresh) {
        const cached = guestTravelMemoryCache.getById(id);
        if (cached) return cached;
    }

    if (!isAuthenticated) {
        if (!options?.forceRefresh) {
            const preloaded = await waitForDirectApiWindowPreload(id, true);
            assertTravelRequestActive(options?.signal);
            if (preloaded) {
                guestTravelMemoryCache.rememberById(id, preloaded);
                await saveStaleTravelDetail(`/travels/${id}/`, preloaded);
                return preloaded;
            }
        }

        const fetchFreshTravel = async (signal?: AbortSignal) => {
            const endpoint = `/travels/${id}/`;
            try {
                const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                    signal,
                    skipAuth: true,
                });
                assertTravelRequestActive(signal);
                const normalized = normalizeTravelItem(travel);
                guestTravelMemoryCache.rememberById(id, normalized);
                if (typeof normalized.slug === 'string' && normalized.slug.trim()) {
                    guestTravelMemoryCache.rememberBySlugKey(getSlugCacheKey(normalized.slug), normalized);
                }
                await saveStaleTravelDetail(endpoint, normalized);
                return normalized;
            } catch (e: unknown) {
                assertTravelRequestActive(signal);
                if (isAbortError(e)) throw e;
                if (isRecoverablePublicStaleError(e)) {
                    const stale = await readStaleTravelDetail(endpoint);
                    if (stale) return stale;
                }
                devError('Error fetching Travel:', e);
                throw e;
            }
        };

        // Static travel HTML intentionally provides an instant first-paint snapshot.
        // A post-hydration refresh must bypass both that preload and the in-memory
        // guest cache, otherwise recently edited captions/content stay invisible
        // until the next frontend deploy.
        if (options?.forceRefresh) return fetchFreshTravel(options.signal);

        return runSharedGuestTravelRequest(cacheKey, fetchFreshTravel, options?.signal);
    }

    const endpoint = `/travels/${id}/`;
    try {
        const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, { signal: options?.signal });
        const normalized = normalizeTravelItem(travel);
        return normalized;
    } catch (e: unknown) {
        if (isAbortError(e)) throw e;
        // Public travel detail: recover from a stale/expired token by retrying without
        // auth instead of failing the whole page. The token is left untouched.
        if (getErrorStatus(e) === 401) {
            const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, {
                signal: options?.signal,
                skipAuth: true,
            });
            const normalized = normalizeTravelItem(travel);
            await saveStaleTravelDetail(endpoint, normalized);
            return normalized;
        }
        if (!isAuthenticated && isRecoverablePublicStaleError(e)) {
            const stale = await readStaleTravelDetail(endpoint);
            if (stale) return stale;
        }
        devError('Error fetching Travel:', e);
        throw e;
    }
};

export const fetchTravelBySlug = async (
    slug: string,
    options?: { signal?: AbortSignal }
): Promise<Travel> => {
    // Native: the stored token is authoritative. Web: the auth store decides
    // (HttpOnly cookie session, see travelDetailMemoryCache). Inlined on purpose:
    // the guest in-flight dedupe depends on exactly this microtask shape.
    assertTravelRequestActive(options?.signal);
    const session = observeTravelDetailSession();
    const isAuthenticated = shouldUseStoredAuthToken()
        ? Boolean(await getSecureItem(TOKEN_KEY))
        : session.isAuthenticated;
    assertTravelRequestActive(options?.signal);
    const slugCacheKey = getSlugCacheKey(slug);
    const cacheKey = `slug:${slugCacheKey}`;

    if (!isAuthenticated) {
        const cached = guestTravelMemoryCache.getBySlugKey(slugCacheKey);
        if (cached) return cached;
    }

    const fetchBySlug = async (requestOptions: PublicTravelRequestOptions) => {
        const safeSlug = encodeURIComponent(slugCacheKey);
        const endpoint = `/travels/by-slug/${safeSlug}/`;
        const fetchExact = async (skipAuth: boolean) => {
            const travel = await apiClient.get<Travel>(endpoint, LONG_TIMEOUT, { ...requestOptions, skipAuth });
            assertTravelRequestActive(requestOptions.signal);
            const normalized = normalizeTravelItem(travel);
            if (skipAuth && hasAnyTravelIdentity(normalized)) {
                await saveStaleTravelDetail(endpoint, normalized);
            }
            return normalized;
        };
        try {
            return await fetchExact(Boolean(requestOptions.skipAuth));
        } catch (e: unknown) {
            assertTravelRequestActive(requestOptions.signal);
            // Travel detail is public. A 401 means the stored token is stale/expired
            // (or invalid for the current API backend). Retry once without auth so the
            // public page still loads instead of showing an error — keep the token intact.
            if (isAbortError(e)) throw e;
            if (!requestOptions.skipAuth && getErrorStatus(e) === 401) {
                return fetchExact(true);
            }
            if (requestOptions.skipAuth && isRecoverablePublicStaleError(e)) {
                const stale = await readStaleTravelDetail(endpoint);
                if (stale) return stale;
            }
            throw e;
        }
    };

    const fetchBySlugWithCompatibility = async (signal?: AbortSignal): Promise<Travel> => {
        let resolverError: unknown;
        try {
            const resolvedTravel = await fetchTravelByResolvedSlug(slugCacheKey, { signal, skipAuth: !isAuthenticated });
            assertTravelRequestActive(signal);
            if (resolvedTravel) return resolvedTravel;
            resolverError = Object.assign(new Error('Incomplete travel resolver response'), { status: 502 });
        } catch (error: unknown) {
            assertTravelRequestActive(signal);
            if (isAbortError(error)) throw error;
            resolverError = error;
        }

        const status = getErrorStatus(resolverError);
        const isServerFailure = status !== null && status >= 500 && status < 600;
        // The resolver is public. Only a signed-in viewer can have an exact
        // unpublished item that the public resolver intentionally cannot see.
        if (isServerFailure || (isAuthenticated && status === 404)) {
            try {
                const legacyTravel = await fetchBySlug({ signal, skipAuth: !isAuthenticated });
                assertTravelRequestActive(signal);
                if (hasAnyTravelIdentity(legacyTravel)) return legacyTravel;
            } catch (error: unknown) {
                assertTravelRequestActive(signal);
                if (isAbortError(error)) throw error;
                if (getErrorStatus(error) !== 404) {
                    devError('Error fetching Travel by slug:', error);
                    throw error;
                }
            }
        }

        const finalError = status === 404
            ? Object.assign(new Error(`Travel not found by slug: ${slug}`), { status: 404 })
            : resolverError;
        devError('Error fetching Travel by slug:', finalError);
        throw finalError;
    };

    if (!isAuthenticated) {
        const preloaded = await waitForDirectApiWindowPreload(slugCacheKey, false);
        assertTravelRequestActive(options?.signal);
        if (preloaded) {
            guestTravelMemoryCache.rememberBySlugKey(slugCacheKey, preloaded);
            if (typeof preloaded.id === 'number' && Number.isFinite(preloaded.id) && preloaded.id > 0) {
                guestTravelMemoryCache.rememberById(preloaded.id, preloaded);
            }
            await saveStaleTravelDetail(`/travels/by-slug/${encodeURIComponent(slugCacheKey)}/`, preloaded);
            return preloaded;
        }

        return runSharedGuestTravelRequest(cacheKey, async (signal) => {
            const normalized = await fetchBySlugWithCompatibility(signal);
            assertTravelRequestActive(signal);
            guestTravelMemoryCache.rememberBySlugKey(slugCacheKey, normalized);
            if (typeof normalized.id === 'number' && Number.isFinite(normalized.id) && normalized.id > 0) {
                guestTravelMemoryCache.rememberById(normalized.id, normalized);
            }
            return normalized;
        }, options?.signal);
    }

    return fetchBySlugWithCompatibility(options?.signal);
};
