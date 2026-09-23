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

type WebAnalyticsProvider = 'ga' | 'metrika';

const WEB_ANALYTICS_PROVIDERS: readonly WebAnalyticsProvider[] = ['ga', 'metrika'];

type WebAnalyticsEvent = {
    eventName: string;
    eventParams: Record<string, unknown>;
    // Providers that still owe this event. GA4 and Metrika become ready at
    // different moments (bootstrapGa() dispatches `metravel:analytics-ready`
    // while tag.js is still loading), so delivery is tracked per provider (#2062).
    providers?: readonly WebAnalyticsProvider[];
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
            await deliverWebAnalyticsEvent(w, item);
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

const deliverWebAnalyticsEvent = async (w: any, event: WebAnalyticsEvent) => {
    if (!isWebAnalyticsAllowed()) {
        return;
    }

    const { eventName, eventParams } = event;
    const gtag = w?.gtag;
    const ym = w?.ym;
    const metrikaId = Number(w?.__metravelMetrikaId || 0);
    const yandexGoalName = toYandexGoalName(eventName);
    const pending: WebAnalyticsProvider[] = [];
    let sentAnyEvent = false;

    for (const provider of event.providers ?? WEB_ANALYTICS_PROVIDERS) {
        if (provider === 'ga') {
            if (typeof gtag === 'function') {
                try {
                    gtag('event', eventName, eventParams);
                    sentAnyEvent = true;
                } catch (error) {
                    console.error('GA4 gtag Error:', error);
                }
            } else if (w?.__metravelGaId) {
                pending.push('ga');
            }
            continue;
        }

        if (metrikaId <= 0 || yandexGoalName.length === 0 || w?.__metravelMetrikaFailed) {
            continue;
        }
        if (typeof ym === 'function' && w?.__metravelMetrikaReady) {
            try {
                ym(metrikaId, 'reachGoal', yandexGoalName, eventParams);
                sentAnyEvent = true;
            } catch (error) {
                console.error('Yandex Metrika reachGoal Error:', error);
            }
        } else {
            pending.push('metrika');
        }
    }

    if (!pending.length || !w) {
        return;
    }

    getWebEventQueue(w).push({ eventName, eventParams, providers: pending });

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

    // GA bootstraps lazily after consent/idle; missing gtag early is expected in production.
    if (__DEV__ && !sentAnyEvent && !hasWarnedMissingConfig) {
        console.warn('Analytics: web analytics is not available yet – event queued.');
        hasWarnedMissingConfig = true;
    }
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
        await deliverWebAnalyticsEvent(w, { eventName, eventParams });
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
