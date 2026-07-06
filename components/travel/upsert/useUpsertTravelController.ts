import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useTravelFilters } from '@/hooks/useTravelFilters';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { useTravelWizard } from '@/hooks/useTravelWizard';
import { useThemedColors } from '@/hooks/useTheme';
import { useDraftRecovery } from '@/hooks/useDraftRecovery';
import { normalizeTravelId } from '@/utils/travelFormUtils';

type ManualSave = ReturnType<typeof useTravelFormData>['handleManualSave'];

export interface UpsertTravelController {
  isNew: boolean;
  isInitialLoading: boolean;
  hasAccess: boolean;
  loadError: { status: number; message: string } | null;
  retryLoad: () => Promise<void>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;

  colors: ReturnType<typeof useThemedColors>;

  formData: ReturnType<typeof useTravelFormData>['formData'];
  setFormData: ReturnType<typeof useTravelFormData>['setFormData'];
  markers: ReturnType<typeof useTravelFormData>['markers'];
  setMarkers: ReturnType<typeof useTravelFormData>['setMarkers'];
  travelDataOld: ReturnType<typeof useTravelFormData>['travelDataOld'];

  autosave: ReturnType<typeof useTravelFormData>['autosave'];
  autosaveBadge?: string;

  wizard: ReturnType<typeof useTravelWizard>;
  progress: number;
  currentStepMeta: ReturnType<typeof useTravelWizard>['stepConfig'][number] | undefined;

  filters: ReturnType<typeof useTravelFilters>['filters'];
  isFiltersLoading: boolean;

  handleManualSave: ManualSave;
  handleCountrySelect: ReturnType<typeof useTravelFormData>['handleCountrySelect'];
  handleCountryDeselect: ReturnType<typeof useTravelFormData>['handleCountryDeselect'];

  draftRecovery: {
    hasPendingDraft: boolean;
    draftTimestamp: number | null;
    isRecovering: boolean;
    recoverDraft: () => Promise<void>;
    dismissDraft: () => Promise<void>;
  };
}

const AUTOSAVE_BADGES: Record<string, string | undefined> = {
  saving: 'Сохранение...',
  saved: 'Сохранено',
  error: 'Ошибка сохранения',
  debouncing: 'Ожидание...',
};

export function useUpsertTravelController(): UpsertTravelController {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { userId, isAuthenticated, isSuperuser, authReady, logout } = useAuth();
  const colors = useThemedColors();

  const travelId = (id as string | null) ?? null;
  const isNew = !id;
  const stepStorageKey = useMemo(
    () => `metravel_travel_wizard_step_${isNew ? 'new' : String(id)}`,
    [id, isNew]
  );

  const form = useTravelFormData({
    travelId,
    isNew,
    userId,
    isSuperAdmin: isSuperuser,
    isAuthenticated,
    authReady,
    onAuthRequired: async () => {
      // Clear app auth state so header/menu doesn't keep showing a stale user.
      await logout();
    },
  });

  const draft = useDraftRecovery({
    travelId,
    isNew,
    currentData: form.formData,
    enabled: isAuthenticated && !form.isInitialLoading && form.hasAccess && !form.loadError,
  });

  const { saveDraft, clearDraft, recoverDraft } = draft;
  const { setFormData, handleManualSave, getFormData } = form;

  const saveAndClearDraft = useCallback<ManualSave>(
    async (dataOverride, options) => {
      const result = await handleManualSave(dataOverride, options);
      await clearDraft();
      return result;
    },
    [handleManualSave, clearDraft]
  );

  // The wizard only reads `publish`/`moderation` from the save result and
  // never passes arguments, so adapt the richer save signature to its shape.
  const handleWizardSave = useCallback(async (): Promise<{
    publish?: boolean;
    moderation?: boolean;
  } | null> => {
    const result = await saveAndClearDraft();
    return result && typeof result === 'object' ? result : null;
  }, [saveAndClearDraft]);

  const wizard = useTravelWizard({
    totalSteps: 6,
    hasUnsavedChanges: form.autosave.hasUnsavedChanges,
    canSave: form.autosave.canSave,
    onSave: handleWizardSave,
    getFormData,
    stepStorageKey,
  });

  const { filters, isLoading: isFiltersLoading } = useTravelFilters({
    loadOnMount: true,
    currentStep: wizard.currentStep,
  });

  // Persist a draft while the user edits an unsaved form.
  // Skip while a save is in flight or has just succeeded: at that point the data
  // already lives on the server, so re-persisting a draft (especially right after
  // a NEW travel's id-sync flips the draft key from `_new` to `_<id>`) would
  // resurrect a false "unsaved changes" recovery prompt on reload (F-09 / P2).
  useEffect(() => {
    if (!form.formData) return;
    if (!form.formState?.isDirty) return;
    if (!form.hasUserInteracted) return;
    if (form.autosave.status === 'saving' || form.autosave.status === 'saved') return;
    saveDraft(form.formData);
  }, [
    form.formData,
    form.formState?.isDirty,
    form.hasUserInteracted,
    form.autosave.status,
    saveDraft,
  ]);

  // Drop the draft once an autosave succeeds.
  useEffect(() => {
    if (form.autosave.status !== 'saved') return;
    clearDraft();
  }, [form.autosave.status, clearDraft]);

  // After the first successful autosave of a NEW travel the server assigns an id.
  // Reflect it in the URL once, so re-entering this in-progress create flow loads
  // the saved server data instead of an empty form (F-09). Guarded to run a single
  // time and only while the URL still has no id, to avoid navigation loops.
  const didSyncCreatedIdRef = useRef(false);
  useEffect(() => {
    if (!isNew) return;
    if (didSyncCreatedIdRef.current) return;
    const createdId = normalizeTravelId(form.formData?.id);
    if (createdId == null) return;
    didSyncCreatedIdRef.current = true;
    router.setParams({ id: String(createdId) });
  }, [isNew, form.formData?.id, router]);

  const recoverAndApplyDraft = useCallback(async () => {
    const recoveredData = await recoverDraft();
    if (recoveredData) {
      setFormData(recoveredData);
    }
  }, [recoverDraft, setFormData]);

  const draftRecovery = useMemo(
    () => ({
      hasPendingDraft: draft.hasPendingDraft,
      draftTimestamp: draft.draftTimestamp,
      isRecovering: draft.isRecovering,
      recoverDraft: recoverAndApplyDraft,
      dismissDraft: draft.dismissDraft,
    }),
    [
      draft.hasPendingDraft,
      draft.draftTimestamp,
      draft.isRecovering,
      draft.dismissDraft,
      recoverAndApplyDraft,
    ]
  );

  const autosaveBadge = AUTOSAVE_BADGES[form.autosave.status];

  const progress = wizard.currentStep / wizard.totalSteps;

  const currentStepMeta = useMemo(
    () => wizard.stepConfig.find((s) => s.id === wizard.currentStep),
    [wizard.currentStep, wizard.stepConfig]
  );

  return useMemo(
    () => ({
      isNew,
      isInitialLoading: form.isInitialLoading,
      hasAccess: form.hasAccess,
      loadError: form.loadError,
      retryLoad: form.retryLoad,
      isAuthenticated,
      isSuperAdmin: isSuperuser,

      colors,

      formData: form.formData,
      setFormData,
      markers: form.markers,
      setMarkers: form.setMarkers,
      travelDataOld: form.travelDataOld,

      autosave: form.autosave,
      autosaveBadge,

      wizard,
      progress,
      currentStepMeta,

      filters,
      isFiltersLoading,

      handleManualSave: saveAndClearDraft,
      handleCountrySelect: form.handleCountrySelect,
      handleCountryDeselect: form.handleCountryDeselect,

      draftRecovery,
    }),
    [
      isNew,
      form.isInitialLoading,
      form.hasAccess,
      form.loadError,
      form.retryLoad,
      isAuthenticated,
      isSuperuser,
      colors,
      form.formData,
      setFormData,
      form.markers,
      form.setMarkers,
      form.travelDataOld,
      form.autosave,
      autosaveBadge,
      wizard,
      progress,
      currentStepMeta,
      filters,
      isFiltersLoading,
      saveAndClearDraft,
      form.handleCountrySelect,
      form.handleCountryDeselect,
      draftRecovery,
    ]
  );
}
