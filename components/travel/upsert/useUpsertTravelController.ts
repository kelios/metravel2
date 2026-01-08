import { useMemo, useEffect, useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useTravelFilters } from '@/hooks/useTravelFilters';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { useTravelWizard } from '@/hooks/useTravelWizard';
import { useThemedColors } from '@/hooks/useTheme';
import { useDraftRecovery } from '@/hooks/useDraftRecovery';

export interface UpsertTravelController {
  isNew: boolean;
  isInitialLoading: boolean;
  hasAccess: boolean;
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

  handleManualSave: ReturnType<typeof useTravelFormData>['handleManualSave'];
  handleCountrySelect: ReturnType<typeof useTravelFormData>['handleCountrySelect'];
  handleCountryDeselect: ReturnType<typeof useTravelFormData>['handleCountryDeselect'];

  // Draft recovery for unsaved changes
  draftRecovery: {
    hasPendingDraft: boolean;
    draftTimestamp: number | null;
    isRecovering: boolean;
    recoverDraft: () => Promise<void>;
    dismissDraft: () => Promise<void>;
  };
}

export function useUpsertTravelController(): UpsertTravelController {
  const { id } = useLocalSearchParams();
  const { userId, isAuthenticated, isSuperuser, authReady } = useAuth();
  const colors = useThemedColors();

  const isNew = !id;
  const stepStorageKey = useMemo(
    () => `metravel_travel_wizard_step_${isNew ? 'new' : String(id)}`,
    [id, isNew]
  );

  const form = useTravelFormData({
    travelId: id as string | null,
    isNew,
    userId,
    isSuperAdmin: isSuperuser,
    isAuthenticated,
    authReady,
  });

  // Draft recovery for unsaved changes
  const draftRecoveryHook = useDraftRecovery({
    travelId: id as string | null,
    isNew,
    currentData: form.formData,
    enabled: isAuthenticated && !form.isInitialLoading,
  });

  const saveDraft = draftRecoveryHook.saveDraft;
  const clearDraft = draftRecoveryHook.clearDraft;

  const handleManualSaveWithDraftClear = useCallback(
    async (...args: any[]) => {
      const result = await (form.handleManualSave as any)(...args);
      if (clearDraft) {
        await clearDraft();
      }
      return result;
    },
    [form.handleManualSave, clearDraft]
  );

  const wizard = useTravelWizard({
    totalSteps: 6,
    hasUnsavedChanges: form.autosave.hasUnsavedChanges,
    canSave: form.autosave.canSave,
    onSave: handleManualSaveWithDraftClear,
    stepStorageKey,
  });

  const { filters, isLoading: isFiltersLoading } = useTravelFilters({
    loadOnMount: true,
    currentStep: wizard.currentStep,
  });

  // Auto-save draft on form changes
  useEffect(() => {
    if (!form.formData) return;
    if (!saveDraft) return;
    if (!form.formState?.isDirty) return;
    if (!form.hasUserInteracted) return;
    saveDraft(form.formData);
  }, [form.formData, form.formState?.isDirty, form.hasUserInteracted, saveDraft]);

  // Clear draft after successful save
  useEffect(() => {
    if (form.autosave.status !== 'saved') return;
    if (!clearDraft) return;
    clearDraft();
  }, [form.autosave.status, clearDraft]);

  // Handle draft recovery
  const handleRecoverDraft = useCallback(async () => {
    const recoveredData = await draftRecoveryHook.recoverDraft();
    if (recoveredData) {
      form.setFormData(recoveredData);
    }
  }, [draftRecoveryHook, form]);

  const draftRecovery = useMemo(() => ({
    hasPendingDraft: draftRecoveryHook.hasPendingDraft,
    draftTimestamp: draftRecoveryHook.draftTimestamp,
    isRecovering: draftRecoveryHook.isRecovering,
    recoverDraft: handleRecoverDraft,
    dismissDraft: draftRecoveryHook.dismissDraft,
  }), [draftRecoveryHook, handleRecoverDraft]);

  const autosaveBadge = useMemo(() => {
    switch (form.autosave.status) {
      case 'saving':
        return 'Сохранение...';
      case 'saved':
        return 'Сохранено';
      case 'error':
        return 'Ошибка сохранения';
      case 'debouncing':
        return 'Ожидание...';
      default:
        return undefined;
    }
  }, [form.autosave.status]);

  const progress = useMemo(() => {
    return wizard.currentStep / wizard.totalSteps;
  }, [wizard.currentStep, wizard.totalSteps]);

  const currentStepMeta = useMemo(() => {
    return wizard.stepConfig.find(s => s.id === wizard.currentStep);
  }, [wizard.currentStep, wizard.stepConfig]);

  return {
    isNew,
    isInitialLoading: form.isInitialLoading,
    hasAccess: form.hasAccess,
    isAuthenticated,
    isSuperAdmin: isSuperuser,

    colors,

    formData: form.formData,
    setFormData: form.setFormData,
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

    handleManualSave: handleManualSaveWithDraftClear,
    handleCountrySelect: form.handleCountrySelect,
    handleCountryDeselect: form.handleCountryDeselect,

    draftRecovery,
  };
}
