import { renderHook } from '@testing-library/react-native';

import { useUpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
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
      canSave: true,
      error: null,
      clearError: jest.fn(),
    },
    handleManualSave: jest.fn(),
    handleCountrySelect: jest.fn(),
    handleCountryDeselect: jest.fn(),
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
    });

    const formData = { id: 1, countries: [], categories: [] };
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      formState: { isDirty: true },
      hasUserInteracted: true,
      formData,
    });

    renderHook(() => useUpsertTravelController());
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(formData);
  });

  it('clears local draft after manual save to prevent draft popup after reload', async () => {
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
    });

    const handleManualSave = jest.fn(async () => ({ id: 1 } as any));
    mockUseTravelFormData.mockReturnValue({
      ...baseForm,
      hasUserInteracted: true,
      formState: { isDirty: true },
      formData: { id: 1, countries: [], categories: [] },
      handleManualSave,
    });

    const { result } = renderHook(() => useUpsertTravelController());

    await result.current.handleManualSave();

    expect(handleManualSave).toHaveBeenCalledTimes(1);
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });
});
