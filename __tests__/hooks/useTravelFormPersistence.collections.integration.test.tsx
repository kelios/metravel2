/** #2669/run15: confirmed writes must refresh warm collection DTOs, not only details. */
import React, { useRef } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { useFormState } from '@/hooks/useFormState';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';
import { useMyTravels } from '@/hooks/useMyTravels';
import { useListTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { queryKeys } from '@/api/queryKeys';
import { saveFormData, saveTravelContent } from '@/api/misc';
import { fetchMyTravels } from '@/api/travelsApi';
import { fetchTravels } from '@/api/travelListQueries';
import { getEmptyFormData } from '@/utils/travelFormUtils';
import { resolveTravelModerationFeedback } from '@/utils/travelPublicationStatus';
import { showToastMessage } from '@/utils/toast';
import type { TravelFormData } from '@/types/types';

jest.mock('@/api/misc', () => ({ saveFormData: jest.fn(), saveTravelContent: jest.fn() }));
jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(), deleteTravel: jest.fn(),
  unwrapMyTravelsPayload: jest.requireActual('@/api/travelUserQueries').unwrapMyTravelsPayload,
}));
jest.mock('@/api/travelListQueries', () => ({ fetchTravels: jest.fn(), fetchRandomTravels: jest.fn() }));
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => '1' }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: true, userId: '1' }) } }));
jest.mock('@/utils/toast', () => ({ showToastMessage: jest.fn() }));

const fullSave = saveFormData as jest.MockedFunction<typeof saveFormData>;
const contentSave = saveTravelContent as jest.MockedFunction<typeof saveTravelContent>;
const profileRead = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;
const listRead = fetchTravels as jest.MockedFunction<typeof fetchTravels>;
const draftStatuses = ['draft', 'pending_review'];
const publishedStatuses = ['approved', 'published'];
const decision = {
  moderation_decision: 'rejected' as const,
  moderation_decision_reason: 'Private correction: add the route duration',
  moderation_decided_at: '2026-10-20T09:00:00Z',
};
const cleared = { moderation_decision: null, moderation_decision_reason: '', moderation_decided_at: null };
const baseline = (overrides: Partial<TravelFormData> = {}): TravelFormData => ({
  ...getEmptyFormData('619'), id: 619, slug: 'original-route', name: 'Original route',
  description: '<p>Original route description with enough detail.</p>',
  categories: [1], countries: [3],
  coordsMeTravel: [{ id: 9001, lat: 53.9, lng: 27.56, address: 'Start', categories: [1], image: null }],
  gallery: [], publication_status: 'draft', publish: false, moderation: false,
  ...decision, ...overrides,
} as TravelFormData);
type Row = TravelFormData & { userIds: string; url: string };
const asRow = (data: TravelFormData): Row => ({ ...data, userIds: '1', url: `/travels/${data.slug}` });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const clients = new Set<QueryClient>();
const persistenceEffects = {
  setIsManualSaveInFlight: jest.fn(), setMarkers: jest.fn(), showToast: jest.fn(),
  rehydrateMarkerIdsFromServer: jest.fn(async () => null),
  uploadPendingMarkerImages: jest.fn(async () => undefined),
};
let rows: Row[];
let readGate: ReturnType<typeof deferred<void>> | undefined;
let readError: Error | undefined;

function createClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 300_000, refetchOnMount: false, refetchOnWindowFocus: false } },
  });
  clients.add(client);
  return client;
}
const wrapperFor = (client: QueryClient) => function Wrapper({ children }: React.PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const mountProfile = async (client: QueryClient, publicationStatus?: readonly string[], perPage = 20) => await renderHook(
  () => useMyTravels({ userId: '1', perPage, includeDrafts: true, publicationStatus }),
  { wrapper: wrapperFor(client) },
);
const mountList = async (client: QueryClient, own = true) => await renderHook(
  () => useListTravelData({ queryParams: own ? { user_id: '1' } : {}, search: '', isQueryEnabled: true }),
  { wrapper: wrapperFor(client) },
);

// Real form state, real autosave engine, real persistence and real React Query.
function useEditor(client: QueryClient, initial: TravelFormData) {
  const formState = useFormState(initial);
  const formDataRef = useRef(formState.data);
  formDataRef.current = formState.data;
  const params = {
    formState, initialFormData: initial, stableTravelId: initial.id == null ? null : Number(initial.id),
    queryClient: client, userId: '1', isAuthenticated: true, hasAccess: true,
    isFormHydrated: true, isOnline: true, isManualSaveInFlight: false,
    ...persistenceEffects, formDataRef,
    saveAbortControllerRef: useRef<AbortController | null>(null), mountedRef: useRef(true),
    manualSaveInFlightRef: useRef(false), manualSavePromiseRef: useRef<Promise<TravelFormData | void> | null>(null),
    suppressAutosaveErrorToastRef: useRef(false), pendingBaselineRef: useRef<TravelFormData | null>(null),
    serverTextBaselineRef: useRef(null), updateBaselineRef: useRef<((data: TravelFormData) => void) | null>(null),
  };
  return { formState, formDataRef, ...useTravelFormPersistence(params) };
}
const mountEditor = async (client: QueryClient, initial = baseline()) => await renderHook(
  () => useEditor(client, initial), { wrapper: wrapperFor(client) },
);
const cacheRows = (client: QueryClient, key: readonly unknown[]): Row[] => {
  const data = client.getQueryData<{ pages: Array<{ items?: Row[]; data?: Row[] }> }>(key);
  return data?.pages.flatMap(page => page.items ?? page.data ?? []) ?? [];
};
const profileKey = (publicationStatus?: readonly string[], perPage = 20) => queryKeys.authorTravels(
  '1', '1', { perPage, includeDrafts: true, publicationStatus },
);

async function beforeRead() {
  if (readGate) await readGate.promise;
  if (readError) throw readError;
}
beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  fullSave.mockReset();
  contentSave.mockReset();
  profileRead.mockReset();
  listRead.mockReset();
  onlineManager.setOnline(true);
  rows = [asRow(baseline()), asRow(baseline({ id: 620, name: 'Published route', slug: 'published-route', publication_status: 'published', ...cleared }))];
  readGate = undefined;
  readError = undefined;
  profileRead.mockImplementation(async params => {
    await beforeRead();
    const selected = rows.filter(row => String(row.userIds) === String(params.user_id))
      .filter(row => params.publicationStatus?.length ? params.publicationStatus.includes(String(row.publication_status)) : params.includeDrafts || row.publication_status === 'published');
    const start = ((params.page ?? 1) - 1) * (params.perPage ?? 20);
    return { data: clone(selected.slice(start, start + (params.perPage ?? 20))), total: selected.length } as any;
  });
  listRead.mockImplementation(async (_page, _perPage, _search, params) => {
    await beforeRead();
    const own = params?.user_id === '1';
    const selected = own ? rows : rows.filter(row => row.publication_status === 'published').map(row => {
      const { moderation_decision: _d, moderation_decision_reason: _r, moderation_decided_at: _a, ...safe } = row;
      return safe;
    });
    return { data: clone(selected), total: selected.length } as any;
  });
  fullSave.mockImplementation(async (data, _signal, options) => {
    const id = data.id == null ? 777 : Number(data.id);
    const old = rows.find(row => Number(row.id) === id) ?? asRow(baseline({ id }));
    let status = data.publication_status;
    let metadata: Record<string, unknown> = {
      moderation_decision: old.moderation_decision,
      moderation_decision_reason: old.moderation_decision_reason,
      moderation_decided_at: old.moderation_decided_at,
    };
    if (options?.intent === 'submit') { status = 'pending_review'; metadata = cleared; }
    if (options?.intent === 'approve') { status = 'published'; metadata = { ...cleared, moderation_decision: 'approved', moderation_decided_at: '2026-10-23T03:00:00Z' }; }
    if (options?.intent === 'reject') { status = 'draft'; metadata = { ...decision, moderation_decision_reason: options.moderationDecisionReason }; }
    const saved = { ...old, ...data, id, slug: `${String(data.name).toLowerCase().replace(/\s+/g, '-')}-${id}`, publication_status: status, ...metadata } as TravelFormData;
    rows = [...rows.filter(row => Number(row.id) !== id), asRow(saved)];
    return clone(saved);
  });
  contentSave.mockImplementation(async (id, fields) => {
    const old = rows.find(row => Number(row.id) === Number(id))!;
    const saved = { ...old, ...fields, slug: fields.name ? `renamed-route-${id}` : old.slug };
    rows = rows.map(row => Number(row.id) === Number(id) ? saved : row);
    return clone({ id: Number(id), slug: saved.slug, name: saved.name, description: saved.description,
      plus: saved.plus, minus: saved.minus, recommendation: saved.recommendation,
      changed_fields: Object.keys(fields), updated_at: '2026-10-23T03:00:00Z' }) as any;
  });
});
afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  for (const client of clients) client.clear();
  clients.clear();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('#2669 — confirmed mutation and warm author collections', () => {
  // This selected case intentionally uses only pre-repair public APIs. It must
  // fail on the original source's stale DTO, not on a missing new key factory.
  it('keeps manual navigation pending until warm own/profile collections hold the confirmed pending DTO', async () => {
    const client = createClient();
    const own = await mountList(client);
    const profile = await mountProfile(client);
    await act(async () => { await profile.result.current.load(); });
    await waitFor(() => expect(own.result.current.data.find(t => t.id === 619)).toMatchObject(decision));
    const editor = await mountEditor(client);
    await act(() => editor.result.current.formState.updateField('name', 'Confirmed current route'));
    const gate = deferred<void>();
    readGate = gate;
    let completed = false;
    let saving!: Promise<TravelFormData | void>;
    await act(() => {
      saving = editor.result.current.handleManualSave(undefined, { intent: 'submit' });
      void saving.then(() => { completed = true; });
    });
    try {
      await waitFor(() => expect(editor.result.current.formDataRef.current).toMatchObject({
        name: 'Confirmed current route', publication_status: 'pending_review', ...cleared,
      }));
      // API write is confirmed, but the collection GET is deliberately pending.
      // The old code resolves now and leaves both warm author DTOs rejected.
      const feedbackSnapshot = (data: unknown) => {
        const value = data as Record<string, unknown>;
        return Object.fromEntries(['id', 'name', 'slug', 'publication_status', 'moderation_decision', 'moderation_decision_reason', 'moderation_decided_at'].map(key => [key, value[key]]));
      };
      console.info('[2669-cache-principal-checkpoint]', JSON.stringify({
        navigationPromiseResolved: completed,
        confirmedForm: feedbackSnapshot(editor.result.current.formDataRef.current),
        ownListCached: feedbackSnapshot(own.result.current.data.find(t => t.id === 619)),
        profileCached: feedbackSnapshot(profile.result.current.myTravels.find(t => t.id === 619)),
      }));
      expect(completed).toBe(false);
      expect(editor.result.current.autosave.hasUnsavedChanges).toBe(false);
      gate.resolve();
      await act(async () => { await saving; });
      const expected = { id: 619, name: 'Confirmed current route', slug: 'confirmed-current-route-619', publication_status: 'pending_review', ...cleared };
      await waitFor(() => expect(own.result.current.data.find(t => t.id === 619)).toMatchObject(expected));
      expect(profile.result.current.myTravels.find(t => t.id === 619)).toMatchObject(expected);
      expect(profile.result.current.publicationCounts).toEqual({ published: 1, drafts: 1 });
      expect(fullSave).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
      await act(async () => { await saving; });
    }
  });

  it('applies submit immediately, waits for real refresh, updates active/inactive slices and leaves unopened slices lazy', async () => {
    const client = createClient();
    const own = await mountList(client);
    const publicList = await mountList(client, false);
    const all = await mountProfile(client);
    const drafts = await mountProfile(client, draftStatuses);
    const inactivePublished = await mountProfile(client, publishedStatuses);
    const unopened = await mountProfile(client, publishedStatuses, 7);
    await act(async () => { await Promise.all([all.result.current.load(), drafts.result.current.load(), inactivePublished.result.current.load()]); });
    await waitFor(() => expect(own.result.current.data).toHaveLength(2));
    await waitFor(() => expect(publicList.result.current.data).toHaveLength(1));
    await inactivePublished.unmount();
    const initialLazyReads = profileRead.mock.calls.filter(([p]) => p.perPage === 7).length;
    expect(initialLazyReads).toBe(0);
    let counter = 2;
    await client.fetchQuery({ queryKey: queryKeys.myTravelsCount('1'), queryFn: async () => counter });
    await client.fetchQuery({ queryKey: queryKeys.exportMyTravelsCount('1'), queryFn: async () => counter });
    const editor = await mountEditor(client);
    await act(() => editor.result.current.formState.updateField('name', 'Corrected route'));
    readGate = deferred<void>();
    counter = 3;
    let completed = false;
    let saving!: Promise<TravelFormData | void>;
    await act(() => {
      saving = editor.result.current.handleManualSave(undefined, { intent: 'submit' });
      void saving.then(() => { completed = true; });
    });
    await waitFor(() => expect(editor.result.current.formState.data).toMatchObject({ name: 'Corrected route', publication_status: 'pending_review', ...cleared }));
    expect(editor.result.current.formDataRef.current.slug).toBe('corrected-route-619');
    expect(editor.result.current.autosave.hasUnsavedChanges).toBe(false);
    expect(completed).toBe(false);
    expect(fullSave).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.myTravelsCount('1'))).toBe(3);
    expect(client.getQueryData(queryKeys.exportMyTravelsCount('1'))).toBe(3);
    await act(async () => { readGate!.resolve(); await saving; });
    const pending = { id: 619, name: 'Corrected route', slug: 'corrected-route-619', publication_status: 'pending_review', ...cleared };
    await waitFor(() => expect(own.result.current.data.find(t => t.id === 619)).toMatchObject(pending));
    expect(all.result.current.myTravels.find(t => t.id === 619)).toMatchObject(pending);
    expect(drafts.result.current.myTravels.find(t => t.id === 619)).toMatchObject(pending);
    expect(resolveTravelModerationFeedback(own.result.current.data.find(t => t.id === 619)!)).toEqual({ status: 'pending_review', reason: '', decidedAt: null });
    expect(cacheRows(client, profileKey(publishedStatuses)).map(t => Number(t.id))).toEqual([620]);
    expect(profileRead.mock.calls.filter(([p]) => p.perPage === 7)).toHaveLength(0);
    expect(unopened.result.current.myTravels).toEqual([]);

    // A second confirmed state command changes real server-side membership.
    await act(async () => { await editor.result.current.handleManualSave(undefined, { intent: 'approve' }); });
    await waitFor(() => expect(drafts.result.current.myTravels).toEqual([]));
    expect(cacheRows(client, profileKey(publishedStatuses)).map(t => Number(t.id)).sort()).toEqual([619, 620]);
    expect(all.result.current.publicationCounts).toEqual({ published: 2, drafts: 0 });
    await waitFor(() => expect(publicList.result.current.data).toHaveLength(2));
    expect(JSON.stringify(publicList.result.current.data)).not.toContain(decision.moderation_decision_reason);
    expect(publicList.result.current.data.find(t => t.id === 619)).not.toHaveProperty('moderation_decision_reason');
    await act(async () => { await unopened.result.current.load(); });
    expect(unopened.result.current.myTravels.map(t => t.id).sort()).toEqual([619, 620]);
    expect(profileRead.mock.calls.filter(([p]) => p.perPage === 7)).toHaveLength(1);
  });

  it.each(['ordinary full', 'structural autosave', 'content PATCH', 'create', 'submit', 'approve', 'reject'] as const)(
    'refreshes actual cached DTO after %s without depending on navigation', async mode => {
      const initial = baseline(mode === 'create' ? { id: null } : mode === 'approve' || mode === 'reject' ? { publication_status: 'pending_review', ...cleared } : {});
      if (mode === 'approve' || mode === 'reject') rows[0] = asRow(initial);
      const client = createClient();
      const own = await mountList(client);
      const profile = await mountProfile(client);
      await act(async () => { await profile.result.current.load(); });
      await waitFor(() => expect(own.result.current.data).toHaveLength(2));
      const editor = await mountEditor(client, initial);
      const expectedNewSlug = mode === 'content PATCH' ? 'renamed-route-619'
        : mode === 'structural autosave' ? 'original-route-619' : 'current-server-title-619';
      if (mode !== 'create') {
        for (const key of [queryKeys.travel(619), queryKeys.travel('original-route'), queryKeys.travel(expectedNewSlug)]) {
          await client.fetchQuery({ queryKey: key, queryFn: async () => clone(initial) });
        }
      }
      await act(() => {
        if (mode === 'structural autosave') editor.result.current.formState.updateField('categories', [1, 2]);
        else editor.result.current.formState.updateField('name', 'Current server title');
      });
      await act(async () => {
        if (mode === 'structural autosave' || mode === 'content PATCH') await editor.result.current.autosave.saveNow();
        else await editor.result.current.handleManualSave(undefined, mode === 'submit' || mode === 'approve' ? { intent: mode } : mode === 'reject' ? { intent: 'reject', moderationDecisionReason: 'New decision' } : undefined);
      });
      const id = mode === 'create' ? 777 : 619;
      const current = rows.find(row => Number(row.id) === id)!;
      await waitFor(() => expect(own.result.current.data.find(t => Number(t.id) === id)).toMatchObject({
        name: current.name, slug: current.slug, publication_status: current.publication_status,
        moderation_decision: current.moderation_decision, moderation_decision_reason: current.moderation_decision_reason,
        moderation_decided_at: current.moderation_decided_at,
      }));
      expect(profile.result.current.myTravels.find(t => t.id === id)).toMatchObject({ name: current.name, slug: current.slug });
      expect(mode === 'content PATCH' ? contentSave : fullSave).toHaveBeenCalledTimes(1);
      expect(mode === 'content PATCH' ? fullSave : contentSave).not.toHaveBeenCalled();
      if (mode !== 'create') {
        expect(client.getQueryState(queryKeys.travel(619))?.isInvalidated).toBe(true);
        expect(client.getQueryState(queryKeys.travel('original-route'))?.isInvalidated).toBe(true);
        expect(client.getQueryState(queryKeys.travel(current.slug!))?.isInvalidated).toBe(true);
      }
      if (mode === 'ordinary full' || mode === 'structural autosave' || mode === 'content PATCH') {
        expect(current).toMatchObject(decision);
      }
    },
  );

  it.each(['full', 'content', 'submit'] as const)('keeps cache/history/counts after %s 503, then refreshes on one retry', async mode => {
    const client = createClient();
    const own = await mountList(client);
    const profile = await mountProfile(client);
    await act(async () => { await profile.result.current.load(); });
    await waitFor(() => expect(own.result.current.data).toHaveLength(2));
    const initialCache = clone(own.result.current.data);
    const editor = await mountEditor(client);
    await act(() => editor.result.current.formState.updateField('name', 'Retained edit'));
    const error = Object.assign(new Error('Intentional write 503'), { status: 503 });
    const write = mode === 'content' ? contentSave : fullSave;
    write.mockRejectedValueOnce(error);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const readsBeforeFailure = listRead.mock.calls.length;
    const profileReadsBeforeFailure = profileRead.mock.calls.length;
    const attempt = () => mode === 'content' ? editor.result.current.autosave.saveNow()
      : editor.result.current.handleManualSave(undefined, mode === 'submit' ? { intent: 'submit' } : undefined);
    await act(async () => { await expect(attempt()).rejects.toBe(error); });
    expect(own.result.current.data).toEqual(initialCache);
    expect(profile.result.current.publicationCounts).toEqual({ published: 1, drafts: 1 });
    expect(editor.result.current.formDataRef.current).toMatchObject({ name: 'Retained edit', ...decision });
    if (mode === 'content') expect(editor.result.current.autosave.error).toBe(error);
    expect(listRead).toHaveBeenCalledTimes(readsBeforeFailure);
    expect(profileRead).toHaveBeenCalledTimes(profileReadsBeforeFailure);
    const readsAfterFailure = listRead.mock.calls.length;
    await act(async () => { await attempt(); });
    await waitFor(() => expect(own.result.current.data.find(t => t.id === 619)?.name).toBe('Retained edit'));
    expect(listRead.mock.calls.length).toBeGreaterThan(readsAfterFailure);
    expect(write).toHaveBeenCalledTimes(2);
    expect(rows.find(t => Number(t.id) === 619)).toMatchObject(mode === 'submit' ? cleared : decision);
  });

  it('a confirmed PUT stays saved when collection GET fails; honest retry never resends PUT', async () => {
    const client = createClient();
    const own = await mountList(client);
    const profile = await mountProfile(client);
    await act(async () => { await profile.result.current.load(); });
    await waitFor(() => expect(own.result.current.data).toHaveLength(2));
    const editor = await mountEditor(client);
    readError = new Error('Intentional collection 503');
    await act(async () => { await expect(editor.result.current.handleManualSave(undefined, { intent: 'submit' })).resolves.toMatchObject({ publication_status: 'pending_review', ...cleared }); });
    await waitFor(() => expect(own.result.current.isError).toBe(true));
    await waitFor(() => expect(profile.result.current.error).toContain('Intentional collection 503'));
    expect(profile.result.current.myTravels).toEqual([]);
    expect(profile.result.current.publicationCounts).toBeNull();
    expect(editor.result.current.formDataRef.current).toMatchObject({ publication_status: 'pending_review', ...cleared });
    expect(showToastMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    readError = undefined;
    await act(async () => { await Promise.all([own.result.current.refetch(), profile.result.current.load()]); });
    await waitFor(() => expect(own.result.current.isError).toBe(false));
    expect(own.result.current.data.find(t => t.id === 619)).toMatchObject({ publication_status: 'pending_review', ...cleared });
    expect(profile.result.current.error).toBeNull();
    expect(fullSave).toHaveBeenCalledTimes(1);
  });

  it('paused invalidated collections cannot present old rejected feedback as a current success', async () => {
    const client = createClient();
    const own = await mountList(client);
    const profile = await mountProfile(client);
    await act(async () => { await profile.result.current.load(); });
    await waitFor(() => expect(own.result.current.data).toHaveLength(2));
    const editor = await mountEditor(client);
    onlineManager.setOnline(false);
    await act(async () => { await editor.result.current.handleManualSave(undefined, { intent: 'submit' }); });
    expect(editor.result.current.formDataRef.current).toMatchObject({ publication_status: 'pending_review', ...cleared });
    await waitFor(() => expect(own.result.current.isError).toBe(true));
    await waitFor(() => expect(profile.result.current.error).not.toBeNull());
    expect(profile.result.current.myTravels).toEqual([]);
    expect(profile.result.current.publicationCounts).toBeNull();
    await act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(own.result.current.isError).toBe(false));
    await waitFor(() => expect(own.result.current.data.find(t => t.id === 619)).toMatchObject({ publication_status: 'pending_review', ...cleared }));
    await waitFor(() => expect(profile.result.current.error).toBeNull());
    expect(fullSave).toHaveBeenCalledTimes(1);
  });
});
