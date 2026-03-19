import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEASUREMENT_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4;
const API_SECRET = process.env.EXPO_PUBLIC_GOOGLE_API_SECRET;
const ANALYTICS_CLIENT_ID_KEY = 'metravel_ga4_client_id';
let hasWarnedMissingConfig = false;
let cachedClientId: string | null = null;
let clientIdRequest: Promise<string> | null = null;

const generateClientId = () => `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
const MAX_YANDEX_GOAL_NAME_LENGTH = 64;

const getPersistentClientId = async () => {
    if (cachedClientId) {
        return cachedClientId;
    }

    if (clientIdRequest) {
        return clientIdRequest;
    }

    clientIdRequest = (async () => {
        try {
            const storedClientId = await AsyncStorage.getItem(ANALYTICS_CLIENT_ID_KEY);
            if (storedClientId) {
                cachedClientId = storedClientId;
                return storedClientId;
            }
        } catch {
            // ignore storage read issues and fall back to a generated anonymous id
        }

        const generatedClientId = generateClientId();
        cachedClientId = generatedClientId;

        try {
            await AsyncStorage.setItem(ANALYTICS_CLIENT_ID_KEY, generatedClientId);
        } catch {
            // ignore storage write issues and keep the in-memory id for the current session
        }

        return generatedClientId;
    })();

    try {
        return await clientIdRequest;
    } finally {
        clientIdRequest = null;
    }
};

const toYandexGoalName = (eventName: string) =>
    String(eventName || '')
        .trim()
        .replace(/[^A-Za-z0-9_]/g, '_')
        .slice(0, MAX_YANDEX_GOAL_NAME_LENGTH);

export const sendAnalyticsEvent = async (
    eventName: string,
    eventParams: Record<string, unknown> = {}
) => {
    // Unit/integration tests should be silent and must never make network calls.
    // Jest sets JEST_WORKER_ID; also keep the NODE_ENV guard for other runners.
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null) {
        return;
    }

    // Web: use gtag.js (already injected in app/+html.tsx) instead of Measurement Protocol.
    // Measurement Protocol from the browser triggers CORS and exposes api_secret.
    if (Platform.OS === 'web') {
        const w = typeof window !== 'undefined' ? (window as any) : undefined;
        const gtag = w?.gtag;
        const ym = w?.ym;
        const metrikaId = Number(w?.__metravelMetrikaId || 0);
        const yandexGoalName = toYandexGoalName(eventName);
        let sentAnyEvent = false;

        if (typeof gtag === 'function') {
            try {
                gtag('event', eventName, eventParams);
                sentAnyEvent = true;
            } catch (error) {
                console.error('GA4 gtag Error:', error);
            }
        }

        if (
            typeof ym === 'function' &&
            metrikaId > 0 &&
            w?.__metravelMetrikaReady &&
            yandexGoalName.length > 0
        ) {
            try {
                ym(metrikaId, 'reachGoal', yandexGoalName, eventParams);
                sentAnyEvent = true;
            } catch (error) {
                console.error('Yandex Metrika reachGoal Error:', error);
            }
        }

        if (sentAnyEvent) {
            return;
        }

        // GA bootstraps lazily after consent/idle; missing gtag early is expected in production.
        if (__DEV__ && !hasWarnedMissingConfig) {
            console.warn('Analytics: web analytics is not available yet – event skipped.');
            hasWarnedMissingConfig = true;
        }
        return;
    }

    // Native / non-web fallback: Measurement Protocol.
    // NOTE: api_secret should ideally live on a server, not in a public env var.
    if (!MEASUREMENT_ID || !API_SECRET) {
        if (!hasWarnedMissingConfig) {
            console.warn('GA4: Missing MEASUREMENT_ID or API_SECRET – analytics event skipped. Provide EXPO_PUBLIC_GOOGLE_GA4 and EXPO_PUBLIC_GOOGLE_API_SECRET to enable.');
            hasWarnedMissingConfig = true;
        }
        return;
    }

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
    const clientId = await getPersistentClientId();
    const body = {
        client_id: clientId,
        events: [
            {
                name: eventName,
                params: eventParams,
            },
        ],
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error(`GA4 Error [${res.status}]:`, await res.text());
        } else {
            // GA event sent successfully
        }
    } catch (error) {
        console.error('GA4 Fetch Error:', error);
    }
};

export const trackWizardEvent = async (
    eventName: string,
    params: Record<string, unknown> = {}
) => {
    return sendAnalyticsEvent(eventName, params);
};

export const queueAnalyticsEvent = (eventName: string, eventParams: Record<string, unknown> = {}) => {
    if (process.env.NODE_ENV === 'test') {
        try {
            if (typeof sendAnalyticsEvent === 'function') {
                const isEmptyParams = !eventParams || Object.keys(eventParams).length === 0;
                if (isEmptyParams) {
                    sendAnalyticsEvent(eventName);
                } else {
                    sendAnalyticsEvent(eventName, eventParams);
                }
            }
        } catch {
            // noop
        }
        return;
    }

    const run = () => {
        import('@/utils/analytics')
            .then((m) => m.sendAnalyticsEvent(eventName, eventParams))
            .catch(() => {
                // noop
            });
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(run, { timeout: 2000 });
        return;
    }

    setTimeout(run, 0);
};
