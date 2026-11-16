import { Platform } from 'react-native';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { readConsent } from '@/utils/consent';

export const TRIP_PLANNER_SOURCES = ['travel', 'quest', 'assistant', 'navigation', 'direct'] as const;
export type TripPlannerSource = typeof TRIP_PLANNER_SOURCES[number];
type AuthState = 'guest' | 'authenticated';
type Journey = {
  id: string;
  targetKey: string;
  source: TripPlannerSource;
  authState: AuthState;
  expires: number;
  stages: string[];
  tripId?: number;
};
const STORAGE_KEY = 'metravel_trip_planner_v1';
const TTL = 30 * 60 * 1000;
let journeys: Journey[] = [];

const isSource = (value: unknown): value is TripPlannerSource =>
  TRIP_PLANNER_SOURCES.includes(value as TripPlannerSource);

function readJourneys(): Journey[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    if (readConsent()?.analytics) {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (Array.isArray(stored)) {
        const persisted = stored.filter((item): item is Journey =>
        item && typeof item.id === 'string' && /^[a-z0-9-]{1,80}$/i.test(item.id) &&
        typeof item.targetKey === 'string' && /^[0-9a-f]{16}$/.test(item.targetKey) &&
        isSource(item.source) && ['guest', 'authenticated'].includes(item.authState) &&
        Number.isFinite(item.expires) && Array.isArray(item.stages) &&
        item.stages.every((stage: unknown) => typeof stage === 'string') &&
        (item.tripId === undefined || (Number.isSafeInteger(item.tripId) && item.tripId > 0)),
        );
        journeys = [...new Map([...persisted, ...journeys].map((item) => [item.id, item])).values()];
      }
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* Storage denial must not interrupt planning. */ }
  journeys = journeys.filter((item) => item.expires > Date.now()).slice(-20);
  return journeys;
}

function persist(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  journeys = journeys.filter((item) => item.expires > Date.now()).slice(-20);
  try {
    if (readConsent()?.analytics) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* In-memory context still works in the current page. */ }
}

function emit(journey: Journey, event: string, outcome: string, extra: Record<string, unknown> = {}): void {
  void sendAnalyticsEvent(event, {
    ...extra,
    event_category: 'trip_planner',
    event_label: journey.source,
    source: journey.source,
    // Entry cohort stays stable when a guest signs in between stages.
    auth_state: journey.authState,
    outcome,
  });
}

function once(journey: Journey, event: string, outcome: string, extra?: Record<string, unknown>): void {
  const stage = `${event}:${outcome}`;
  if (journey.stages.includes(stage)) return;
  journey.stages.push(stage);
  persist();
  emit(journey, event, outcome, extra);
}

export function plannerSourceFromHref(href: string): TripPlannerSource {
  const params = new URLSearchParams(href.split('?')[1]?.split('#')[0]);
  const origin = params.get('planner_source');
  if (isSource(origin)) return origin;
  const source = params.get('source');
  return source === 'plan' ? 'assistant' : isSource(source) ? source : 'direct';
}

/** Only the finite entry source belongs in navigation, including nested login redirects. */
function sourceHref(href: string, source: TripPlannerSource): string {
  const [path, query = ''] = href.split('#')[0].split('?');
  const params = new URLSearchParams(query);
  params.delete('planner_entry');
  params.set('planner_source', source);
  return `${path}?${params.toString()}`;
}

/** A local matching key; raw form query values are never stored or emitted. */
function targetKey(href: string, source = plannerSourceFromHref(href)): string {
  const [path, query] = sourceHref(href, source).split('?');
  const params = new URLSearchParams(query);
  params.sort();
  const canonical = `${path}?${params.toString()}`;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    first = Math.imul(first ^ canonical.charCodeAt(i), 0x01000193);
    second = Math.imul(second ^ canonical.charCodeAt(i), 0x85ebca6b);
  }
  return [first, second].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('');
}

function createJourney(key: string, source: TripPlannerSource, authenticated: boolean): Journey {
  const journey: Journey = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    targetKey: key,
    source, authState: authenticated ? 'authenticated' : 'guest', expires: Date.now() + TTL, stages: [],
  };
  journeys.push(journey);
  once(journey, 'trip_planner_entry', authenticated ? 'opened' : 'auth_required');
  return journey;
}

export function beginTripPlannerEntry(href: string, authenticated: boolean, source = plannerSourceFromHref(href), authReady = true): string {
  const origin = isSource(source) ? source : plannerSourceFromHref(href);
  const attributed = sourceHref(href, origin);
  if (authReady && Platform.OS === 'web' && typeof window !== 'undefined') {
    readJourneys();
    createJourney(targetKey(attributed, origin), origin, authenticated);
  }
  return attributed;
}

export function trackTripPlannerForm(href: string, authenticated: boolean, ready: boolean): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  const source = plannerSourceFromHref(href);
  const key = targetKey(href, source);
  const journey = [...readJourneys()].reverse().find((item) => item.targetKey === key)
    ?? createJourney(key, source, authenticated);
  if (!authenticated || ready) once(journey, 'trip_planner_form_view', authenticated ? 'ready' : 'auth_required');
  return journey.id;
}

export function trackPlannerTripCreated(entryId: string | undefined, tripId: number, transport: string): boolean {
  const journey = readJourneys().find((item) => item.id === entryId);
  if (!journey || !Number.isSafeInteger(tripId) || tripId <= 0) return false;
  journey.tripId = tripId;
  once(journey, 'trip_created', 'success', { trip_id: tripId, transport });
  persist();
  return true;
}

export function trackPlannerCreateFailed(entryId?: string): void {
  const journey = readJourneys().find((item) => item.id === entryId);
  if (journey) emit(journey, 'trip_create_failed', 'error');
}

export function trackPlannerFirstSavedPoint(tripId: number, route: readonly { type: string }[]): void {
  if (!route.length) return;
  const journey = readJourneys().find((item) => item.tripId === tripId);
  if (journey) once(journey, 'route_point_added', 'first_saved', { trip_id: tripId, point_type: ['place', 'custom', 'rest', 'overnight'].includes(route[0].type) ? route[0].type : 'custom' });
}
