import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import isEqual from 'fast-deep-equal';
import { type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { saveFormData } from '@/api/misc';
import { ApiError } from '@/api/client';
import { TravelFormData, MarkerData } from '@/types/types';
import { useFormState } from '@/hooks/useFormState';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';
import {
  getEmptyFormData,
  syncCountriesFromMarkers,
  cleanEmptyFields,
  normalizeTravelId,
  stripMarkerCoverFallbacks,
} from '@/utils/travelFormUtils';
import {
  mergeMarkersPreserveImages,
  ensureRequiredDraftFields,
  normalizeDraftPlaceholders,
  keepCurrentField,
  normalizeNullableStrings,
  normalizeMarkersForSave,
  normalizeGalleryForSave,
  normalizeGalleryImageIdsForSave,
  sanitizeCoverUrl,
  filterAllowedKeys,
  mergeOverridePreservingUserInput,
} from '@/utils/travelFormNormalization';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { applySmartImageLayout } from '@/utils/richTextImageLayout';
import { showToastMessage } from '@/utils/toast';
import { getErrorMessage, getErrorName } from '@/utils/errorHelpers';

type ToastAwareError = Error & { toastShown?: boolean };
const DEFAULT_MARKER_SERIALIZER_FALLBACK_IMAGE = '/og-default.png';

type MonitoringWindow = Window & {
  Sentry?: {
    captureException: (error: unknown, context?: Record<string, unknown>) => void;
  };
};

async function invalidateTravelCollections(
  queryClient: QueryClient | null | undefined,
  userId: string | null,
) {
  if (!queryClient?.invalidateQueries) return;

  await queryClient.invalidateQueries({ queryKey: queryKeys.travels(), refetchType: 'all' });

  if (!userId) return;

  await queryClient.invalidateQueries({ queryKey: queryKeys.myTravelsCount(userId), refetchType: 'all' });
  await queryClient.invalidateQueries({ queryKey: queryKeys.exportMyTravelsCount(userId), refetchType: 'all' });
}

async function invalidateTravelDetails(
  queryClient: QueryClient | null | undefined,
  ...travelKeys: Array<string | number | null | undefined>
) {
  if (!queryClient?.invalidateQueries) return;

  const uniqueKeys = Array.from(
    new Set(
      travelKeys
        .map((key) => (key == null ? '' : String(key).trim()))
        .filter(Boolean),
    ),
  );

  await Promise.all(
    uniqueKeys.map((key) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.travel(Number.isFinite(Number(key)) ? Number(key) : key) }),
    ),
  );
}

interface UseTravelFormPersistenceParams {
  formState: ReturnType<typeof useFormState<TravelFormData>>;
  initialFormData: TravelFormData;
  stableTravelId: number | null;
  queryClient: QueryClient | null | undefined;
  userId: string | null;
  isAuthenticated: boolean;
  hasAccess: boolean;
  isManualSaveInFlight: boolean;
  setIsManualSaveInFlight: (value: boolean) => void;
  setMarkers: (markers: MarkerData[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  formDataRef: MutableRefObject<TravelFormData>;
  saveAbortControllerRef: MutableRefObject<AbortController | null>;
  mountedRef: MutableRefObject<boolean>;
  manualSaveInFlightRef: MutableRefObject<boolean>;
  manualSavePromiseRef: MutableRefObject<Promise<TravelFormData | void> | null>;
  suppressAutosaveErrorToastRef: MutableRefObject<boolean>;
  pendingBaselineRef: MutableRefObject<TravelFormData | null>;
  didInvalidateAfterCreateRef: MutableRefObject<boolean>;
  updateBaselineRef: MutableRefObject<((data: TravelFormData) => void) | null>;
  rehydrateMarkerIdsFromServer: (
    travelId: number | null,
    markers: MarkerData[],
  ) => Promise<MarkerData[] | null | undefined>;
  uploadPendingMarkerImages: (markers: MarkerData[]) => Promise<void>;
}

export function useTravelFormPersistence(params: UseTravelFormPersistenceParams) {
  const {
    formState,
    initialFormData,
    stableTravelId,
    queryClient,
    userId,
    isAuthenticated,
    hasAccess,
    isManualSaveInFlight,
    setIsManualSaveInFlight,
    setMarkers,
    showToast,
    formDataRef,
    saveAbortControllerRef,
    mountedRef,
    manualSaveInFlightRef,
    manualSavePromiseRef,
    suppressAutosaveErrorToastRef,
    pendingBaselineRef,
    didInvalidateAfterCreateRef,
    updateBaselineRef,
    rehydrateMarkerIdsFromServer,
    uploadPendingMarkerImages,
  } = params;

  // Каждый вызов applySavedData увеличивает epoch. Асинхронный rehydrate из
  // более старого вызова не должен затирать state/baseline, выставленные более
  // новым applySavedData (или последующими правками пользователя).
  const applyEpochRef = useRef(0);

  // Стабильная ссылка на autosave.cancelPending, чтобы handleManualSave не
  // пересоздавался на каждый тик статуса автосейва.
  const autosaveCancelPendingRef = useRef<(() => void) | null>(null);

  const cleanAndSave = useCallback(async (
    data: TravelFormData,
    options?: { autosave?: boolean; intent?: 'autosave' | 'save' | 'publish' },
    externalSignal?: AbortSignal,
  ) => {
    // ✅ FIX: Отменяем предыдущий запрос для предотвращения race condition
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }

    // Создаём новый контроллер для этого запроса
    const abortController = new AbortController();
    saveAbortControllerRef.current = abortController;

    // Связываем внешний signal (от автосейва: cancelPending/unmount) с внутренним,
    // чтобы отмена реально прерывала in-flight saveFormData-запрос.
    const onExternalAbort = () => abortController.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        abortController.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort);
      }
    }

    try {
      const baseFormData = getEmptyFormData(data?.id ? String(data.id) : null);
      const mergedData = normalizeNullableStrings({
        ...baseFormData,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
      } as TravelFormData);

      const normalizedGallery = normalizeGalleryForSave(mergedData.gallery);
      const normalizedGalleryIds = normalizeGalleryImageIdsForSave(normalizedGallery);
      const markerFallbackImage =
        sanitizeCoverUrl(mergedData.travel_image_thumb_url) ??
        ((normalizedGallery?.[0] as Record<string, unknown> | undefined)?.url as string | undefined) ??
        normalizeMediaUrl(DEFAULT_MARKER_SERIALIZER_FALLBACK_IMAGE);
      const normalizedMarkers = normalizeMarkersForSave(
        mergedData.coordsMeTravel as Record<string, unknown>[],
        markerFallbackImage,
      );
      const resolvedId = normalizeTravelId(mergedData.id) ?? stableTravelId ?? null;

      // Apply smart image layout to description before saving
      const formattedDescription = mergedData.description
        ? applySmartImageLayout(mergedData.description)
        : mergedData.description;

      const cleanedData = cleanEmptyFields({
        ...mergedData,
        id: resolvedId,
        description: formattedDescription,
        coordsMeTravel: normalizedMarkers,
        ...(normalizedGallery ? { gallery: normalizedGallery } : {}),
        // IMPORTANT: use independent array instances for each field.
        // saveFormData sanitization uses cycle-protection and can drop duplicated object refs.
        thumbs200ForCollectionArr: [...normalizedGalleryIds],
        travelImageThumbUrlArr: [...normalizedGalleryIds],
        // Backend compatibility: some deployments still validate the legacy typo field.
        travelImageThumbUrArr: [...normalizedGalleryIds],
        travelImageAddress: [...normalizedGalleryIds],
        travel_image_thumb_url: sanitizeCoverUrl(mergedData.travel_image_thumb_url),
        travel_image_thumb_small_url: sanitizeCoverUrl(mergedData.travel_image_thumb_small_url),
      });

      const filteredCleanedData = filterAllowedKeys(cleanedData, Object.keys(baseFormData));
      const payload = ensureRequiredDraftFields(filteredCleanedData as unknown as TravelFormData);

      // ✅ FIX: Проверяем, что компонент всё ещё смонтирован перед сохранением
      if (!mountedRef.current) {
        throw new Error('Component unmounted');
      }

      const result = await saveFormData(payload, abortController.signal, options);

      // ✅ FIX: Проверяем, что запрос не был отменён
      if (abortController.signal.aborted) {
        throw new Error('Request aborted');
      }

      void invalidateTravelDetails(
        queryClient,
        resolvedId,
        result?.id,
        result?.slug,
        mergedData.slug,
      );

      return result;
    } catch (error) {
      const isAbort = abortController.signal.aborted || getErrorName(error) === 'AbortError';
      if (isAbort) {
        // Нормализуем отмену, чтобы выше по цепочке можно было её корректно игнорировать.
        throw new Error('Request aborted');
      }
      throw error;
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      // Очищаем ссылку только если это наш контроллер
      if (saveAbortControllerRef.current === abortController) {
        saveAbortControllerRef.current = null;
      }
    }
  }, [queryClient, stableTravelId, mountedRef, saveAbortControllerRef]);

  const applySavedData = useCallback(
    (
      savedData: TravelFormData,
      sourceData?: TravelFormData,
      options?: { preserveEditingState?: boolean }
    ) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      const epoch = ++applyEpochRef.current;

      const normalizedSavedData = normalizeDraftPlaceholders(savedData);
      const currentDataSnapshot =
        (sourceData as TravelFormData | undefined) ??
        (formDataRef.current as TravelFormData) ??
        (formState.data as TravelFormData);
      const hadId = normalizeTravelId(currentDataSnapshot.id) != null;
      const hasId = normalizeTravelId(normalizedSavedData.id) != null;

      // If backend returns placeholders/empty strings for rich text fields, don't wipe user input.
      const kf = (key: keyof TravelFormData, mode: Parameters<typeof keepCurrentField>[3]) =>
        keepCurrentField(normalizedSavedData, currentDataSnapshot, key, mode);

      const assignCurrentEditableField = <K extends 'name' | 'description' | 'plus' | 'minus' | 'recommendation' | 'youtube_link'>(key: K) => {
        normalizedSavedData[key] = currentDataSnapshot[key];
      };

      (['description', 'plus', 'minus', 'recommendation', 'youtube_link'] as const).forEach(k => {
        kf(k, 'emptyString');
        kf(k, 'nil');
      });
      kf('name', 'nil');
      kf('name', 'emptyString');

      if (options?.preserveEditingState) {
        (['name', 'description', 'plus', 'minus', 'recommendation', 'youtube_link'] as const).forEach(assignCurrentEditableField);
      }

      // If backend returns empty arrays for filter fields, don't wipe user selections.
      (['categories', 'transports', 'complexity', 'companions', 'over_nights_stay', 'month'] as const).forEach(k => {
        kf(k, 'emptyArray');
      });

      // Preserve local preview images for cover/gallery while server hasn't produced permanent URLs yet.
      kf('travel_image_thumb_url', 'missingImageUrl');
      kf('travel_image_thumb_small_url', 'missingImageUrl');

      // If user explicitly deleted cover (set to null) but server returned old URL, keep null.
      if (currentDataSnapshot.travel_image_thumb_url == null && normalizedSavedData.travel_image_thumb_url != null) {
        normalizedSavedData.travel_image_thumb_url = null;
      }
      if (currentDataSnapshot.travel_image_thumb_small_url == null && normalizedSavedData.travel_image_thumb_small_url != null) {
        normalizedSavedData.travel_image_thumb_small_url = null;
      }

      kf('gallery', 'emptyArray');
      kf('gallery', 'nilArray');

      const markersFromResponse = Array.isArray(normalizedSavedData.coordsMeTravel)
        ? (normalizedSavedData.coordsMeTravel as MarkerData[])
        : [];
      const currentMarkers = Array.isArray(currentDataSnapshot.coordsMeTravel)
        ? (currentDataSnapshot.coordsMeTravel as MarkerData[])
        : [];
      // Если бэкенд не вернул точки (например, черновик без coords в ответе), сохраняем локальные маркеры.
      const effectiveMarkersRaw = markersFromResponse.length > 0
        ? mergeMarkersPreserveImages(markersFromResponse, currentMarkers)
        : currentMarkers;
      const effectiveMarkers = stripMarkerCoverFallbacks(
        effectiveMarkersRaw as MarkerData[],
        [
          normalizedSavedData.travel_image_thumb_url ?? null,
          normalizedSavedData.travel_image_thumb_small_url ?? null,
        ],
      );
      const syncedCountries = syncCountriesFromMarkers(effectiveMarkers, normalizedSavedData.countries || []);

      const finalData = {
        ...normalizedSavedData,
        countries: syncedCountries,
        coordsMeTravel: effectiveMarkers,
      };

      const shouldSkipFormReset =
        options?.preserveEditingState === true &&
        hadId &&
        hasId &&
        isEqual(finalData, currentDataSnapshot);

      if (shouldSkipFormReset) {
        formDataRef.current = currentDataSnapshot;
        updateBaselineRef.current?.(currentDataSnapshot);
      } else {
        pendingBaselineRef.current = finalData;
        try {
          formState.reset(finalData);
          formDataRef.current = finalData as TravelFormData;
          setMarkers(effectiveMarkers);
          updateBaselineRef.current?.(finalData);
        } finally {
          pendingBaselineRef.current = null;
        }
      }

      const travelIdForRefresh = normalizeTravelId(finalData.id) ?? stableTravelId;
      void (async () => {
        let markersForUpload = effectiveMarkers as MarkerData[];
        const refreshedMarkers = await rehydrateMarkerIdsFromServer(travelIdForRefresh, effectiveMarkers as MarkerData[]);
        // Пользователь мог уйти со страницы во время долгого rehydrate-запроса —
        // не трогаем state/ref размонтированного компонента.
        if (!mountedRef.current) return;
        // Более новый applySavedData (или правки пользователя) уже выставил state —
        // медленный rehydrate из устаревшего вызова не должен их затирать.
        if (epoch !== applyEpochRef.current) return;
        if (refreshedMarkers && refreshedMarkers.length > 0) {
          // Keep the refreshed marker ids in form state before attempting upload.
          // Without this step the point can stay "id-less" locally and the pending
          // point photo never leaves the blob preview state.
          markersForUpload = refreshedMarkers;
          const refreshedData = {
            ...(formDataRef.current as TravelFormData),
            coordsMeTravel: refreshedMarkers as unknown as TravelFormData['coordsMeTravel'],
          };
          formDataRef.current = refreshedData;
          setMarkers(refreshedMarkers);
          formState.updateField('coordsMeTravel', refreshedMarkers);
          updateBaselineRef.current?.(refreshedData);
        }
        await uploadPendingMarkerImages(markersForUpload);
      })();

      // When a new travel is created and receives an id, invalidate "travels" lists
      // so "Мои путешествия" can show the new draft without a hard refresh.
      if (!hadId && hasId && !didInvalidateAfterCreateRef.current) {
        didInvalidateAfterCreateRef.current = true;
        void invalidateTravelCollections(queryClient, userId);
      }
    },
    [
      formState,
      queryClient,
      rehydrateMarkerIdsFromServer,
      stableTravelId,
      uploadPendingMarkerImages,
      userId,
      didInvalidateAfterCreateRef,
      formDataRef,
      mountedRef,
      pendingBaselineRef,
      setMarkers,
      updateBaselineRef,
    ]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      // После первого автосейва создаётся id — остаёмся в мастере и просто подставляем новые данные.
      applySavedData(savedData, formDataRef.current, { preserveEditingState: true });
    },
    [applySavedData, formDataRef, mountedRef]
  );

  const handleSaveError = useCallback(
    (error: Error) => {
      // ✅ FIX: Проверяем монтирование перед показом уведомления
      if (!mountedRef.current) return;

      // Если пользователь только что завершил "терминальное" действие (например, отправка на модерацию)
      // и сразу ушёл со страницы, то возможные ошибки автосейва не должны всплывать на экранах списка.
      if (suppressAutosaveErrorToastRef.current) {
        return;
      }

      // Отмена запроса — ожидаемое поведение (например, при уходе со страницы).
      if (error.message === 'Request aborted') {
        return;
      }

      // ✅ FIX: Подробное логирование для мониторинга.
      // Снапшот только для лога — читаем из ref, чтобы не пересоздавать колбэк
      // (и onError автосейва) на каждое изменение формы.
      const snapshot = formDataRef.current;
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        travelId: stableTravelId,
        timestamp: new Date().toISOString(),
        formDataSnapshot: {
          id: snapshot.id,
          name: snapshot.name,
          hasMarkers: Array.isArray(snapshot.coordsMeTravel) && snapshot.coordsMeTravel.length > 0,
        }
      };

      console.error('Autosave error (detailed):', errorDetails);

      // В продакшене можно отправить в систему мониторинга (Sentry, LogRocket и т.д.)
      const sentryWindow = typeof window !== 'undefined' ? (window as MonitoringWindow) : undefined;
      if (sentryWindow?.Sentry) {
        sentryWindow.Sentry.captureException(error, {
          tags: { component: 'useTravelFormData', action: 'autosave' },
          extra: errorDetails,
        });
      }

      showToast('Ошибка автосохранения', 'error');
    },
    [showToast, stableTravelId, formDataRef, mountedRef, suppressAutosaveErrorToastRef]
  );

  const autosave = useImprovedAutoSave(formState.data, initialFormData, {
    debounce: 5000,
    onSave: async (dataToSave, signal) => {
      // Avoid racing autosave requests while a manual save is in progress.
      if (manualSaveInFlightRef.current) {
        throw new Error('Request aborted');
      }
      return await cleanAndSave(dataToSave as TravelFormData, { autosave: true }, signal);
    },
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    // Не автосейвим, когда travel уже в "терминальном" состоянии (moderation/publish),
    // иначе получаем повторные upsert и 400 на обязательные поля.
    enabled:
      isAuthenticated &&
      hasAccess &&
      !isManualSaveInFlight &&
      !formState.data.moderation &&
      !formState.data.publish,
  });

  const handleManualSave = useCallback(async (dataOverride?: TravelFormData) => {
    if (manualSavePromiseRef.current) {
      return manualSavePromiseRef.current;
    }

    manualSaveInFlightRef.current = true;
    setIsManualSaveInFlight(true);
    const promise = (async () => {
      try {
        // Если пользователь меняет статус на "отправить на модерацию" / "опубликовать",
        // то после успешного сохранения он уходит со страницы, и тосты автосейва больше не нужны.
        const wantsToLeaveSoon = Boolean(dataOverride?.publish) || Boolean(dataOverride?.moderation);
        if (wantsToLeaveSoon) {
          suppressAutosaveErrorToastRef.current = true;
        }

        // Отменяем отложенный автосейв, чтобы не отправить старые данные (publish=false) после ручного сохранения.
        autosaveCancelPendingRef.current?.();
        // Abort any in-flight autosave request (it will still appear in Network, but won't win the race).
        if (saveAbortControllerRef.current) {
          saveAbortControllerRef.current.abort();
        }

        const toSave = dataOverride
          ? mergeOverridePreservingUserInput(
              (formDataRef.current as TravelFormData) ?? ({} as TravelFormData),
              dataOverride,
            )
          : formDataRef.current as TravelFormData;
        formDataRef.current = toSave as TravelFormData;
        // Явная публикация/отправка на модерацию (пользователь нажал кнопку в шаге
        // публикации, поэтому dataOverride выставляет publish/moderation) проходит
        // серверную модерационную валидацию. Любое другое ручное/фоновое сохранение
        // (в т.ч. инкрементальный сейв точки уже опубликованной поездки, тикет #505)
        // лишь персистит текущее состояние без блокирующей проверки полноты.
        const intent: 'save' | 'publish' = wantsToLeaveSoon ? 'publish' : 'save';
        // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
        const savedData = await cleanAndSave(toSave, { intent });
        const normalizedSavedData = normalizeDraftPlaceholders(savedData);
        applySavedData(normalizedSavedData, toSave as TravelFormData);
        autosaveCancelPendingRef.current?.();
        showToast('Сохранено');
        return savedData;
      } catch (error) {
        // Сохранение не удалось — пользователь остаётся на странице, поэтому снова
        // разрешаем тосты автосейва (иначе после неудачной публикации/модерации
        // последующие ошибки автосейва станут «немыми» до конца сессии).
        suppressAutosaveErrorToastRef.current = false;
        if ((error as Error)?.message === 'Request aborted') {
          throw error;
        }
        const details =
          error instanceof ApiError
            ? error.message
            : getErrorMessage(error);

        void showToastMessage({
          type: 'error',
          text1: 'Ошибка сохранения',
          text2: details && details !== 'Save failed' ? details : 'Попробуйте ещё раз',
        });
        console.error('Manual save error:', error);
        if (error instanceof Error) {
          (error as ToastAwareError).toastShown = true;
        }
        throw error;
      } finally {
        manualSavePromiseRef.current = null;
        manualSaveInFlightRef.current = false;
        setIsManualSaveInFlight(false);
      }
    })();

    manualSavePromiseRef.current = promise;
    return promise;
  }, [
    applySavedData,
    cleanAndSave,
    showToast,
    formDataRef,
    manualSaveInFlightRef,
    manualSavePromiseRef,
    saveAbortControllerRef,
    setIsManualSaveInFlight,
    suppressAutosaveErrorToastRef,
  ]);

  // ✅ FIX: Выносим updateBaseline в ref чтобы избежать stale closure
  useEffect(() => {
    updateBaselineRef.current = autosave.updateBaseline;
  }, [autosave.updateBaseline, updateBaselineRef]);

  // Держим стабильную ссылку на cancelPending, чтобы handleManualSave не
  // зависел от объекта autosave (который меняется на каждый тик статуса).
  useEffect(() => {
    autosaveCancelPendingRef.current = autosave.cancelPending ?? null;
  }, [autosave.cancelPending]);

  return {
    cleanAndSave,
    applySavedData,
    handleSaveSuccess,
    handleSaveError,
    autosave,
    handleManualSave,
  };
}
