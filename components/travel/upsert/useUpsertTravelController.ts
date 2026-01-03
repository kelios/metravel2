import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useTravelFilters } from '@/hooks/useTravelFilters';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { useTravelWizard } from '@/hooks/useTravelWizard';
import { useThemedColors } from '@/hooks/useTheme';

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
}

export function useUpsertTravelController(): UpsertTravelController {
  const { id } = useLocalSearchParams();
  const { userId, isAuthenticated, isSuperuser, authReady } = useAuth();
  const colors = useThemedColors();

  const isNew = !id;

  const form = useTravelFormData({
    travelId: id as string | null,
    isNew,
    userId,
    isSuperAdmin: isSuperuser,
    isAuthenticated,
    authReady,
  });

  const wizard = useTravelWizard({
    totalSteps: 6,
    hasUnsavedChanges: form.autosave.hasUnsavedChanges,
    canSave: form.autosave.canSave,
    onSave: form.handleManualSave,
  });

  const { filters, isLoading: isFiltersLoading } = useTravelFilters({
    loadOnMount: true,
    currentStep: wizard.currentStep,
  });

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

    handleManualSave: form.handleManualSave,
    handleCountrySelect: form.handleCountrySelect,
    handleCountryDeselect: form.handleCountryDeselect,
  };
}
