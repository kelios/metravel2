/**
 * #1516: фоновое автосохранение правок текста уходит узким
 * `PATCH /travels/{id}/content/`, а не полным `PUT /travels/upsert/`.
 *
 * Контракт: правка текста не трогает структуру статьи (точки, галерея, обложка,
 * справочники, статус публикации), структурная правка по-прежнему идёт полным
 * сохранением, а ответ узкого пути НЕ применяется как полная статья — иначе
 * подтверждение из пяти текстовых полей выглядело бы как «сервер всё удалил».
 */
import { renderHook } from '@testing-library/react-native';

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
    didInvalidateAfterCreateRef: makeRef(false),
    updateBaselineRef: makeRef(jest.fn()),
    rehydrateMarkerIdsFromServer: jest.fn().mockResolvedValue(null),
    uploadPendingMarkerImages: jest.fn().mockResolvedValue(undefined),
    ...paramOverrides,
  };

  renderHook(() => useTravelFormPersistence(params));

  const autosaveOptions = mockUseImprovedAutoSave.mock.calls.at(-1)?.[2] as any;
  return { params, formState, autosaveOptions };
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
