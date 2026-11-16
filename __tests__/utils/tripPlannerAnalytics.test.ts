const mockSend = jest.fn();
let mockConsent = true;
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockSend(...args) }));
jest.mock('@/utils/consent', () => ({ readConsent: () => ({ analytics: mockConsent }) }));

const href = '/trips/plan/create?source=travel&sourceTravelTitle=Private+title&sourcePoint=53,27';
const events = (name: string) => mockSend.mock.calls.filter(([event]) => event === name);
let analytics: typeof import('@/utils/tripPlannerAnalytics');

beforeEach(() => {
  jest.resetModules();
  mockSend.mockClear();
  mockConsent = true;
  window.sessionStorage.clear();
  analytics = require('@/utils/tripPlannerAnalytics');
});

afterEach(() => jest.restoreAllMocks());

test('guest entry survives login/reload and first confirmed point is counted once with the entry cohort', () => {
  const url = analytics.beginTripPlannerEntry(href, false);
  const entryId = analytics.trackTripPlannerForm(url, false, false);
  expect(new URLSearchParams(url.split('?')[1]).get('planner_source')).toBe('travel');
  expect(url).not.toContain('planner_entry');
  expect(url).not.toContain(entryId);
  jest.resetModules();
  analytics = require('@/utils/tripPlannerAnalytics');
  expect(analytics.trackTripPlannerForm(url, true, true)).toBe(entryId);
  analytics.trackTripPlannerForm(url, true, true);
  analytics.trackPlannerTripCreated(entryId, 42, 'car');
  analytics.trackPlannerTripCreated(entryId, 42, 'car');
  analytics.trackPlannerFirstSavedPoint(42, []);
  expect(events('route_point_added')).toHaveLength(0);
  analytics.trackPlannerFirstSavedPoint(42, [{ type: 'place' }]);
  analytics.trackPlannerFirstSavedPoint(42, [{ type: 'place' }]);
  expect(events('trip_planner_entry')).toHaveLength(1);
  expect(events('trip_created')).toHaveLength(1);
  expect(events('trip_planner_form_view').map(([, data]) => data.outcome)).toEqual(['auth_required', 'ready']);
  expect(events('route_point_added')).toEqual([['route_point_added', expect.objectContaining({ source: 'travel', auth_state: 'guest', outcome: 'first_saved', trip_id: 42 })]]);
  const serialized = JSON.stringify(mockSend.mock.calls);
  const stored = window.sessionStorage.getItem('metravel_trip_planner_v1')!;
  const [{ targetKey }] = JSON.parse(stored);
  expect(targetKey).toMatch(/^[0-9a-f]{16}$/);
  for (const secret of ['Private', 'sourcePoint', '53,27']) expect(stored).not.toContain(secret);
  for (const secret of ['Private', 'sourcePoint', '53,27', entryId, targetKey]) expect(serialized).not.toContain(secret);
});

test('failure reports attempts without created or first saved events; successful retry reuses entry', () => {
  const url = analytics.beginTripPlannerEntry(href, true);
  const entryId = analytics.trackTripPlannerForm(url, true, true);
  analytics.trackPlannerCreateFailed(entryId);
  analytics.trackPlannerCreateFailed(entryId);
  analytics.trackPlannerFirstSavedPoint(42, [{ type: 'place' }]);
  expect(events('trip_create_failed')).toHaveLength(2);
  expect(events('trip_created')).toHaveLength(0);
  expect(events('route_point_added')).toHaveLength(0);
  analytics.trackPlannerTripCreated(entryId, 42, 'foot');
  expect(events('trip_created')).toHaveLength(1);
});

test.each(['travel', 'quest', 'assistant', 'navigation', 'direct'] as const)('entry source %s is independent of prefill material', (source) => {
  const url = analytics.beginTripPlannerEntry(href, true, source);
  analytics.trackPlannerTripCreated(analytics.trackTripPlannerForm(url, true, true), 42, 'car');
  expect(events('trip_created')[0][1]).toMatchObject({ source, event_label: source, auth_state: 'authenticated' });
});

test('expired local context and unknown sources start a fresh direct journey', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const url = analytics.beginTripPlannerEntry('/trips/plan/create?source=private-title', true);
  const previous = analytics.trackTripPlannerForm(url, true, true);
  now.mockReturnValue(1000 + 31 * 60 * 1000);
  const next = analytics.trackTripPlannerForm(url, true, true);
  expect(next).not.toBe(previous);
  expect(events('trip_planner_entry')).toHaveLength(2);
  expect(events('trip_planner_entry')[1][1].source).toBe('direct');
});

test('no consent keeps private context only in memory; late consent does not replay entry', () => {
  mockConsent = false;
  const url = analytics.beginTripPlannerEntry(href, false);
  const entryId = analytics.trackTripPlannerForm(url, true, true);
  expect(window.sessionStorage.length).toBe(0);
  mockConsent = true;
  analytics.trackPlannerTripCreated(entryId, 42, 'car');
  expect(events('trip_planner_entry')).toHaveLength(1);
});

test('unavailable storage and stale writes keep memory deduplication working', () => {
  const url = analytics.beginTripPlannerEntry(href, true);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  analytics.trackTripPlannerForm(url, true, true);
  analytics.trackTripPlannerForm(url, true, true);
  expect(events('trip_planner_form_view')).toHaveLength(1);
});

test('restoring authentication preserves the navigation source without classifying a guest', () => {
  const url = analytics.beginTripPlannerEntry(href, false, 'navigation', false);
  expect(new URLSearchParams(url.split('?')[1]).get('planner_source')).toBe('navigation');
  expect(mockSend).not.toHaveBeenCalled();
  analytics.trackTripPlannerForm(url, true, true);
  expect(events('trip_planner_entry')).toEqual([['trip_planner_entry', expect.objectContaining({ source: 'navigation', auth_state: 'authenticated', outcome: 'opened' })]]);
});

test('canonical query order and undeclared source match across a consented reload; a new click becomes the latest journey', () => {
  const firstHref = '/trips/plan/create?source=quest&sourceTravelTitle=Private+title';
  const entryId = analytics.trackTripPlannerForm(firstHref, false, false);
  jest.resetModules();
  analytics = require('@/utils/tripPlannerAnalytics');
  const equivalent = '/trips/plan/create?sourceTravelTitle=Private%20title&planner_source=quest&source=quest';
  expect(analytics.trackTripPlannerForm(equivalent, true, true)).toBe(entryId);
  const nextHref = analytics.beginTripPlannerEntry(firstHref, true);
  expect(analytics.trackTripPlannerForm(nextHref, true, true)).not.toBe(entryId);
  expect(events('trip_planner_entry')).toHaveLength(2);
});
