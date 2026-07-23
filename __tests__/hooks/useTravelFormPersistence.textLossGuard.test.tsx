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
import { saveFormData } from '@/api/misc';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';

const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;
const mockSaveFormData = saveFormData as jest.MockedFunction<typeof saveFormData>;

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
    isFormHydrated: true,
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
    rehydrateMarkerIdsFromServer: jest.fn().mockResolvedValue(null),
    uploadPendingMarkerImages: jest.fn().mockResolvedValue(undefined),
  };

  const { result } = renderHook(() => useTravelFormPersistence(params));
  return { result, params };
}

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
});
