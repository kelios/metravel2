import { act, renderHook } from '@testing-library/react-native';
import { useRef } from 'react';
import type { TravelFormData } from '@/types/types';
import { getEmptyFormData } from '@/utils/travelFormUtils';
import { useFormState } from '@/hooks/useFormState';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';
import { saveFormData } from '@/api/misc';

jest.mock('@/api/misc', () => ({ saveFormData: jest.fn(), saveTravelContent: jest.fn() }));
jest.mock('@/utils/toast', () => ({ showToastMessage: jest.fn() }));

const save = saveFormData as jest.MockedFunction<typeof saveFormData>;
const noop = jest.fn();
const asyncNoop = jest.fn(async () => undefined);

function usePersistence(initial: TravelFormData) {
  const formState = useFormState(initial);
  const formDataRef = useRef(formState.data);
  formDataRef.current = formState.data;
  const params = {
    formState, initialFormData: initial, stableTravelId: null, queryClient: null,
    userId: '1', isAuthenticated: true, hasAccess: true, isFormHydrated: true,
    isOnline: true, isManualSaveInFlight: false, setIsManualSaveInFlight: noop,
    setMarkers: noop, showToast: noop, formDataRef,
    saveAbortControllerRef: useRef<AbortController | null>(null), mountedRef: useRef(true),
    manualSaveInFlightRef: useRef(false),
    manualSavePromiseRef: useRef<Promise<TravelFormData | void> | null>(null),
    suppressAutosaveErrorToastRef: useRef(false), pendingBaselineRef: useRef<TravelFormData | null>(null),
    serverTextBaselineRef: useRef(null),
    updateBaselineRef: useRef<((data: TravelFormData) => void) | null>(null),
    rehydrateMarkerIdsFromServer: asyncNoop, uploadPendingMarkerImages: asyncNoop,
  };
  return { formState, ...useTravelFormPersistence(params) };
}

describe('#2693 — real autosave engine and publication commands', () => {
  beforeEach(() => { jest.useFakeTimers(); save.mockReset(); });
  afterEach(() => { jest.useRealTimers(); });

  it.each([false, true])('keeps first server id and settles without duplicate autosave (waiting command: %s)', async (withCommand) => {
    const initial = getEmptyFormData(null);
    let resolveCreation!: (data: TravelFormData) => void;
    const creation = new Promise<TravelFormData>(resolve => { resolveCreation = resolve; });
    save.mockReturnValueOnce(creation).mockImplementation(async data => ({ ...data, publication_status: 'pending_review' }));
    const { result } = await renderHook(() => usePersistence(initial));
    await act(() => result.current.formState.updateField('name', 'A new test article'));
    let background!: Promise<TravelFormData>;
    await act(() => { background = result.current.autosave.saveNow(); });
    expect(save).toHaveBeenCalledTimes(1);
    let command: Promise<TravelFormData | void> | undefined;
    if (withCommand) await act(() => { command = result.current.handleManualSave(undefined, { intent: 'submit' }); });
    const created = { ...save.mock.calls[0][0], id: '9901', slug: 'created-by-server', publication_status: 'draft' } as TravelFormData;
    await act(async () => {
      resolveCreation(created);
      await background;
      if (command) await command;
    });
    expect(String(result.current.formState.data.id)).toBe('9901');
    expect(result.current.formState.data).toMatchObject({
      moderation_decision: null, moderation_decision_reason: '', moderation_decided_at: null,
    });
    if (withCommand) {
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0]).toEqual(expect.objectContaining({ id: 9901, slug: 'created-by-server' }));
      expect(save.mock.calls[1][2]).toEqual({ intent: 'submit' });
    }
    await act(async () => { jest.advanceTimersByTime(15000); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(withCommand ? 2 : 1);
    expect(String(result.current.formState.data.id)).toBe('9901');
    expect(result.current.autosave.hasUnsavedChanges).toBe(false);
  });
});
