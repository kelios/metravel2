/**
 * #1516: фоновое автосохранение правок текста уходит узким
 * `PATCH /travels/{id}/content/`, а не полным `PUT /travels/upsert/`.
 *
 * Контракт: правка текста не трогает структуру статьи (точки, галерея, обложка,
 * справочники, статус публикации), структурная правка по-прежнему идёт полным
 * сохранением, а ответ узкого пути НЕ применяется как полная статья — иначе
 * подтверждение из пяти текстовых полей выглядело бы как «сервер всё удалил».
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TravelFormData } from '@/types/types';

jest.mock('@/api/misc', () => ({
  saveFormData: jest.fn(),
  saveTravelContent: jest.fn(),
}));

jest.mock('@/hooks/useImprovedAutoSave', () => ({
  useImprovedAutoSave: jest.fn(() => ({
    updateBaseline: jest.fn(),
    cancelPending: jest.fn(),
    status: 'idle',
  })),
}));

jest.mock('@/utils/toast', () => ({
  showToastMessage: jest.fn(),
}));

import { saveFormData, saveTravelContent } from '@/api/misc';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';

const mockSaveFormData = saveFormData as jest.MockedFunction<typeof saveFormData>;
const mockSaveTravelContent = saveTravelContent as jest.MockedFunction<typeof saveTravelContent>;
const mockUseImprovedAutoSave =
  useImprovedAutoSave as jest.MockedFunction<typeof useImprovedAutoSave>;

const makeRef = <T,>(value: T) => ({ current: value });

const POINT = { id: 15904, lat: 53.9, lng: 27.56, address: 'Точка A', categories: [1], image: null };
const GALLERY = [{ id: 77, url: 'https://cdn/1.jpg' }];

const travelSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 619,
  slug: 'minsk-za-den',
  name: 'Минск за один день',
  description: '<p>Длинное описание маршрута по городу с подробностями.</p>',
  plus: '<p>Плюсы</p>',
  minus: '<p>Минусы</p>',
  recommendation: '<p>Рекомендации</p>',
  categories: [1, 2],
  countries: [3],
  coordsMeTravel: [POINT],
  gallery: GALLERY,
  travel_image_thumb_url: 'https://cdn/cover.jpg',
  publish: false,
  moderation: false,
  ...overrides,
});

const contentResponse = (overrides: Record<string, unknown> = {}) => ({
  id: 619,
  slug: 'minsk-za-den',
  name: 'Минск за один день',
  description: '<p>Дописанный абзац.</p>',
  plus: '<p>Плюсы</p>',
  minus: '<p>Минусы</p>',
  recommendation: '<p>Рекомендации</p>',
  changed_fields: ['description'],
  updated_at: '2026-08-25T10:00:00Z',
  ...overrides,
});

function setupPersistence(
  baseline: Record<string, unknown>,
  paramOverrides: Record<string, unknown> = {},
) {
  const formState: any = {
    data: baseline,
    reset: jest.fn(),
    updateField: jest.fn(),
    updateFields: jest.fn(),
  };

  const params: any = {
    formState,
    initialFormData: baseline,
    stableTravelId: 619,
    queryClient: null,
    userId: '1',
    isAuthenticated: true,
    hasAccess: true,
    isFormHydrated: true,
    isOnline: true,
    isManualSaveInFlight: false,
    setIsManualSaveInFlight: jest.fn(),
    setMarkers: jest.fn(),
    showToast: jest.fn(),
    formDataRef: makeRef(baseline),
    saveAbortControllerRef: makeRef(null),
    mountedRef: makeRef(true),
    manualSaveInFlightRef: makeRef(false),
    manualSavePromiseRef: makeRef(null),
    suppressAutosaveErrorToastRef: makeRef(false),
    pendingBaselineRef: makeRef(null),
    serverTextBaselineRef: makeRef(null),
    updateBaselineRef: makeRef(jest.fn()),
    rehydrateMarkerIdsFromServer: jest.fn().mockResolvedValue(null),
    uploadPendingMarkerImages: jest.fn().mockResolvedValue(undefined),
    ...paramOverrides,
  };

  const { result } = renderHook(() => useTravelFormPersistence(params));

  const autosaveOptions = mockUseImprovedAutoSave.mock.calls.at(-1)?.[2] as any;
  return { result, params, formState, autosaveOptions };
}

beforeEach(() => {
  mockSaveFormData.mockReset();
  mockSaveTravelContent.mockReset();
  mockUseImprovedAutoSave.mockClear();
});

describe('#1516 — узкое фоновое сохранение текста', () => {
  it('шлёт только изменившееся текстовое поле и не трогает полный upsert', async () => {
    const baseline = travelSnapshot();
    const { autosaveOptions } = setupPersistence(baseline);
    mockSaveTravelContent.mockResolvedValue(contentResponse() as any);

    const next = travelSnapshot({ description: '<p>Дописанный абзац.</p>' });
    await autosaveOptions.onSave(next, undefined, baseline);

    expect(mockSaveFormData).not.toHaveBeenCalled();
    expect(mockSaveTravelContent).toHaveBeenCalledTimes(1);
    const [travelId, fields] = mockSaveTravelContent.mock.calls[0];
    expect(travelId).toBe(619);
    expect(fields).toEqual({ description: '<p>Дописанный абзац.</p>' });
  });

  it('не пересобирает форму по ответу узкого пути: точки, галерея и обложка остаются', async () => {
    const baseline = travelSnapshot();
    const { params, formState, autosaveOptions } = setupPersistence(baseline);
    mockSaveTravelContent.mockResolvedValue(contentResponse() as any);

    const next = travelSnapshot({ description: '<p>Дописанный абзац.</p>' });
    const confirmed = await autosaveOptions.onSave(next, undefined, baseline);
    autosaveOptions.onSuccess(confirmed);

    // Ответ узкого пути не содержит структуры — форму по нему не сбрасываем.
    expect(formState.reset).not.toHaveBeenCalled();
    expect(params.setMarkers).not.toHaveBeenCalled();
    expect(params.formDataRef.current.coordsMeTravel).toEqual([POINT]);
    expect(params.formDataRef.current.gallery).toEqual(GALLERY);
    expect(params.formDataRef.current.travel_image_thumb_url).toBe('https://cdn/cover.jpg');
    expect(params.formDataRef.current.publish).toBe(false);
    expect(params.formDataRef.current.categories).toEqual([1, 2]);
  });

  it('обновляет серверный baseline rich-text отправленным снимком', async () => {
    const baseline = travelSnapshot();
    const { params, autosaveOptions } = setupPersistence(baseline);
    mockSaveTravelContent.mockResolvedValue(contentResponse() as any);

    const next = travelSnapshot({ description: '<p>Дописанный абзац.</p>' });
    autosaveOptions.onSuccess(await autosaveOptions.onSave(next, undefined, baseline));

    expect(params.serverTextBaselineRef.current).toEqual({
      description: '<p>Дописанный абзац.</p>',
      plus: '<p>Плюсы</p>',
      minus: '<p>Минусы</p>',
      recommendation: '<p>Рекомендации</p>',
    });
  });

  it('синхронизирует перестроенный сервером slug вместе с baseline движка', async () => {
    const baseline = travelSnapshot();
    const { params, formState, autosaveOptions } = setupPersistence(baseline);
    mockSaveTravelContent.mockResolvedValue(
      contentResponse({ slug: 'minsk-za-vyhodnye', changed_fields: ['name', 'slug'] }) as any,
    );

    const next = travelSnapshot({ name: 'Минск за выходные' });
    const confirmed = await autosaveOptions.onSave(next, undefined, baseline);
    autosaveOptions.onSuccess(confirmed);

    expect(formState.updateField).toHaveBeenCalledWith('slug', 'minsk-za-vyhodnye');
    expect(params.formDataRef.current.slug).toBe('minsk-za-vyhodnye');
    // Без синхронизации baseline расхождение по slug ушло бы лишним полным сейвом.
    expect(params.updateBaselineRef.current).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'minsk-za-vyhodnye', name: 'Минск за выходные' }),
    );
  });

  it('оставляет структурную правку на полном сохранении', async () => {
    const baseline = travelSnapshot();
    const { autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockResolvedValue(travelSnapshot() as any);

    const next = travelSnapshot({
      coordsMeTravel: [POINT, { id: null, lat: 53.91, lng: 27.57, address: 'Точка B', categories: [] }],
    });
    await autosaveOptions.onSave(next, undefined, baseline);

    expect(mockSaveTravelContent).not.toHaveBeenCalled();
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
  });

  it('оставляет на полном пути автосейв без подтверждённого состояния', async () => {
    const baseline = travelSnapshot();
    const { autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockResolvedValue(travelSnapshot() as any);

    await autosaveOptions.onSave(travelSnapshot({ description: '<p>Текст</p>' }), undefined, undefined);

    expect(mockSaveTravelContent).not.toHaveBeenCalled();
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
  });

  it('прерывается внешним signal и не оставляет узкий запрос летящим', async () => {
    const baseline = travelSnapshot();
    const { autosaveOptions } = setupPersistence(baseline);
    const controller = new AbortController();
    controller.abort();
    mockSaveTravelContent.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    await expect(
      autosaveOptions.onSave(
        travelSnapshot({ description: '<p>Текст</p>' }),
        controller.signal,
        baseline,
      ),
    ).rejects.toThrow('Request aborted');
  });
});

/**
 * #2040: после #1995 бэк пишет `created_at` из upsert, а в форму дата попадает
 * эхом деталки, ответа upsert и восстановленного черновика. Наружу её не пускает
 * allowlist ключей `getEmptyFormData` перед `saveFormData`: поля даты в редакторе
 * нет, поэтому устаревшее эхо не должно ни откатить дату, ни подарить её новой статье.
 */
describe('#2040 — дата статьи не уходит в полный upsert', () => {
  it('не отправляет эхо даты существующей статьи', async () => {
    const baseline = travelSnapshot({ created_at: '2024-06-01T08:00:00Z' });
    const { autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockResolvedValue(travelSnapshot() as any);

    const next = travelSnapshot({
      created_at: '2024-06-01T08:00:00Z',
      coordsMeTravel: [POINT, { id: null, lat: 53.91, lng: 27.57, address: 'Точка B', categories: [] }],
    });
    await autosaveOptions.onSave(next, undefined, baseline);

    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
    const payload = mockSaveFormData.mock.calls[0][0];
    expect(payload).not.toHaveProperty('created_at');
    expect(payload.id).toBe(619);
  });

  it('не переносит дату черновика чужой статьи, восстановленного на new', async () => {
    const recoveredDraft = travelSnapshot({ id: null, created_at: '2023-05-04T10:00:00Z' });
    const { autosaveOptions } = setupPersistence(recoveredDraft, { stableTravelId: null });
    mockSaveFormData.mockResolvedValue(travelSnapshot({ id: 700 }) as any);

    await autosaveOptions.onSave(recoveredDraft, undefined, undefined);

    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
    const payload = mockSaveFormData.mock.calls[0][0];
    expect(payload).not.toHaveProperty('created_at');
    expect(payload.id ?? null).toBeNull();
  });
});

const deferredSave = () => {
  let resolve!: (value: TravelFormData) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<TravelFormData>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('#2685 — transient rejection options', () => {
  it('forwards the explicit reason without adding it to form state or subsequent saves', async () => {
    const baseline = travelSnapshot({ moderation_decision_reason: 'Historical API reason' });
    const { result, params, autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockImplementation(async (data) => ({ ...data, moderation_decision_reason: 'API reason' }));

    await act(async () => {
      await result.current.handleManualSave(baseline as unknown as TravelFormData, {
        intent: 'reject',
        moderationDecisionReason: 'Explicit rejection',
      });
    });
    expect(mockSaveFormData.mock.calls[0][2]).toEqual({ intent: 'reject', moderationDecisionReason: 'Explicit rejection' });
    expect(mockSaveFormData.mock.calls[0][0]).not.toHaveProperty('moderation_decision_reason');
    expect(params.formDataRef.current).not.toHaveProperty('moderationDecisionReason');

    await act(async () => { await result.current.handleManualSave(); });
    expect(mockSaveFormData.mock.calls[1][2]).toEqual({ intent: 'save' });
    expect(mockSaveFormData.mock.calls[1][0]).not.toHaveProperty('moderation_decision_reason');

    await autosaveOptions.onSave(travelSnapshot({ categories: [1, 2, 3] }), undefined, baseline);
    expect(mockSaveFormData.mock.calls[2][2]).toEqual({ autosave: true });
    expect(mockSaveFormData.mock.calls[2][0]).not.toHaveProperty('moderation_decision_reason');
  });

  it.each(['success', 'failure'])('waits for its own rejection %s after the previous save and ordinary tail', async (outcome) => {
    const baseline = travelSnapshot();
    const tailSnapshot = travelSnapshot({ categories: [1, 2, 3] });
    const { result } = setupPersistence(baseline);
    const first = deferredSave();
    const tail = deferredSave();
    const rejection = deferredSave();
    mockSaveFormData.mockReturnValueOnce(first.promise).mockReturnValueOnce(tail.promise).mockReturnValueOnce(rejection.promise);
    const fulfilled = jest.fn();
    const rejected = jest.fn();
    let firstSave!: Promise<TravelFormData | void>;
    let queuedSave!: Promise<TravelFormData | void>;
    let rejectionSave!: Promise<TravelFormData | void>;

    act(() => {
      firstSave = result.current.handleManualSave();
      queuedSave = result.current.handleManualSave(tailSnapshot as unknown as TravelFormData);
      rejectionSave = result.current.handleManualSave(baseline as unknown as TravelFormData, {
        intent: 'reject', moderationDecisionReason: 'Add route photos',
      });
      void rejectionSave.then(fulfilled, rejected);
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));

    await act(async () => {
      first.resolve(baseline as unknown as TravelFormData);
      await Promise.all([firstSave, queuedSave]);
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(2));
    expect(fulfilled).not.toHaveBeenCalled();
    expect(rejected).not.toHaveBeenCalled();

    await act(async () => { tail.resolve(tailSnapshot as unknown as TravelFormData); });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(3));
    expect(mockSaveFormData.mock.calls[2][0]).toEqual(expect.objectContaining({
      categories: [1, 2, 3],
      publish: false,
      moderation: false,
    }));
    expect(mockSaveFormData.mock.calls[2][2]).toEqual({ intent: 'reject', moderationDecisionReason: 'Add route photos' });
    expect(fulfilled).not.toHaveBeenCalled();
    expect(rejected).not.toHaveBeenCalled();

    if (outcome === 'failure') {
      const error = new Error('Rejection write failed');
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await act(async () => {
        rejection.reject(error);
        await expect(rejectionSave).rejects.toBe(error);
      });
      expect(fulfilled).not.toHaveBeenCalled();
      expect(rejected).toHaveBeenCalledWith(error);
      log.mockRestore();
    } else {
      const saved = { ...baseline, moderation_decision_reason: 'Add route photos' } as unknown as TravelFormData;
      await act(async () => {
        rejection.resolve(saved);
        await expect(rejectionSave).resolves.toBe(saved);
      });
      expect(fulfilled).toHaveBeenCalledWith(saved);
      expect(rejected).not.toHaveBeenCalled();
    }
  });

  it('continues with its own rejection when the preceding ordinary tail fails', async () => {
    const baseline = travelSnapshot();
    const tailSnapshot = travelSnapshot({ categories: [1, 2, 3] });
    const { result } = setupPersistence(baseline);
    const first = deferredSave();
    const tail = deferredSave();
    const saved = { ...tailSnapshot, publish: false, moderation: false } as unknown as TravelFormData;
    mockSaveFormData.mockReturnValueOnce(first.promise).mockReturnValueOnce(tail.promise).mockResolvedValueOnce(saved);
    const firstSave = result.current.handleManualSave();
    const queuedSave = result.current.handleManualSave(tailSnapshot as unknown as TravelFormData);
    const rejectionSave = result.current.handleManualSave(baseline as unknown as TravelFormData, {
      intent: 'reject', moderationDecisionReason: 'Add photos',
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));
    await act(async () => {
      first.resolve(baseline as unknown as TravelFormData);
      await Promise.all([firstSave, queuedSave]);
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(2));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await act(async () => {
        tail.reject(new Error('Ordinary tail failed'));
        await expect(rejectionSave).resolves.toBe(saved);
      });
      expect(mockSaveFormData.mock.calls[2][0]).toEqual(expect.objectContaining({ categories: [1, 2, 3] }));
      expect(mockSaveFormData.mock.calls[2][2]).toEqual({ intent: 'reject', moderationDecisionReason: 'Add photos' });
    } finally {
      log.mockRestore();
    }
  });

  it('does not report success when unmounted while waiting for the previous save', async () => {
    const baseline = travelSnapshot();
    const { result, params } = setupPersistence(baseline);
    const first = deferredSave();
    mockSaveFormData.mockReturnValueOnce(first.promise);
    const firstSave = result.current.handleManualSave();
    const rejectionSave = result.current.handleManualSave(baseline as unknown as TravelFormData, {
      intent: 'reject', moderationDecisionReason: 'Add photos',
    });
    const error = expect(rejectionSave).rejects.toThrow('Component unmounted');
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));

    await act(async () => {
      params.mountedRef.current = false;
      first.resolve(baseline as unknown as TravelFormData);
      await firstSave;
      await error;
    });
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
  });
});

const canonicalStates = ['draft', 'pending_review', 'approved', 'published'] as const;

describe('#2693 — canonical publication state in every persistence path', () => {
  it.each(canonicalStates)('manual, route, full autosave and content delta preserve %s', async (publication_status) => {
    const baseline = travelSnapshot({ publication_status, publish: false, moderation: false });
    const { result, autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockImplementation(async data => data);
    mockSaveTravelContent.mockResolvedValue(contentResponse());
    expect(autosaveOptions.enabled).toBe(true);

    await act(async () => { await result.current.handleManualSave(); });
    await act(async () => { await result.current.handleManualSave({ countries: ['3'], coordsMeTravel: [POINT] } as unknown as TravelFormData); });
    await autosaveOptions.onSave({ ...baseline, categories: [1, 2, 3] }, undefined, baseline);
    expect(mockSaveFormData).toHaveBeenCalledTimes(3);
    for (const [data, , options] of mockSaveFormData.mock.calls) {
      expect(data.publication_status).toBe(publication_status);
      expect(options?.intent ?? 'save').toBe('save');
      expect(options).not.toHaveProperty('moderationDecisionReason');
    }

    await autosaveOptions.onSave({ ...baseline, description: '<p>New text that remains on the same state.</p>' }, undefined, baseline);
    expect(mockSaveTravelContent).toHaveBeenCalledTimes(1);
    expect(mockSaveTravelContent.mock.calls[0][1]).toEqual({ description: '<p>New text that remains on the same state.</p>' });
  });

  it.each([null, '', 'future_state'])('blocks unknown canonical %p before either full or content write', async (publication_status) => {
    const baseline = travelSnapshot({ publication_status });
    const { result, autosaveOptions } = setupPersistence(baseline);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(autosaveOptions.onSave({ ...baseline, description: '<p>Changed text</p>' }, undefined, baseline)).rejects.toThrow('Неизвестное состояние публикации');
      await act(async () => { await expect(result.current.handleManualSave()).rejects.toThrow('Неизвестное состояние публикации'); });
      expect(mockSaveTravelContent).not.toHaveBeenCalled();
      expect(mockSaveFormData).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('releases a failed unknown-status save so a corrected status can be saved or submitted', async () => {
    const baseline = travelSnapshot({ publication_status: 'future_state' });
    const { result, params } = setupPersistence(baseline);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSaveFormData.mockImplementation(async data => data);
    try {
      await act(async () => {
        await expect(result.current.handleManualSave()).rejects.toThrow('Неизвестное состояние публикации');
      });
      expect(params.manualSavePromiseRef.current).toBeNull();
      expect(params.manualSaveInFlightRef.current).toBe(false);
      params.formDataRef.current = { ...baseline, publication_status: 'draft' };
      await act(async () => { await result.current.handleManualSave(undefined, { intent: 'submit' }); });
      expect(mockSaveFormData).toHaveBeenCalledTimes(1);
      expect(mockSaveFormData.mock.calls[0][0].publication_status).toBe('draft');
      expect(mockSaveFormData.mock.calls[0][2]).toEqual({ intent: 'submit' });
      expect(params.manualSavePromiseRef.current).toBeNull();
    } finally {
      log.mockRestore();
    }
  });

  it('rebases a queued ordinary save onto the confirmed command state', async () => {
    const baseline = travelSnapshot({ publication_status: 'pending_review' });
    const { result } = setupPersistence(baseline);
    const approval = deferredSave();
    mockSaveFormData.mockReturnValueOnce(approval.promise).mockImplementation(async data => data);
    let command!: Promise<TravelFormData | void>;
    act(() => {
      command = result.current.handleManualSave(baseline as unknown as TravelFormData, { intent: 'approve' });
      void result.current.handleManualSave({ ...baseline, categories: [1, 2, 3] } as unknown as TravelFormData);
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));
    await act(async () => {
      approval.resolve({ ...baseline, publication_status: 'published' } as unknown as TravelFormData);
      await command;
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(2));
    expect(mockSaveFormData.mock.calls[0][2]).toEqual({ intent: 'approve' });
    expect(mockSaveFormData.mock.calls[1][0]).toEqual(expect.objectContaining({ publication_status: 'published', categories: [1, 2, 3] }));
    expect(mockSaveFormData.mock.calls[1][2]).toEqual({ intent: 'save' });
  });

  it('waits for an already dispatched autosave before sending a command', async () => {
    const baseline = travelSnapshot({ publication_status: 'pending_review' });
    const { result, autosaveOptions } = setupPersistence(baseline);
    const background = deferredSave();
    mockSaveFormData.mockReturnValueOnce(background.promise).mockImplementation(async data => data);
    let autosave!: Promise<TravelFormData>;
    let command!: Promise<TravelFormData | void>;
    act(() => {
      autosave = autosaveOptions.onSave({ ...baseline, categories: [1, 2, 3] }, undefined, baseline);
      command = result.current.handleManualSave(undefined, { intent: 'approve' });
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));
    expect(mockSaveFormData.mock.calls[0][1]?.aborted).toBe(false);
    await act(async () => {
      background.resolve(baseline as unknown as TravelFormData);
      await autosave;
      await command;
    });
    expect(mockSaveFormData).toHaveBeenCalledTimes(2);
    expect(mockSaveFormData.mock.calls[1][2]).toEqual({ intent: 'approve' });
  });

  it('applies the first autosave server ID before a waiting submit even if engine onSuccess comes later', async () => {
    const baseline = travelSnapshot({ id: null, publication_status: 'draft' });
    const { result, params, autosaveOptions, formState } = setupPersistence(baseline, { stableTravelId: null });
    const creation = deferredSave();
    mockSaveFormData.mockReturnValueOnce(creation.promise).mockImplementation(async data => data);
    let background!: Promise<TravelFormData>;
    let submit!: Promise<TravelFormData | void>;
    act(() => {
      background = autosaveOptions.onSave(baseline, undefined, baseline);
      submit = result.current.handleManualSave(undefined, { intent: 'submit' });
    });
    await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));
    const created = { ...baseline, id: '9001', slug: 'server-created-slug', publication_status: 'draft' } as unknown as TravelFormData;
    await act(async () => {
      creation.resolve(created);
      await background;
      await submit;
    });
    expect(mockSaveFormData).toHaveBeenCalledTimes(2);
    expect(mockSaveFormData.mock.calls[1][0]).toEqual(expect.objectContaining({ id: 9001, slug: 'server-created-slug' }));
    expect(params.formDataRef.current.id).not.toBeNull();
    const resets = formState.reset.mock.calls.length;
    act(() => autosaveOptions.onSuccess(created));
    expect(formState.reset).toHaveBeenCalledTimes(resets);
  });

});

describe('#2669 — authoritative moderation metadata across full and content saves', () => {
  const previousDecision = {
    publication_status: 'draft',
    moderation_decision: 'rejected',
    moderation_decision_reason: 'Old route correction',
    moderation_decided_at: '2026-10-20T09:00:00Z',
  };
  const clearedMetadata = {
    moderation_decision: null, moderation_decision_reason: '', moderation_decided_at: null,
  };
  const currentDecision = {
    moderation_decision: 'rejected',
    moderation_decision_reason: 'Add the route duration',
    moderation_decided_at: '2026-10-21T09:15:00Z',
  };
  const serverCases = [
    { label: 'omitted', metadata: {}, status: 'pending_review', expected: clearedMetadata },
    { label: 'explicit null', metadata: { moderation_decision: null, moderation_decision_reason: null, moderation_decided_at: null }, status: 'pending_review', expected: clearedMetadata },
    { label: 'new decision', metadata: currentDecision, status: 'draft', expected: currentDecision },
  ];

  describe.each(['manual', 'autosave'] as const)('%s full save', (mode) => {
    it.each(serverCases)('applies $label server metadata despite concurrent local content and stale feedback', async ({ metadata, status, expected }) => {
      const baseline = travelSnapshot(previousDecision);
      const { result, params, formState, autosaveOptions } = setupPersistence(baseline);
      const pending = deferredSave();
      mockSaveFormData.mockReturnValueOnce(pending.promise);
      let saving!: Promise<TravelFormData | void>;
      act(() => {
        saving = mode === 'manual'
          ? result.current.handleManualSave()
          : autosaveOptions.onSave({ ...baseline, categories: [1, 2, 3] }, undefined, baseline);
      });
      await waitFor(() => expect(mockSaveFormData).toHaveBeenCalledTimes(1));
      params.formDataRef.current = {
        ...baseline,
        description: '<p>New author text typed while the save was pending.</p>',
        moderation_decision_reason: 'Stale local reason changed during the request',
      };
      await act(async () => {
        pending.resolve(travelSnapshot({ publication_status: status, ...metadata }) as unknown as TravelFormData);
        await saving;
      });

      expect(params.formDataRef.current).toMatchObject({
        publication_status: status,
        description: '<p>New author text typed while the save was pending.</p>',
        ...expected,
      });
      expect(formState.reset).toHaveBeenLastCalledWith(expect.objectContaining(expected));
      expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(expect.objectContaining({
        publication_status: status, ...expected,
      }));
      for (const field of ['moderation_decision', 'moderation_decision_reason', 'moderation_decided_at']) {
        expect(mockSaveFormData.mock.calls[0][0]).not.toHaveProperty(field);
      }
      expect(mockSaveTravelContent).not.toHaveBeenCalled();
    });
  });

  it.each([
    previousDecision,
    { ...previousDecision, publication_status: 'published', moderation_decision: 'approved' },
  ])('retains confirmed $moderation_decision metadata when a real partial content response omits it', async (metadata) => {
    const baseline = travelSnapshot(metadata);
    const next = { ...baseline, description: '<p>New author text saved through the content endpoint.</p>' };
    const { params, formState, autosaveOptions } = setupPersistence(baseline);
    params.formDataRef.current = next;
    mockSaveTravelContent.mockResolvedValue(contentResponse({ description: next.description, slug: 'updated-route' }) as any);

    let confirmed!: TravelFormData;
    await act(async () => { confirmed = await autosaveOptions.onSave(next, undefined, baseline); });
    expect(mockSaveTravelContent).toHaveBeenCalledTimes(1);
    expect(mockSaveTravelContent.mock.calls[0][1]).toEqual({ description: next.description });
    expect(mockSaveFormData).not.toHaveBeenCalled();
    expect(formState.reset).not.toHaveBeenCalled();
    expect(params.formDataRef.current).toMatchObject({ ...metadata, description: next.description, slug: 'updated-route' });
    expect(confirmed).toMatchObject(metadata);
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(expect.objectContaining(metadata));
  });

  it('rebases a stale pre-submit content snapshot onto the confirmed cleared decision before PATCH and baseline', async () => {
    const baseline = travelSnapshot(previousDecision);
    const { result, params, autosaveOptions } = setupPersistence(baseline);
    mockSaveFormData.mockResolvedValue(travelSnapshot({ publication_status: 'pending_review', ...clearedMetadata }) as any);
    await act(async () => { await result.current.handleManualSave(undefined, { intent: 'submit' }); });
    const confirmedPending = params.formDataRef.current;
    const description = '<p>Text entered around the moderation transition.</p>';
    params.formDataRef.current = { ...confirmedPending, description };
    mockSaveTravelContent.mockResolvedValue(contentResponse({ description }) as any);

    let saved!: TravelFormData;
    await act(async () => {
      saved = await autosaveOptions.onSave({ ...baseline, description }, undefined, confirmedPending);
    });
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
    expect(mockSaveTravelContent).toHaveBeenCalledTimes(1);
    expect(mockSaveTravelContent.mock.calls[0][1]).toEqual({ description });
    expect(saved).toMatchObject({ publication_status: 'pending_review', ...clearedMetadata });
    expect(params.formDataRef.current).toMatchObject({ publication_status: 'pending_review', description, ...clearedMetadata });
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(expect.objectContaining({
      publication_status: 'pending_review', ...clearedMetadata,
    }));
  });
});
