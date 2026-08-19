import { act, renderHook } from '@testing-library/react-native';

import { useUpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';

const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ setParams: mockSetParams })),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: jest.fn(),
}));

jest.mock('@/hooks/useTravelFormData', () => ({
  useTravelFormData: jest.fn(),
}));

jest.mock('@/hooks/useTravelWizard', () => ({
  useTravelWizard: jest.fn(),
}));

jest.mock('@/hooks/useTravelFilters', () => ({
  useTravelFilters: jest.fn(),
}));

jest.mock('@/hooks/useDraftRecovery', () => ({
  ...jest.requireActual('@/hooks/useDraftRecovery'),
  useDraftRecovery: jest.fn(),
}));

describe('useUpsertTravelController', () => {
  const mockUseLocalSearchParams = require('expo-router').useLocalSearchParams as jest.Mock;
  const mockUseAuth = require('@/context/AuthContext').useAuth as jest.Mock;
  const mockUseThemedColors = require('@/hooks/useTheme').useThemedColors as jest.Mock;
  const mockUseTravelFormData = require('@/hooks/useTravelFormData').useTravelFormData as jest.Mock;
  const mockUseTravelWizard = require('@/hooks/useTravelWizard').useTravelWizard as jest.Mock;
  const mockUseTravelFilters = require('@/hooks/useTravelFilters').useTravelFilters as jest.Mock;
  const mockUseDraftRecovery = require('@/hooks/useDraftRecovery').useDraftRecovery as jest.Mock;

  const baseWizard = {
    currentStep: 1,
    totalSteps: 6,
    stepConfig: [
      { id: 1, title: 'Step1', subtitle: '', tipTitle: '', tipBody: '', nextLabel: '' },
      { id: 2, title: 'Step2', subtitle: '', tipTitle: '', tipBody: '', nextLabel: '' },
    ],
    step1SubmitErrors: [],
    focusAnchorId: null,
    handleBack: jest.fn(),
    handleNext: jest.fn(),
    handleFinishWizard: jest.fn(),
    handleNavigateToIssue: jest.fn(),
    handleAnchorHandled: jest.fn(),
    handleStepSelect: jest.fn(),
  };

  const baseForm = {
    isInitialLoading: false,
    hasAccess: true,
    hasUserInteracted: false,
    formData: { id: null, countries: [], categories: [] },
    setFormData: jest.fn(),
    markers: [],
    setMarkers: jest.fn(),
    travelDataOld: null,
    formState: { isDirty: false },
    autosave: {
      status: 'idle',
      hasUnsavedChanges: false,
      // Synchronous ref read used by saveAndClearDraft: the render-time value is
      // still the pre-save one when the manual save resolves.
      getHasUnsavedChanges: jest.fn(() => false),
      canSave: true,
      error: null,
      clearError: jest.fn(),
    },
    handleManualSave: jest.fn(),
    handleCountrySelect: jest.fn(),
    handleCountryDeselect: jest.fn(),
    // Live read of the form: saveAndClearDraft snapshots it before the manual
    // save and again after, to tell in-flight keystrokes from server echo.
    getFormData: jest.fn(() => ({ id: 1, countries: [], categories: [] })),
  };

  const baseFilters = {
    categories: [],
    transports: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
    categoryTravelAddress: [],
    countries: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseThemedColors.mockReturnValue({ primary: '#000' });

    mockUseAuth.mockReturnValue({
      userId: 'u1',
      isAuthenticated: true,
      isSuperuser: false,
      authReady: true,
    });

    mockUseLocalSearchParams.mockReturnValue({ id: undefined });

    mockUseTravelFormData.mockReturnValue(baseForm);

    mockUseTravelWizard.mockReturnValue(baseWizard);

    mockUseTravelFilters.mockReturnValue({
      filters: baseFilters,
      isLoading: false,
    });

    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft: jest.fn(),
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });
  });

  it('sets isNew=true when id is missing', () => {
    const { result } = renderHook(() => useUpsertTravelController());
    expect(result.current.isNew).toBe(true);
  });

  it('sets isNew=false when id is provided', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '123' });
    const { result } = renderHook(() => useUpsertTravelController());
    expect(result.current.isNew).toBe(false);
  });

  it('computes autosaveBadge from autosave status', () => {
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      autosave: { ...baseForm.autosave, status: 'saving' },
    });

    const { result } = renderHook(() => useUpsertTravelController());
    expect(result.current.autosaveBadge).toBe('Сохранение...');
  });

  it('computes progress based on wizard currentStep / totalSteps', () => {
    mockUseTravelWizard.mockReturnValue({
      ...baseWizard,
      currentStep: 3,
      totalSteps: 6,
    });

    const { result } = renderHook(() => useUpsertTravelController());
    expect(result.current.progress).toBe(0.5);
  });

  it('selects currentStepMeta from stepConfig', () => {
    mockUseTravelWizard.mockReturnValue({
      ...baseWizard,
      currentStep: 2,
      stepConfig: [
        { id: 1, title: 'Step1', subtitle: '', tipTitle: '', tipBody: '', nextLabel: '' },
        { id: 2, title: 'Step2', subtitle: 's2', tipTitle: 't', tipBody: 'b', nextLabel: 'n' },
      ],
    });

    const { result } = renderHook(() => useUpsertTravelController());
    expect(result.current.currentStepMeta?.id).toBe(2);
    expect(result.current.currentStepMeta?.subtitle).toBe('s2');
  });

  it('passes loadOnMount/currentStep to useTravelFilters', () => {
    mockUseTravelWizard.mockReturnValue({
      ...baseWizard,
      currentStep: 4,
    });

    renderHook(() => useUpsertTravelController());

    expect(mockUseTravelFilters).toHaveBeenCalledWith({
      loadOnMount: true,
      currentStep: 4,
    });
  });

  it('does not save local draft when form is dirty but user did not interact', () => {
    const saveDraft = jest.fn();
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });

    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: false,
      formData: { id: 1, countries: [], categories: [] },
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('saves local draft when form is dirty and user interacted', () => {
    const saveDraft = jest.fn();
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });

    const formData = { id: 1, countries: [], categories: [] };
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData,
      // An author who just typed has edits the server has not confirmed yet -
      // that is the state the autosave engine reports here.
      autosave: { ...baseForm.autosave, hasUnsavedChanges: true },
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(formData);
  });

  it('clears rather than re-persists the draft once a save confirmed the data (F-09 P2)', () => {
    const saveDraft = jest.fn();
    const clearDraft = jest.fn(async () => undefined);
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft,
      flushDraft: jest.fn(async () => true),
    });

    // Dirty + interacted, but the autosave confirmed everything the author has:
    // the data is on the server, so re-persisting a draft would create a false
    // recovery prompt - and the stored one has to actually go away.
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData: { id: 1, countries: [], categories: [] },
      autosave: { ...baseForm.autosave, status: 'saved', hasUnsavedChanges: false },
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).not.toHaveBeenCalled();
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('does not persist a draft while an autosave confirms the current data', () => {
    const saveDraft = jest.fn();
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });

    // In flight, but the payload already covers everything the author has:
    // nothing is unconfirmed, so there is nothing to keep locally.
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData: { id: 1, countries: [], categories: [] },
      autosave: { ...baseForm.autosave, status: 'saving', hasUnsavedChanges: false },
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('persists edits typed while an autosave is in flight', () => {
    const saveDraft = jest.fn();
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });

    // Autosave no longer aborts itself, so a heavy article sits in `saving` for
    // the whole upsert. Anything typed in that window is newer than the payload
    // in flight and lives only here until the next save confirms it.
    const formData = { id: 1, countries: [], categories: [], description: 'typed mid-flight' };
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData,
      autosave: { ...baseForm.autosave, status: 'saving', hasUnsavedChanges: true },
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).toHaveBeenCalledWith(formData);
  });

  it('keeps the draft when a save succeeds with edits still unconfirmed', () => {
    const clearDraft = jest.fn(async () => undefined);
    const saveDraft = jest.fn();
    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: false,
      draftTimestamp: null,
      isRecovering: false,
      recoverDraft: jest.fn(async () => null),
      dismissDraft: jest.fn(async () => undefined),
      saveDraft,
      clearDraft,
      flushDraft: jest.fn(async () => true),
    });

    // The finished save confirms its own payload, not the keystrokes that landed
    // after it started. Clearing here would wipe their only local copy.
    const formData = { id: 1, countries: [], categories: [], description: 'typed mid-flight' };
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData,
      autosave: { ...baseForm.autosave, status: 'saved', hasUnsavedChanges: true },
    });

    renderHook(() => useUpsertTravelController());
    expect(clearDraft).not.toHaveBeenCalled();
    expect(saveDraft).toHaveBeenCalledWith(formData);
  });

  const draftMock = (over: Record<string, unknown> = {}) => ({
    hasPendingDraft: false,
    draftTimestamp: null,
    isRecovering: false,
    recoverDraft: jest.fn(async () => null),
    dismissDraft: jest.fn(async () => undefined),
    saveDraft: jest.fn(),
    clearDraft: jest.fn(async () => undefined),
    flushDraft: jest.fn(async () => true),
    ...over,
  });

  it('clears local draft after manual save to prevent draft popup after reload', async () => {
    const clearDraft = jest.fn(async () => undefined);
    mockUseDraftRecovery.mockReturnValue(draftMock({ clearDraft }));

    const handleManualSave = jest.fn(async () => ({ id: 1 } as any));
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [] },
      handleManualSave,
      autosave: { ...baseForm.autosave, getHasUnsavedChanges: jest.fn(() => false) },
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(handleManualSave).toHaveBeenCalledTimes(1);
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('clears the draft after a partial-override manual save too (#1511)', async () => {
    // ContentUpsertSection/TravelWizardStepRoute call onManualSave({ description })
    // and { countries, coordsMeTravel }. What reaches the server is that partial
    // MERGED into the live form, so deciding by comparing the argument against the
    // form could never match and the draft would survive every manual save.
    const clearDraft = jest.fn(async () => undefined);
    const flushDraft = jest.fn(async () => true);
    mockUseDraftRecovery.mockReturnValue(draftMock({ clearDraft, flushDraft }));

    const handleManualSave = jest.fn(async () => ({ id: 1 } as any));
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [], name: 'Статья', description: '<p>b</p>' },
      handleManualSave,
      autosave: { ...baseForm.autosave, getHasUnsavedChanges: jest.fn(() => false) },
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await act(async () => {
      await result.current.handleManualSave({ description: '<p>new</p>' } as any);
    });

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(flushDraft).not.toHaveBeenCalled();
  });

  it('settles the draft before returning, not on a later render (#1511)', async () => {
    // useTravelPublishModeration calls router.replace right after this resolves,
    // deliberately unmounting the wizard - a passive effect would never run on the
    // removed subtree, so the draft would survive and reopen the recovery dialog.
    // Asserted without an act() wrapper: nothing here may depend on a render
    // happening after the callback returned.
    const clearDraft = jest.fn(async () => undefined);
    mockUseDraftRecovery.mockReturnValue(draftMock({ clearDraft }));

    const handleManualSave = jest.fn(async () => ({ id: 1 } as any));
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [] },
      handleManualSave,
      autosave: { ...baseForm.autosave, getHasUnsavedChanges: jest.fn(() => false) },
    });

    const { result, unmount } = renderHook(() => useUpsertTravelController());

    await result.current.handleManualSave();
    expect(clearDraft).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('keeps keystrokes typed while a manual save was in flight (#1511)', async () => {
    // A heavy article saves for 11-12s with the editors still live, and this flow
    // can navigate away on completion - so the draft is the only copy of whatever
    // was typed after the payload went out, and nothing reschedules it.
    const clearDraft = jest.fn(async () => undefined);
    const flushDraft = jest.fn(async () => true);
    mockUseDraftRecovery.mockReturnValue(draftMock({ clearDraft, flushDraft }));

    const handleManualSave = jest.fn(async () => ({ id: 1 } as any));
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [], name: 'typed while saving' },
      handleManualSave,
      autosave: { ...baseForm.autosave, getHasUnsavedChanges: jest.fn(() => true) },
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(flushDraft).toHaveBeenCalledTimes(1);
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it('touches nothing when the author declines the rich-text loss confirm (#1511)', async () => {
    // That path is a clean no-op: no request, form untouched. The draft still holds
    // unconfirmed edits, so clearing it there would delete the only local copy.
    const clearDraft = jest.fn(async () => undefined);
    const flushDraft = jest.fn(async () => true);
    mockUseDraftRecovery.mockReturnValue(draftMock({ clearDraft, flushDraft }));

    const handleManualSave = jest.fn(async () => undefined);
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [] },
      handleManualSave,
      autosave: { ...baseForm.autosave, hasUnsavedChanges: false },
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(handleManualSave).toHaveBeenCalledTimes(1);
    expect(clearDraft).not.toHaveBeenCalled();
    expect(flushDraft).not.toHaveBeenCalled();
  });

  it('recovers a new-travel draft without a stale server id and restores route points', async () => {
    const recoveredMarkers = [
      {
        id: null,
        lat: 53.9,
        lng: 27.5667,
        country: 1,
        address: 'Минск',
        categories: [2],
        image: null,
      },
    ];
    const recoverDraft = jest.fn(async () => ({
      ...baseForm.formData,
      id: '714',
      name: 'Локальный маршрут',
      coordsMeTravel: recoveredMarkers,
    }));
    const setFormData = jest.fn();
    const setMarkers = jest.fn();

    mockUseDraftRecovery.mockReturnValue({
      hasPendingDraft: true,
      draftTimestamp: Date.now(),
      isRecovering: false,
      recoverDraft,
      dismissDraft: jest.fn(async () => undefined),
      saveDraft: jest.fn(),
      clearDraft: jest.fn(async () => undefined),
      flushDraft: jest.fn(async () => true),
    });
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      setFormData,
      setMarkers,
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await act(async () => {
      await result.current.draftRecovery.recoverDraft();
    });

    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({
      id: null,
      name: 'Локальный маршрут',
      coordsMeTravel: recoveredMarkers,
    }));
    expect(setMarkers).toHaveBeenCalledWith(recoveredMarkers);
  });

  it('reflects the server id in the URL after the first save of a new travel (F-09)', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined });
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formData: { id: 456, countries: [], categories: [] },
    });

    renderHook(() => useUpsertTravelController());

    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({ id: '456' });
  });

  it('does not push id into the URL when editing an existing travel', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '456' });
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formData: { id: 456, countries: [], categories: [] },
    });

    renderHook(() => useUpsertTravelController());

    expect(mockSetParams).not.toHaveBeenCalled();
  });

  it('reflects the created id only once across re-renders', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined });
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formData: { id: 456, countries: [], categories: [] },
    });

    const { rerender } = renderHook(() => useUpsertTravelController());
    rerender({});
    rerender({});

    expect(mockSetParams).toHaveBeenCalledTimes(1);
  });
});
