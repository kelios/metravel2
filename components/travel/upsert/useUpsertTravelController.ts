import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { TravelFormData, TravelPublicationFormat } from '@/types/types';
import { useAuth } from '@/context/AuthContext';
import { useTravelFilters } from '@/hooks/useTravelFilters';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { useTravelWizard } from '@/hooks/useTravelWizard';
import { useThemedColors } from '@/hooks/useTheme';
import { useDraftRecovery } from '@/hooks/useDraftRecovery';
import { checkTravelEditAccess, normalizeTravelId } from '@/utils/travelFormUtils';
import { readTravelModerationMetadata, resolveTravelPublicationStatus } from '@/utils/travelPublicationStatus';
import { formatRelativeTime, translate as i18nT } from '@/i18n'
import {
  buildTravelArticleCreateIntentHref,
  parseTravelArticleCreateIntent,
  resolveInitialPrefill,
  type TravelArticleCreateIntent,
  type TravelArticleInitialPrefill,
} from '@/utils/travelArticleCreateIntent';
import {
  FULL_TOTAL_STEPS,
  NOTE_TOTAL_STEPS,
  parseTravelPublicationMode,
  resolveTravelPublicationFormat,
} from '@/utils/travelNote';

type ManualSave = ReturnType<typeof useTravelFormData>['handleManualSave'];

export interface UpsertTravelController {
  isNew: boolean;
  /** #2666: редактор записи — `note` (два экрана заметки) или `full` (шестишаговый мастер). */
  publicationMode: TravelPublicationFormat;
  isInitialLoading: boolean;
  hasAccess: boolean;
  moderationFeedbackContextKey: string | null;
  loadError: { status: number; message: string } | null;
  retryLoad: () => Promise<void>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  shareTripContext: TravelArticleCreateIntent | null;
  createHref: string;
  shareTripCountryField?: {
    countries: ReturnType<typeof useTravelFilters>['filters']['countries'];
    isLoading: boolean;
  };

  colors: ReturnType<typeof useThemedColors>;

  formData: ReturnType<typeof useTravelFormData>['formData'];
  setFormData: ReturnType<typeof useTravelFormData>['setFormData'];
  markers: ReturnType<typeof useTravelFormData>['markers'];
  setMarkers: ReturnType<typeof useTravelFormData>['setMarkers'];
  travelDataOld: ReturnType<typeof useTravelFormData>['travelDataOld'];

  autosave: ReturnType<typeof useTravelFormData>['autosave'];
  autosaveBadge?: string;
  isManualSaveInFlight: ReturnType<typeof useTravelFormData>['isManualSaveInFlight'];

  wizard: ReturnType<typeof useTravelWizard>;
  progress: number;
  currentStepMeta: ReturnType<typeof useTravelWizard>['stepConfig'][number] | undefined;

  filters: ReturnType<typeof useTravelFilters>['filters'];
  isFiltersLoading: boolean;
  filtersError: ReturnType<typeof useTravelFilters>['error'];
  retryFilters: ReturnType<typeof useTravelFilters>['loadFilters'];

  handleManualSave: ManualSave;
  handleCountrySelect: ReturnType<typeof useTravelFormData>['handleCountrySelect'];
  handleCountryDeselect: ReturnType<typeof useTravelFormData>['handleCountryDeselect'];

  draftRecovery: {
    hasPendingDraft: boolean;
    draftTimestamp: number | null;
    isRecovering: boolean;
    recoverDraft: () => Promise<void>;
    dismissDraft: () => Promise<void>;
    flushDraft: () => Promise<boolean>;
    localSaveError: Error | null;
  };
}

type AutosaveState = ReturnType<typeof useTravelFormData>['autosave'];
type AutosaveBadgeState = Pick<
  AutosaveState,
  'phase' | 'isOnline' | 'hasUnsavedChanges' | 'lastSaved'
>;

export const formatAutosaveLastSaved = (
  savedAt: Date,
  now: number = Date.now(),
): string => {
  // Hermes on the Android release build does not provide
  // Intl.RelativeTimeFormat, and constructing it during the render that flips
  // the badge to `saved` used to throw into TravelFormErrorBoundary. Since
  // #1528 the canonical `formatRelativeTime` carries that guard itself and
  // answers with the same CLDR text, so this call site no longer needs its own
  // check — and the badge now reads identically on Android and on the web.
  const elapsedSeconds = Math.max(0, Math.round((now - savedAt.getTime()) / 1000));
  if (elapsedSeconds < 60) {
    return formatRelativeTime(-elapsedSeconds, 'second');
  }

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return formatRelativeTime(-elapsedMinutes, 'minute');
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  return formatRelativeTime(-elapsedHours, 'hour');
};

export const getAutosaveBadge = (
  autosave: AutosaveBadgeState,
  now: number = Date.now(),
): string => {
  if (autosave.phase === 'error') {
    return i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.error');
  }
  if (autosave.phase === 'saving') {
    return i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.saving');
  }
  if (!autosave.isOnline && autosave.hasUnsavedChanges) {
    return i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.offline');
  }
  if (autosave.phase === 'pending') {
    return i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.pending');
  }
  if (autosave.phase === 'saved') {
    return autosave.lastSaved
      ? i18nT(
          'travel:components.travel.upsert.useUpsertTravelController.autosave.savedAt',
          { value1: formatAutosaveLastSaved(autosave.lastSaved, now) },
        )
      : i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.saved');
  }
  return i18nT('travel:components.travel.upsert.useUpsertTravelController.autosave.idle');
};

export function useUpsertTravelController(): UpsertTravelController {
  const searchParams = useLocalSearchParams();
  const { id } = searchParams;
  const router = useRouter();
  const { userId, isAuthenticated, isSuperuser, authReady, logout } = useAuth();
  const colors = useThemedColors();

  const travelId = (id as string | null) ?? null;
  const isNew = !id;
  const shareTripContext = useRef(isNew ? parseTravelArticleCreateIntent(searchParams) : null).current;
  // Режим создания читается из URL один раз: после первого сохранения формат
  // записи приходит с сервера и остаётся единственным источником.
  const requestedPublicationMode = useRef(isNew ? parseTravelPublicationMode(searchParams) : 'full').current;
  const createHref = useMemo(
    () => buildTravelArticleCreateIntentHref(shareTripContext, requestedPublicationMode),
    [requestedPublicationMode, shareTripContext],
  );
  const [articlePrefill, setArticlePrefill] = useState<{
    pending: boolean;
    value: TravelArticleInitialPrefill | null;
  }>(() => ({ pending: Boolean(shareTripContext), value: null }));
  // Новая заметка хранит свой шаг отдельно: иначе брошенный на шаге 2+ полный мастер
  // открывал бы свежую заметку сразу на «Месте и рассказе», минуя «Фото».
  const newStepKey = requestedPublicationMode === 'note' ? 'new_note' : 'new';
  const stepStorageKey = useMemo(
    () => isNew && shareTripContext
      ? undefined : `metravel_travel_wizard_step_${isNew ? newStepKey : String(id)}`,
    [id, isNew, newStepKey, shareTripContext]
  );

  const form = useTravelFormData({
    travelId,
    isNew,
    userId,
    isSuperAdmin: isSuperuser,
    isAuthenticated,
    authReady,
    initialPrefill: articlePrefill.value,
    prefillPending: articlePrefill.pending,
    initialPublicationFormat: requestedPublicationMode,
    onAuthRequired: async () => {
      // Clear app auth state so header/menu doesn't keep showing a stale user.
      await logout();
    },
  });

  // Access/loading state can still belong to the previous route or viewer until
  // its load effect runs. Private feedback requires this render's trusted record.
  const routeTravelId = normalizeTravelId(travelId);
  const moderationFeedbackContextKey = authReady && isAuthenticated && userId && !isNew &&
    routeTravelId != null && form.travelDataOld &&
    normalizeTravelId(form.travelDataOld.id) === routeTravelId &&
    normalizeTravelId(form.formData.id) === routeTravelId &&
    checkTravelEditAccess(form.travelDataOld, userId, isSuperuser)
    ? `${routeTravelId}:${userId}` : null;

  const [autosaveClock, setAutosaveClock] = useState(() => Date.now());
  useEffect(() => {
    if (form.autosave.phase !== 'saved' || !form.autosave.lastSaved) return;

    setAutosaveClock(Date.now());
    const interval = setInterval(() => setAutosaveClock(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [form.autosave.lastSaved, form.autosave.phase]);

  const draft = useDraftRecovery({
    travelId,
    isNew,
    currentData: form.formData,
    enabled: isAuthenticated && !form.isInitialLoading && form.hasAccess && !form.loadError,
    newDraftKind: requestedPublicationMode === 'note' ? 'note' : undefined,
  });

  const { saveDraft, clearDraft, recoverDraft, flushDraft } = draft;
  const { setFormData, setMarkers, handleManualSave, getFormData } = form;

  const saveAndClearDraft = useCallback<ManualSave>(
    async (dataOverride, options) => {
      const result = await handleManualSave(dataOverride, options);

      // `undefined` means no save happened - the author declined the rich-text
      // loss confirmation, which is a clean no-op that leaves the form untouched.
      // Clearing there would delete a draft holding still-unconfirmed edits.
      if (result === undefined) return result;

      // Settled synchronously, before returning: this flow navigates the moment
      // it resolves (`router.replace` in useTravelPublishModeration, deliberately,
      // "чтобы мастер точно размонтировался"), and a passive effect on an
      // unmounted subtree never runs - so deferring the decision to the next
      // render leaves the draft behind and reopens the recovery dialog.
      // Both operands are already final in refs here: applySavedData has set
      // formDataRef to the saved data and pushed the baseline through
      // updateBaseline. Asked as a ref read rather than the render-time value,
      // which is still the pre-save one at this point.
      if (form.autosave.getHasUnsavedChanges(getFormData())) {
        // The save confirmed its own payload, not what was typed while it was in
        // flight. Those keystrokes live only in the draft, and nothing
        // reschedules them: leaving the screen tears the autosave down too.
        await flushDraft();
      } else {
        await clearDraft();
      }
      return result;
    },
    [handleManualSave, getFormData, flushDraft, clearDraft, form.autosave]
  );

  // Adapt the save signature while preserving canonical state for wizard cleanup.
  const handleWizardSave = useCallback(async (): Promise<TravelFormData | null> => {
    const result = await saveAndClearDraft();
    return result && typeof result === 'object' ? result : null;
  }, [saveAndClearDraft]);

  // Одобряет и отклоняет модератор только в шаге публикации полного мастера, поэтому
  // чужую существующую заметку суперадмин открывает там; автор — в двух экранах.
  const publicationMode: TravelPublicationFormat =
    resolveTravelPublicationFormat(form.formData) === 'note' &&
    (requestedPublicationMode === 'note' || !isSuperuser) ? 'note' : 'full';
  const wizard = useTravelWizard({
    totalSteps: publicationMode === 'note' ? NOTE_TOTAL_STEPS : FULL_TOTAL_STEPS,
    hasUnsavedChanges: form.autosave.hasUnsavedChanges,
    canSave: form.autosave.canSave,
    onSave: handleWizardSave,
    getFormData,
    stepStorageKey,
  });

  const { filters, isLoading: isFiltersLoading, error: filtersError, loadFilters: retryFilters } = useTravelFilters({
    loadOnMount: true,
    currentStep: wizard.currentStep,
  });

  useEffect(() => {
    if (!isNew || !shareTripContext || !articlePrefill.pending || isFiltersLoading) return;
    // Only the first catalog result participates in initialization. A retry or
    // locale refresh must not overwrite a choice, a recovered draft, or typing.
    setArticlePrefill({ pending: false, value: resolveInitialPrefill(shareTripContext, filters.countries) });
  }, [articlePrefill.pending, filters.countries, isFiltersLoading, isNew, shareTripContext]);

  const shareTripCountryField = useMemo(() => shareTripContext
    ? { countries: filters.countries, isLoading: isFiltersLoading } : undefined,
  [filters.countries, isFiltersLoading, shareTripContext]);

  // Persist a draft while the user has edits the server has not confirmed.
  // The gate is `hasUnsavedChanges`, not the request status: a save that is in
  // flight is exactly when the local copy is the only copy. Autosave no longer
  // aborts itself, so a heavy article stays in `saving` for the full 11-12s of
  // the upsert, and everything typed in that window is newer than the payload
  // already sent (the engine deliberately keeps its latest snapshot ahead of the
  // confirmed baseline). Skipping the draft for the whole flight left those
  // edits only in component state, so leaving the screen dropped them.
  // Nothing to persist once the server has confirmed the current data, which is
  // what kept a NEW travel's id-sync (`_new` -> `_<id>`) from resurrecting a
  // false "unsaved changes" prompt on reload (F-09 / P2); the stale draft under
  // the old key is dropped by the key-flip cleanup in useDraftRecovery.
  useEffect(() => {
    if (!form.formData) return;
    if (!form.formState?.isDirty) return;
    if (!form.hasUserInteracted) return;
    if (!form.autosave.hasUnsavedChanges) return;
    saveDraft(form.formData);
  }, [
    form.formData,
    form.formState?.isDirty,
    form.hasUserInteracted,
    form.autosave.hasUnsavedChanges,
    saveDraft,
  ]);

  // Drop the draft once an autosave succeeds - but only when it confirmed
  // everything the author has. A save that started before the last keystrokes
  // confirms its own payload, not those keystrokes; clearing on the status alone
  // wiped the only local copy of edits that were still unsent.
  useEffect(() => {
    if (form.autosave.status !== 'saved') return;
    if (form.autosave.hasUnsavedChanges) return;
    clearDraft();
  }, [form.autosave.status, form.autosave.hasUnsavedChanges, clearDraft]);

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
      const currentData = getFormData();
      // A local content snapshot cannot undo a confirmed moderation transition.
      // Read after storage resolves, since a save may have completed meanwhile.
      const dataForCurrentRoute = {
        ...recoveredData,
        ...readTravelModerationMetadata(currentData),
        ...(isNew && normalizeTravelId(recoveredData.id) != null ? { id: null } : {}),
        publication_status: currentData.publication_status !== undefined
          ? currentData.publication_status
          : resolveTravelPublicationStatus(currentData),
      };
      const recoveredMarkers = Array.isArray(dataForCurrentRoute.coordsMeTravel)
        ? dataForCurrentRoute.coordsMeTravel
        : [];

      setFormData(dataForCurrentRoute);
      setMarkers(recoveredMarkers);
    }
  }, [isNew, recoverDraft, setFormData, setMarkers, getFormData]);

  const draftRecovery = useMemo(
    () => ({
      hasPendingDraft: draft.hasPendingDraft,
      draftTimestamp: draft.draftTimestamp,
      isRecovering: draft.isRecovering,
      recoverDraft: recoverAndApplyDraft,
      dismissDraft: draft.dismissDraft,
      flushDraft: draft.flushDraft,
      localSaveError: draft.storageError,
    }),
    [
      draft.hasPendingDraft,
      draft.draftTimestamp,
      draft.isRecovering,
      draft.dismissDraft,
      draft.flushDraft,
      draft.storageError,
      recoverAndApplyDraft,
    ]
  );

  const autosaveBadge = getAutosaveBadge(form.autosave, autosaveClock);

  const progress = wizard.currentStep / wizard.totalSteps;

  const currentStepMeta = useMemo(
    () => wizard.stepConfig.find((s) => s.id === wizard.currentStep),
    [wizard.currentStep, wizard.stepConfig]
  );

  return useMemo(
    () => ({
      isNew,
      publicationMode,
      isInitialLoading: form.isInitialLoading,
      hasAccess: form.hasAccess,
      moderationFeedbackContextKey,
      loadError: form.loadError,
      retryLoad: form.retryLoad,
      isAuthenticated,
      isSuperAdmin: isSuperuser,
      shareTripContext,
      createHref,
      shareTripCountryField,

      colors,

      formData: form.formData,
      setFormData,
      markers: form.markers,
      setMarkers: form.setMarkers,
      travelDataOld: form.travelDataOld,

      autosave: form.autosave,
      autosaveBadge,
      isManualSaveInFlight: form.isManualSaveInFlight,

      wizard,
      progress,
      currentStepMeta,

      filters,
      isFiltersLoading,
      filtersError,
      retryFilters,

      handleManualSave: saveAndClearDraft,
      handleCountrySelect: form.handleCountrySelect,
      handleCountryDeselect: form.handleCountryDeselect,

      draftRecovery,
    }),
    [
      isNew,
      publicationMode,
      shareTripContext,
      createHref,
      shareTripCountryField,
      form.isInitialLoading,
      form.hasAccess,
      moderationFeedbackContextKey,
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
      form.isManualSaveInFlight,
      wizard,
      progress,
      currentStepMeta,
      filters,
      isFiltersLoading,
      filtersError,
      retryFilters,
      saveAndClearDraft,
      form.handleCountrySelect,
      form.handleCountryDeselect,
      draftRecovery,
    ]
  );
}
