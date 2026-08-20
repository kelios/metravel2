/**
 * Регрессия на guard «анти-потеря текста» (инцидент travel/225: description/minus
 * затёрты на «<p>desc</p>» обычным ручным сохранением через мастер).
 *
 * Контракт (docs/TRAVEL_SAVE_MODERATION_CONTRACT.md): это защита данных, НЕ
 * completeness-валидация. При ручном сохранении существующей статьи (есть id),
 * если rich-text поле резко разрушается относительно серверного baseline —
 * спрашиваем подтверждение. Отмена = чистый no-op (saveFormData не вызывается).
 * Если текст не меняется (например, добавили точку) — диалога нет, сейв идёт.
 */
import { renderHook, act } from '@testing-library/react-native';

import {
  detectRichTextLoss,
  confirmRichTextLossIfNeeded,
} from '@/utils/travelTextLossGuard';

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

jest.mock('@/api/misc', () => ({
  saveFormData: jest.fn(),
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

import { confirmAction } from '@/utils/confirmAction';
import { ApiError } from '@/api/client';
import { saveFormData } from '@/api/misc';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';
import { i18n } from '@/i18n';
import { showToastMessage } from '@/utils/toast';

const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;
const mockSaveFormData = saveFormData as jest.MockedFunction<typeof saveFormData>;
const mockUseImprovedAutoSave =
  useImprovedAutoSave as jest.MockedFunction<typeof useImprovedAutoSave>;
const mockShowToastMessage =
  showToastMessage as jest.MockedFunction<typeof showToastMessage>;

const LONG_TEXT =
  '<p>Это длинное реальное описание путешествия по Беларуси с массой полезных деталей и наблюдений автора.</p>';

const makeRef = <T,>(value: T) => ({ current: value });

describe('detectRichTextLoss (чистая функция)', () => {
  it('помечает поле, затёртое на заглушку «desc»', () => {
    const lost = detectRichTextLoss(
      { description: LONG_TEXT, minus: LONG_TEXT },
      { description: '<p>desc</p>', minus: LONG_TEXT },
    );
    expect(lost).toEqual(['description']);
  });

  it('помечает опустошённое поле', () => {
    const lost = detectRichTextLoss({ minus: LONG_TEXT }, { minus: '<p><br></p>' });
    expect(lost).toEqual(['minus']);
  });

  it('помечает резкое сокращение (<20% baseline)', () => {
    const lost = detectRichTextLoss(
      { description: LONG_TEXT },
      { description: '<p>короткий хвостик</p>' },
    );
    expect(lost).toEqual(['description']);
  });

  it('не помечает, если baseline сам короткий (<50 символов)', () => {
    const lost = detectRichTextLoss({ description: '<p>краткое</p>' }, { description: '' });
    expect(lost).toEqual([]);
  });

  it('не помечает неизменный текст', () => {
    const lost = detectRichTextLoss(
      { description: LONG_TEXT, minus: LONG_TEXT },
      { description: LONG_TEXT, minus: LONG_TEXT },
    );
    expect(lost).toEqual([]);
  });
});

describe('confirmRichTextLossIfNeeded', () => {
  beforeEach(() => mockConfirmAction.mockReset());

  it('не зовёт диалог и возвращает true, когда потерь нет', async () => {
    const ok = await confirmRichTextLossIfNeeded(
      { description: LONG_TEXT },
      { description: LONG_TEXT },
    );
    expect(ok).toBe(true);
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('зовёт диалог при потере и прокидывает его ответ', async () => {
    mockConfirmAction.mockResolvedValueOnce(false);
    const ok = await confirmRichTextLossIfNeeded(
      { description: LONG_TEXT },
      { description: '<p>desc</p>' },
    );
    expect(ok).toBe(false);
    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
  });
});

function setupPersistence(opts: {
  initialFormData: any;
  baselineText: any;
  isFormHydrated?: boolean;
  rehydrateMarkerIdsFromServer?: jest.Mock;
  uploadPendingMarkerImages?: jest.Mock;
}) {
  const formData = { ...opts.initialFormData };
  const formState: any = {
    data: formData,
    reset: jest.fn(),
    updateField: jest.fn(),
    updateFields: jest.fn(),
  };

  const params: any = {
    formState,
    initialFormData: opts.initialFormData,
    stableTravelId: opts.initialFormData.id ?? null,
    queryClient: null,
    userId: '1',
    isAuthenticated: true,
    hasAccess: true,
    isFormHydrated: opts.isFormHydrated ?? true,
    isOnline: true,
    isManualSaveInFlight: false,
    setIsManualSaveInFlight: jest.fn(),
    setMarkers: jest.fn(),
    showToast: jest.fn(),
    formDataRef: makeRef(opts.initialFormData),
    saveAbortControllerRef: makeRef(null),
    mountedRef: makeRef(true),
    manualSaveInFlightRef: makeRef(false),
    manualSavePromiseRef: makeRef(null),
    suppressAutosaveErrorToastRef: makeRef(false),
    pendingBaselineRef: makeRef(null),
    serverTextBaselineRef: makeRef(opts.baselineText),
    didInvalidateAfterCreateRef: makeRef(false),
    updateBaselineRef: makeRef(jest.fn()),
    rehydrateMarkerIdsFromServer:
      opts.rehydrateMarkerIdsFromServer ?? jest.fn().mockResolvedValue(null),
    uploadPendingMarkerImages:
      opts.uploadPendingMarkerImages ?? jest.fn().mockResolvedValue(undefined),
  };

  const { result } = renderHook(() => useTravelFormPersistence(params));
  return { result, params };
}

describe('autosave hydration gate', () => {
  it('keeps autosave disabled until existing server data has hydrated the form', () => {
    mockUseImprovedAutoSave.mockClear();
    mockSaveFormData.mockClear();

    setupPersistence({
      initialFormData: {
        id: 641,
        name: '',
        description: '',
        coordsMeTravel: [],
        gallery: [],
      },
      baselineText: null,
      isFormHydrated: false,
    });

    const options = mockUseImprovedAutoSave.mock.calls.at(-1)?.[2];
    expect(options).toEqual(expect.objectContaining({ enabled: false }));
    expect(mockSaveFormData).not.toHaveBeenCalled();
  });
});

describe('applySavedData — route point save races', () => {
  const pointA = {
    id: null,
    lat: 53.9,
    lng: 27.56,
    address: 'Точка A',
    categories: [],
    image: null,
  };
  const pointB = {
    id: null,
    lat: 53.91,
    lng: 27.57,
    address: 'Точка B',
    categories: [],
    image: 'blob:http://localhost/point-b',
  };

  it('does not drop a second point added while the first upsert is in flight', async () => {
    const sourceTravel = {
      id: 225,
      name: 'Путешествие',
      description: LONG_TEXT,
      coordsMeTravel: [pointA],
      countries: [],
      gallery: [],
    };
    const { result, params } = setupPersistence({
      initialFormData: sourceTravel,
      baselineText: null,
    });
    params.formDataRef.current = {
      ...sourceTravel,
      coordsMeTravel: [pointA, pointB],
    };

    await act(async () => {
      result.current.applySavedData(
        {
          ...sourceTravel,
          coordsMeTravel: [{ ...pointA, id: 101 }],
        },
        sourceTravel,
      );
      await Promise.resolve();
    });

    expect(params.formDataRef.current.coordsMeTravel).toEqual([
      expect.objectContaining({ id: 101, address: 'Точка A' }),
      expect.objectContaining({ id: null, address: 'Точка B', image: pointB.image }),
    ]);
    expect(params.setMarkers).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 101, address: 'Точка A' }),
        expect.objectContaining({ address: 'Точка B', image: pointB.image }),
      ]),
    );
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(
      expect.objectContaining({
        coordsMeTravel: [expect.objectContaining({ address: 'Точка A' })],
      }),
    );
  });

  it('grafts a late point id onto live marker data before photo upload', async () => {
    let resolveRehydrate: ((markers: any[]) => void) | null = null;
    const rehydrateMarkerIdsFromServer = jest.fn(
      () => new Promise<any[]>((resolve) => {
        resolveRehydrate = resolve;
      }),
    );
    const uploadPendingMarkerImages = jest.fn().mockResolvedValue(undefined);
    const sourceTravel = {
      id: 225,
      name: 'Путешествие',
      description: LONG_TEXT,
      coordsMeTravel: [{ ...pointA, image: 'blob:http://localhost/point-a' }],
      countries: [],
      gallery: [],
    };
    const { result, params } = setupPersistence({
      initialFormData: sourceTravel,
      baselineText: null,
      rehydrateMarkerIdsFromServer,
      uploadPendingMarkerImages,
    });

    act(() => {
      result.current.applySavedData(sourceTravel, sourceTravel);
    });

    const liveMarkers = [
      {
        ...pointA,
        address: 'Точка A — уточнено',
        categories: [9],
        image: 'blob:http://localhost/point-a',
      },
      pointB,
    ];
    params.formDataRef.current = {
      ...params.formDataRef.current,
      coordsMeTravel: liveMarkers,
    };

    await act(async () => {
      resolveRehydrate?.([{
        ...pointA,
        id: 101,
        image: null,
      }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    const expectedMarkers = [
      { ...liveMarkers[0], id: 101 },
      pointB,
    ];
    expect(params.formDataRef.current.coordsMeTravel).toEqual(expectedMarkers);
    expect(params.setMarkers).toHaveBeenLastCalledWith(expectedMarkers);
    expect(uploadPendingMarkerImages).toHaveBeenCalledWith(expectedMarkers);
  });

  it('does not baseline a text edit made while point ids rehydrate', async () => {
    let resolveRehydrate: ((markers: any[]) => void) | null = null;
    const rehydrateMarkerIdsFromServer = jest.fn(
      () => new Promise<any[]>((resolve) => {
        resolveRehydrate = resolve;
      }),
    );
    const sourceTravel = {
      id: 225,
      name: 'Путешествие',
      description: LONG_TEXT,
      coordsMeTravel: [{ ...pointA, image: 'blob:http://localhost/point-a' }],
      countries: [],
      gallery: [],
    };
    const { result, params } = setupPersistence({
      initialFormData: sourceTravel,
      baselineText: null,
      rehydrateMarkerIdsFromServer,
    });

    act(() => {
      result.current.applySavedData(sourceTravel, sourceTravel);
    });
    params.formDataRef.current = {
      ...params.formDataRef.current,
      description: `${LONG_TEXT}<p>Несохранённое дополнение</p>`,
    };

    await act(async () => {
      resolveRehydrate?.([{ ...pointA, id: 101, image: null }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(params.formDataRef.current).toEqual(
      expect.objectContaining({
        description: `${LONG_TEXT}<p>Несохранённое дополнение</p>`,
        coordsMeTravel: [expect.objectContaining({ id: 101 })],
      }),
    );
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: LONG_TEXT }),
    );
  });

  it('uses the sent autosave snapshot as baseline when the form advances in flight', async () => {
    let resolveSave: ((saved: any) => void) | null = null;
    mockSaveFormData.mockReset();
    mockSaveFormData.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const sourceTravel = {
      id: 225,
      name: 'Путешествие',
      description: LONG_TEXT,
      coordsMeTravel: [pointA],
      countries: [],
      gallery: [],
    };
    const { params } = setupPersistence({
      initialFormData: sourceTravel,
      baselineText: null,
    });
    const autosaveOptions: any = mockUseImprovedAutoSave.mock.calls.at(-1)?.[2];
    const savePromise = autosaveOptions.onSave(sourceTravel, new AbortController().signal);
    params.formDataRef.current = {
      ...sourceTravel,
      coordsMeTravel: [pointA, pointB],
    };

    await act(async () => {
      resolveSave?.({
        ...sourceTravel,
        coordsMeTravel: [{ ...pointA, id: 101 }],
      });
      const savedData = await savePromise;
      autosaveOptions.onSuccess(savedData);
      await Promise.resolve();
    });

    expect(params.formDataRef.current.coordsMeTravel).toHaveLength(2);
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(
      expect.objectContaining({
        coordsMeTravel: [expect.objectContaining({ address: 'Точка A' })],
      }),
    );
  });
});

describe('handleManualSave — guard «анти-потеря текста»', () => {
  const baseTravel = {
    id: 225,
    name: 'Путешествие',
    description: LONG_TEXT,
    plus: '',
    minus: LONG_TEXT,
    recommendation: '',
    coordsMeTravel: [],
    gallery: [],
  };

  beforeEach(() => {
    mockConfirmAction.mockReset();
    mockSaveFormData.mockReset();
    mockSaveFormData.mockResolvedValue({ ...baseTravel } as any);
  });

  it('сокращение description до «desc» → confirm; да → saveFormData вызван', async () => {
    mockConfirmAction.mockResolvedValueOnce(true);
    const { result } = setupPersistence({
      initialFormData: baseTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: LONG_TEXT,
        recommendation: '',
      },
    });

    await act(async () => {
      await result.current.handleManualSave({
        ...baseTravel,
        description: '<p>desc</p>',
      } as any);
    });

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
  });

  it('сокращение description до «desc» → confirm; нет → saveFormData НЕ вызван', async () => {
    mockConfirmAction.mockResolvedValueOnce(false);
    const { result } = setupPersistence({
      initialFormData: baseTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: LONG_TEXT,
        recommendation: '',
      },
    });

    await act(async () => {
      await result.current.handleManualSave({
        ...baseTravel,
        description: '<p>desc</p>',
      } as any);
    });

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(mockSaveFormData).not.toHaveBeenCalled();
  });

  it('добавление точки при неизменном тексте → нет диалога, сейв идёт', async () => {
    mockConfirmAction.mockResolvedValue(true);
    const { result } = setupPersistence({
      initialFormData: baseTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: LONG_TEXT,
        recommendation: '',
      },
    });

    await act(async () => {
      await result.current.handleManualSave({
        ...baseTravel,
        coordsMeTravel: [
          { id: null, lat: 53.9, lng: 27.56, address: 'Минск', categories: [1] },
        ],
      } as any);
    });

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
  });

  it('частичный route-override сохраняет текст, фильтры и галерею из живой формы', async () => {
    const galleryItem = {
      id: 901,
      url: 'https://metravel.by/gallery/901/gallery/photo.jpg',
    };
    const currentTravel = {
      ...baseTravel,
      categories: [7],
      gallery: [galleryItem],
    };
    const { result } = setupPersistence({
      initialFormData: currentTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: LONG_TEXT,
        recommendation: '',
      },
    });

    await act(async () => {
      await result.current.handleManualSave({
        countries: ['1'],
        coordsMeTravel: [
          { id: null, lat: 53.9, lng: 27.56, address: 'Минск', categories: [1] },
        ],
      } as any);
    });

    expect(mockSaveFormData).toHaveBeenCalledTimes(1);
    expect(mockSaveFormData.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        id: 225,
        description: LONG_TEXT,
        categories: [7],
        gallery: [galleryItem],
        coordsMeTravel: [
          expect.objectContaining({ lat: 53.9, lng: 27.56, address: 'Минск' }),
        ],
      }),
    );
  });
});

describe('handleManualSave — server echo while editing', () => {
  const sentTravel = {
    id: 225,
    slug: 'old-slug',
    name: 'Путешествие',
    description: LONG_TEXT,
    plus: '',
    minus: '',
    recommendation: '',
    youtube_link: '',
    year: '2024',
    visitedDate: '2024-05-10',
    visa: false,
    categories: ['1'],
    cities: ['10'],
    countries: [],
    coordsMeTravel: [
      {
        id: null,
        lat: 53.9,
        lng: 27.56,
        address: 'Точка A',
        categories: [],
        image: null,
      },
    ],
    gallery: [
      {
        id: 901,
        url: 'blob:http://localhost/gallery-901',
        caption: 'Подпись до сейва',
      },
    ],
    travel_image_thumb_url: 'blob:http://localhost/cover',
    travel_image_thumb_small_url: 'blob:http://localhost/cover-small',
  };

  beforeEach(() => {
    mockConfirmAction.mockReset();
    mockSaveFormData.mockReset();
  });

  it('keeps fields edited after dispatch and still applies server-generated fields', async () => {
    let resolveSave: ((savedData: typeof sentTravel) => void) | null = null;
    mockSaveFormData.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSave = resolve as (savedData: typeof sentTravel) => void;
      }),
    );
    const { result, params } = setupPersistence({
      initialFormData: sentTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: '',
        recommendation: '',
      },
    });

    let savePromise: Promise<unknown> | null = null;
    await act(async () => {
      savePromise = result.current.handleManualSave();
      await Promise.resolve();
    });
    expect(mockSaveFormData).toHaveBeenCalledTimes(1);

    const liveDescription = `${LONG_TEXT}<p>Правка во время сейва</p>`;
    params.formDataRef.current = {
      ...sentTravel,
      name: 'Путешествие — новое название',
      description: liveDescription,
      year: '2025',
      visitedDate: '2025-06-11',
      visa: true,
      categories: ['2'],
      cities: ['20'],
      gallery: [
        {
          ...sentTravel.gallery[0],
          caption: 'Подпись во время сейва',
        },
      ],
    };

    await act(async () => {
      resolveSave?.({
        ...sentTravel,
        slug: 'server-slug',
        coordsMeTravel: [{ ...sentTravel.coordsMeTravel[0], id: 101 }],
        gallery: [
          {
            id: 901,
            url: 'https://metravel.by/gallery/901/photo.jpg',
            caption: 'Подпись до сейва',
          },
        ],
        travel_image_thumb_url: 'https://metravel.by/cover/full.jpg',
        travel_image_thumb_small_url: 'https://metravel.by/cover/small.jpg',
      });
      await savePromise;
      await Promise.resolve();
    });

    expect(params.formDataRef.current).toEqual(
      expect.objectContaining({
        slug: 'server-slug',
        name: 'Путешествие — новое название',
        description: liveDescription,
        year: '2025',
        visitedDate: '2025-06-11',
        visa: true,
        categories: ['2'],
        cities: ['20'],
        coordsMeTravel: [expect.objectContaining({ id: 101 })],
        gallery: [
          expect.objectContaining({
            id: 901,
            url: 'https://metravel.by/gallery/901/photo.jpg',
            caption: 'Подпись во время сейва',
          }),
        ],
        travel_image_thumb_url: 'https://metravel.by/cover/full.jpg',
        travel_image_thumb_small_url: 'https://metravel.by/cover/small.jpg',
      }),
    );
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(
      expect.objectContaining({
        slug: 'old-slug',
        name: 'Путешествие',
        description: LONG_TEXT,
        coordsMeTravel: [expect.objectContaining({ id: null })],
      }),
    );
  });

  it('keeps the confirmed baseline equal to the form when no edit races the save (F-09)', async () => {
    const savedTravel = {
      ...sentTravel,
      slug: 'server-slug',
      coordsMeTravel: [{ ...sentTravel.coordsMeTravel[0], id: 101 }],
      gallery: [
        {
          id: 901,
          url: 'https://metravel.by/gallery/901/photo.jpg',
          caption: 'Подпись до сейва',
        },
      ],
      travel_image_thumb_url: 'https://metravel.by/cover/full.jpg',
      travel_image_thumb_small_url: 'https://metravel.by/cover/small.jpg',
    };
    mockSaveFormData.mockResolvedValueOnce(savedTravel as any);
    const { result, params } = setupPersistence({
      initialFormData: sentTravel,
      baselineText: {
        description: LONG_TEXT,
        plus: '',
        minus: '',
        recommendation: '',
      },
    });

    await act(async () => {
      await result.current.handleManualSave();
      await Promise.resolve();
    });

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(params.formDataRef.current).toEqual(savedTravel);
    expect(params.updateBaselineRef.current).toHaveBeenLastCalledWith(savedTravel);
  });
});

describe('handleManualSave — localized backend errors', () => {
  const baseTravel = {
    id: 225,
    name: 'Путешествие',
    description: LONG_TEXT,
    plus: '',
    minus: '',
    recommendation: '',
    coordsMeTravel: [],
    gallery: [],
  };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockConfirmAction.mockReset();
    mockSaveFormData.mockReset();
    mockShowToastMessage.mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await i18n.changeLanguage('ru');
  });

  afterEach(async () => {
    consoleErrorSpy.mockRestore();
    await i18n.changeLanguage('ru');
  });

  const expectRejectedManualSave = async (error: Error, intent?: 'save' | 'publish') => {
    mockSaveFormData.mockRejectedValueOnce(error);
    const { result } = setupPersistence({
      initialFormData: baseTravel,
      baselineText: null,
    });

    await act(async () => {
      await expect(
        result.current.handleManualSave(undefined, intent ? { intent } : undefined),
      ).rejects.toBe(error);
    });
  };

  it.each([
    ['ru', 'Заполните это поле'],
    ['uk', 'Заповніть це поле'],
  ] as const)('localizes a standard DRF field error in %s', async (locale, expected) => {
    await i18n.changeLanguage(locale);
    const error = new ApiError(400, 'name: This field may not be blank.', {
      name: ['This field may not be blank.'],
    });

    await expectRejectedManualSave(error);

    expect(mockShowToastMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text2: expected,
    }));
  });

  it.each([
    ['field string', { name: 'This field may not be blank.' }],
    ['detail string', { detail: 'This field may not be blank.' }],
  ] as const)('localizes a standard DRF error from a %s payload', async (_shape, data) => {
    const error = new ApiError(400, 'This field may not be blank.', data);

    await expectRejectedManualSave(error);

    expect(mockShowToastMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text2: 'Заполните это поле',
    }));
  });

  it('passes an unknown backend field message through verbatim', async () => {
    const customMessage = 'Use letters only.';
    const error = new ApiError(400, `name: ${customMessage}`, {
      name: [customMessage],
    });

    await expectRejectedManualSave(error);

    expect(mockShowToastMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text2: customMessage,
    }));
  });

  it('uses the existing fallback for a generic Save failed error', async () => {
    await expectRejectedManualSave(new Error('Save failed'));

    expect(mockShowToastMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text2: 'Попробуйте ещё раз',
    }));
  });

  it('preserves the informational saved-as-draft moderation toast', async () => {
    const moderationMessage =
      'Published travels must pass moderation before they can be published.';
    const error = new ApiError(400, moderationMessage, {
      detail: moderationMessage,
    });

    await expectRejectedManualSave(error, 'publish');

    expect(mockShowToastMessage).toHaveBeenCalledWith({
      type: 'info',
      text1: 'Сохранено как черновик',
      text2:
        'Маршрут сохранён как черновик, но пока не может быть опубликован: сначала он должен пройти модерацию.',
    });
  });
});
