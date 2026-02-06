import { Platform } from 'react-native';

const MEASUREMENT_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4;
const API_SECRET = process.env.EXPO_PUBLIC_GOOGLE_API_SECRET;
let hasWarnedMissingConfig = false;

const generateClientId = () => `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;

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
        if (typeof gtag === 'function') {
            try {
                gtag('event', eventName, eventParams);
            } catch (error) {
                console.error('GA4 gtag Error:', error);
            }
            return;
        }

        if (!hasWarnedMissingConfig) {
            console.warn('GA4: gtag is not available – analytics event skipped.');
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
    const body = {
        client_id: generateClientId(),
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
            console.info(`📊 GA Event: ${eventName}`, eventParams);
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
