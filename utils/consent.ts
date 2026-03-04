import { Platform } from 'react-native';

export const CONSENT_KEY = 'metravel_consent_v1';

export interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  date: string;
}

export function readConsent(): ConsentState | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as {
      necessary?: unknown;
      analytics?: unknown;
      date?: unknown;
    };

    if (candidate.necessary !== true) return null;

    return {
      necessary: true,
      analytics: typeof candidate.analytics === 'boolean' ? candidate.analytics : true,
      date: typeof candidate.date === 'string' ? candidate.date : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeConsent(consent: ConsentState): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // ignore
  }
}
