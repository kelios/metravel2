import { Platform } from 'react-native';
import { readConsent } from '@/utils/consent';

let hasWarnedMissingConfig = false;
const WEB_ANALYTICS_QUEUE_KEY = '__metravelAnalyticsEventQueue';
const WEB_ANALYTICS_LISTENER_KEY = '__metravelAnalyticsQueueListenerAttached';

const MAX_YANDEX_GOAL_NAME_LENGTH = 64;

const toYandexGoalName = (eventName: string) =>
    String(eventName || '')
        .trim()
        .replace(/[^A-Za-z0-9_]/g, '_')
        .slice(0, MAX_YANDEX_GOAL_NAME_LENGTH);

type WebAnalyticsEvent = {
    eventName: string;
    eventParams: Record<string, unknown>;
};

const isWebAnalyticsAllowed = () => {
    const consent = readConsent();
    return !!consent?.analytics;
};

const getWebEventQueue = (w: any): WebAnalyticsEvent[] => {
    if (!Array.isArray(w[WEB_ANALYTICS_QUEUE_KEY])) {
        w[WEB_ANALYTICS_QUEUE_KEY] = [];
    }
    return w[WEB_ANALYTICS_QUEUE_KEY];
};

const areWebProvidersSettled = (w: any) => {
    const hasGa = Boolean(w?.__metravelGaId);
    const hasMetrika = Number(w?.__metravelMetrikaId || 0) > 0;
    const gaReady = !hasGa || typeof w?.gtag === 'function';
    const metrikaSettled = !hasMetrika || w?.__metravelMetrikaReady || w?.__metravelMetrikaFailed;
    return gaReady && metrikaSettled;
};

let isFlushing = false;

const flushQueuedWebAnalyticsEvents = async (w: any) => {
    if (isFlushing) return;
    const queue = Array.isArray(w?.[WEB_ANALYTICS_QUEUE_KEY]) ? [...w[WEB_ANALYTICS_QUEUE_KEY]] : [];
    if (!queue.length) return;
    w[WEB_ANALYTICS_QUEUE_KEY] = [];

    isFlushing = true;
    try {
        for (const item of queue) {
            await sendAnalyticsEvent(item.eventName, item.eventParams);
        }
    } finally {
        isFlushing = false;
    }
};

const ensureWebAnalyticsQueueListener = (w: any) => {
    if (!w || typeof w.addEventListener !== 'function' || w[WEB_ANALYTICS_LISTENER_KEY]) {
        return;
    }

    w[WEB_ANALYTICS_LISTENER_KEY] = true;
    w.addEventListener('metravel:analytics-ready', () => {
        void flushQueuedWebAnalyticsEvents(w);
    });
};

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
    // Browser-side Measurement Protocol would expose provider credentials.
    if (Platform.OS === 'web') {
        const w = typeof window !== 'undefined' ? (window as any) : undefined;
        ensureWebAnalyticsQueueListener(w);
        const gtag = w?.gtag;
        const ym = w?.ym;
        const metrikaId = Number(w?.__metravelMetrikaId || 0);
        const yandexGoalName = toYandexGoalName(eventName);
        let sentAnyEvent = false;

        if (!isWebAnalyticsAllowed()) {
            return;
        }

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

        if (w) {
            const queue = getWebEventQueue(w);
            queue.push({ eventName, eventParams });

            if (typeof w.metravelLoadAnalytics === 'function') {
                try {
                    w.metravelLoadAnalytics();
                } catch {
                    // noop
                }
            }

            if (areWebProvidersSettled(w)) {
                await flushQueuedWebAnalyticsEvents(w);
            }
        }

        // GA bootstraps lazily after consent/idle; missing gtag early is expected in production.
        if (__DEV__ && !hasWarnedMissingConfig) {
            console.warn('Analytics: web analytics is not available yet – event skipped.');
            hasWarnedMissingConfig = true;
        }
        return;
    }

    // Native analytics is intentionally disabled until the app has an approved
    // secret-free SDK or backend proxy. Client bundles must never ship provider secrets.
    return;
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
        Promise.resolve(import('@/utils/analytics'))
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
