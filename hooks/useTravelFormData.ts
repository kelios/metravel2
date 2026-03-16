import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import isEqual from 'fast-deep-equal';
import { useRouter } from 'expo-router';
import { QueryClientContext } from '@tanstack/react-query';
import { fetchTravel } from '@/api/travelsApi';
import { saveFormData, uploadImage } from '@/api/misc';
import { TravelFormData, Travel, MarkerData } from '@/types/types';
import { useFormState } from '@/hooks/useFormState';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';
import {
  getEmptyFormData,
  transformTravelToFormData,
  syncCountriesFromMarkers,
  cleanEmptyFields,
  normalizeTravelId,
  checkTravelEditAccess,
  stripMarkerCoverFallbacks,
} from '@/utils/travelFormUtils';
import { showToast } from '@/utils/toast';
import { ApiError } from '@/api/client';
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
  isLocalPreviewUrl,
} from '@/utils/travelFormNormalization';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { getPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';
import { applySmartImageLayout } from '@/utils/richTextImageLayout';

async function showToastMessage(payload: unknown) {
  await showToast(payload);
}

type ToastAwareError = Error & { toastShown?: boolean };
const DEFAULT_MARKER_SERIALIZER_FALLBACK_IMAGE = '/og-default.png';

interface UseTravelFormDataOptions {
  travelId: string | null;
  isNew: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
  onAuthRequired?: (context: { redirect: string }) => void | Promise<void>;
}

async function invalidateTravelCollections(
  queryClient: { invalidateQueries?: (filters: unknown) => Promise<unknown> | unknown } | null | undefined,
  userId: string | null,
) {
  if (!queryClient?.invalidateQueries) return;

  await queryClient.invalidateQueries({ queryKey: ['travels'], refetchType: 'all' });

  if (!userId) return;

  await queryClient.invalidateQueries({ queryKey: ['my-travels-count', userId], refetchType: 'all' });
  await queryClient.invalidateQueries({ queryKey: ['export-my-travels-count', userId], refetchType: 'all' });
}

export function useTravelFormData(options: UseTravelFormDataOptions) {
  const { travelId, isNew, userId, isSuperAdmin, isAuthenticated, authReady, onAuthRequired } = options;
  const router = useRouter();
  const queryClient = useContext(QueryClientContext);
  const stableTravelId = useMemo(() => {
    if (isNew) return null;
    return travelId ? normalizeTravelId(travelId) : null;
  }, [isNew, travelId]);

  const initialFormData = useMemo(() => {
    return getEmptyFormData(stableTravelId != null ? String(stableTravelId) : null);
  }, [stableTravelId]);

  const formDataRef = useRef<TravelFormData>(initialFormData);
  const saveAbortControllerRef = useRef<AbortController | null>(null);


  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [_dataVersion, setDataVersion] = useState(0);
  const [isManualSaveInFlight, setIsManualSaveInFlight] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const manualSaveInFlightRef = useRef(false);
  const manualSavePromiseRef = useRef<Promise<TravelFormData | void> | null>(null);
  const suppressAutosaveErrorToastRef = useRef(false);
  const mountedRef = useRef(true); // ✅ FIX: Защита от memory leak
  const initialLoadKeyRef = useRef<string | null>(null);
  const pendingBaselineRef = useRef<TravelFormData | null>(null);
  const didInvalidateAfterCreateRef = useRef(false);
  const markerUploadStateRef = useRef(new Map<string, { inFlight: boolean; attempts: number }>());

  const formState = useFormState<TravelFormData>(initialFormData, {
    debounce: 5000,
    validateOnChange: true,
    validationDebounce: 300,
  });

  useEffect(() => {
    formDataRef.current = formState.data;
  }, [formState.data]);

  useEffect(() => {
    const pending = pendingBaselineRef.current;
    if (!pending) return;
    // Only update baseline once the reset payload is actually reflected in state.
    if (formState.data !== pending) return;
    updateBaselineRef.current?.(pending);
    pendingBaselineRef.current = null;
  }, [formState.data]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    void showToastMessage({
      type,
      text1: message,
    });
  }, []);

  const applyUploadedMarkerImage = useCallback(
    (markerId: string, blobUrl: string, uploadedUrl: string) => {
      const currentMarkers = Array.isArray(formDataRef.current.coordsMeTravel)
        ? (formDataRef.current.coordsMeTravel as MarkerData[])
        : [];

      const updatedMarkers = currentMarkers.map((marker) => {
        if (String(marker?.id ?? '') !== markerId) return marker;
        if (String(marker?.image ?? '').trim() !== blobUrl) return marker;
        return {
          ...marker,
          image: uploadedUrl,
        };
      });

      const nextFormData = {
        ...(formDataRef.current as TravelFormData),
        coordsMeTravel: updatedMarkers as unknown as TravelFormData['coordsMeTravel'],
      };

      formDataRef.current = nextFormData;
      setMarkers(updatedMarkers);
      formState.updateField('coordsMeTravel', updatedMarkers as unknown);
      updateBaselineRef.current?.(nextFormData);
    },
    [formState]
  );

  const rehydrateMarkerIdsFromServer = useCallback(
    async (travelIdValue: string | number | null | undefined, sourceMarkers: MarkerData[]) => {
      const resolvedTravelId = normalizeTravelId(travelIdValue);
      if (resolvedTravelId == null) return null;
      if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0) return null;

      const needsMarkerIds = sourceMarkers.some((marker) => {
        const markerId = marker?.id;
        const imageUrl = typeof marker?.image === 'string' ? marker.image.trim() : '';
        return isLocalPreviewUrl(imageUrl) && (markerId == null || String(markerId).trim() === '');
      });
      if (!needsMarkerIds) return null;

      try {
        // Some backend deployments persist the new point but do not return its id
        // in the immediate upsert response. We re-fetch once and merge by id/lat-lng
        // so the deferred point-photo upload still has a concrete point id.
        const freshTravel = await fetchTravel(Number(resolvedTravelId));
        const transformed = normalizeDraftPlaceholders(transformTravelToFormData(freshTravel));
        const serverMarkers = Array.isArray(transformed.coordsMeTravel)
          ? (transformed.coordsMeTravel as unknown as MarkerData[])
          : [];
        if (serverMarkers.length === 0) return null;

        const mergedMarkers = mergeMarkersPreserveImages(serverMarkers, sourceMarkers) as MarkerData[];
        const hasResolvedIds = mergedMarkers.some((marker) => {
          const imageUrl = typeof marker?.image === 'string' ? marker.image.trim() : '';
          return isLocalPreviewUrl(imageUrl) && marker?.id != null && String(marker.id).trim() !== '';
        });

        return hasResolvedIds ? mergedMarkers : null;
      } catch {
        return null;
      }
    },
    []
  );

  const uploadPendingMarkerImages = useCallback(
    async (markersInput: unknown) => {
      if (!Array.isArray(markersInput) || markersInput.length === 0) return;

      await Promise.all(
        markersInput.map(async (marker) => {
          const markerRecord =
            marker && typeof marker === 'object' ? (marker as Record<string, unknown>) : null;
          const imageUrl = typeof markerRecord?.image === 'string' ? markerRecord.image.trim() : '';
          const markerId = markerRecord?.id;
          if (!imageUrl || !/^(blob:)/i.test(imageUrl)) return;
          if (markerId == null || String(markerId).trim() === '') return;

          const state = markerUploadStateRef.current.get(imageUrl) ?? { inFlight: false, attempts: 0 };
          if (state.inFlight || state.attempts >= 3) return;

          const file = getPendingImageFile(imageUrl);
          if (!file) return;

          markerUploadStateRef.current.set(imageUrl, { inFlight: true, attempts: state.attempts + 1 });

          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('collection', 'travelImageAddress');
            formData.append('id', String(markerId));

            const response = await uploadImage(formData);
            const uploadedUrlRaw = response?.url || response?.data?.url || response?.path || response?.file_url;
            const uploadedUrl = uploadedUrlRaw ? normalizeMediaUrl(String(uploadedUrlRaw)) : '';
            if (!uploadedUrl) {
              throw new Error('Upload did not return URL');
            }

            removePendingImageFile(imageUrl);
            applyUploadedMarkerImage(String(markerId), imageUrl, uploadedUrl);
          } catch {
            // Keep pending file for the next successful save/retry path.
          } finally {
            markerUploadStateRef.current.set(imageUrl, { inFlight: false, attempts: state.attempts + 1 });
          }
        })
      );
    },
    [applyUploadedMarkerImage]
  );

  const cleanAndSave = useCallback(async (data: TravelFormData, options?: { autosave?: boolean }) => {
    // ✅ FIX: Отменяем предыдущий запрос для предотвращения race condition
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }

    // Создаём новый контроллер для этого запроса
    const abortController = new AbortController();
    saveAbortControllerRef.current = abortController;

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
        (mergedData as unknown).coordsMeTravel as Record<string, unknown>[],
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

      return result;
    } catch (error) {
      const errAny: unknown = error;
      const isAbort = abortController.signal.aborted || errAny?.name === 'AbortError';
      if (isAbort) {
        // Нормализуем отмену, чтобы выше по цепочке можно было её корректно игнорировать.
        throw new Error('Request aborted');
      }
      throw error;
    } finally {
      // Очищаем ссылку только если это наш контроллер
      if (saveAbortControllerRef.current === abortController) {
        saveAbortControllerRef.current = null;
      }
    }
  }, [stableTravelId]);

  const applySavedData = useCallback(
    (
      savedData: TravelFormData,
      sourceData?: TravelFormData,
      options?: { preserveEditingState?: boolean }
    ) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      const normalizedSavedData = normalizeDraftPlaceholders(savedData);
      const currentDataSnapshot =
        (sourceData as TravelFormData | undefined) ??
        (formDataRef.current as TravelFormData) ??
        (formState.data as TravelFormData);
      const hadId = normalizeTravelId((currentDataSnapshot as unknown)?.id) != null;
      const hasId = normalizeTravelId((normalizedSavedData as unknown)?.id) != null;

      // If backend returns placeholders/empty strings for rich text fields, don't wipe user input.
      const kf = (key: keyof TravelFormData, mode: Parameters<typeof keepCurrentField>[3]) =>
        keepCurrentField(normalizedSavedData, currentDataSnapshot, key, mode);

      (['description', 'plus', 'minus', 'recommendation', 'youtube_link'] as const).forEach(k => {
        kf(k, 'emptyString');
        kf(k, 'nil');
      });
      kf('name', 'nil');
      kf('name', 'emptyString');

      if (options?.preserveEditingState) {
        (['name', 'description', 'plus', 'minus', 'recommendation', 'youtube_link'] as const).forEach((key) => {
          normalizedSavedData[key] = currentDataSnapshot[key];
        });
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
        normalizedSavedData.travel_image_thumb_url = null as unknown;
      }
      if (currentDataSnapshot.travel_image_thumb_small_url == null && normalizedSavedData.travel_image_thumb_small_url != null) {
        normalizedSavedData.travel_image_thumb_small_url = null as unknown;
      }

      kf('gallery', 'emptyArray');
      kf('gallery', 'nilArray');

      const markersFromResponse = Array.isArray(normalizedSavedData.coordsMeTravel)
        ? (normalizedSavedData.coordsMeTravel as unknown)
        : [];
      const currentMarkers = Array.isArray(currentDataSnapshot.coordsMeTravel)
        ? (currentDataSnapshot.coordsMeTravel as unknown)
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
        formState.reset(finalData);
        formDataRef.current = finalData as TravelFormData;
        setMarkers(effectiveMarkers);
        updateBaselineRef.current?.(finalData);
        pendingBaselineRef.current = null;
      }

      const travelIdForRefresh = normalizeTravelId((finalData as unknown)?.id) ?? stableTravelId;
      void (async () => {
        let markersForUpload = effectiveMarkers as MarkerData[];
        const refreshedMarkers = await rehydrateMarkerIdsFromServer(travelIdForRefresh, effectiveMarkers as MarkerData[]);
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
          formState.updateField('coordsMeTravel', refreshedMarkers as unknown);
          updateBaselineRef.current?.(refreshedData);
        }
        await uploadPendingMarkerImages(markersForUpload);
      })();

      // ✅ FIX: Обновляем версию данных при получении с сервера только когда реально меняем форму
      if (!shouldSkipFormReset) {
        setDataVersion(prev => prev + 1);
      }

      // When a new travel is created and receives an id, invalidate "travels" lists
      // so "Мои путешествия" can show the new draft without a hard refresh.
      if (!hadId && hasId && !didInvalidateAfterCreateRef.current) {
        didInvalidateAfterCreateRef.current = true;
        void invalidateTravelCollections(queryClient, userId);
      }
    },
    [formState, queryClient, rehydrateMarkerIdsFromServer, stableTravelId, uploadPendingMarkerImages, userId]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      // После первого автосейва создаётся id — остаёмся в мастере и просто подставляем новые данные.
      applySavedData(savedData, formDataRef.current, { preserveEditingState: true });
    },
    [applySavedData]
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

      // ✅ FIX: Подробное логирование для мониторинга
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        travelId: stableTravelId,
        timestamp: new Date().toISOString(),
        formDataSnapshot: {
          id: formState.data.id,
          name: formState.data.name,
          hasMarkers: Array.isArray(formState.data.coordsMeTravel) && formState.data.coordsMeTravel.length > 0,
        }
      };

      console.error('Autosave error (detailed):', errorDetails);

      // В продакшене можно отправить в систему мониторинга (Sentry, LogRocket и т.д.)
      if (typeof window !== 'undefined' && (window as unknown).Sentry) {
        (window as unknown).Sentry.captureException(error, {
          tags: { component: 'useTravelFormData', action: 'autosave' },
          extra: errorDetails,
        });
      }

      showToast('Ошибка автосохранения', 'error');
    },
    [showToast, stableTravelId, formState.data]
  );

  const autosave = useImprovedAutoSave(formState.data, initialFormData, {
    debounce: 5000,
    onSave: async (dataToSave) => {
      // Avoid racing autosave requests while a manual save is in progress.
      if (manualSaveInFlightRef.current) {
        throw new Error('Request aborted');
      }
      return await cleanAndSave(dataToSave as TravelFormData, { autosave: true });
    },
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    // Не автосейвим, когда travel уже в "терминальном" состоянии (moderation/publish),
    // иначе получаем повторные upsert и 400 на обязательные поля.
    enabled:
      isAuthenticated &&
      hasAccess &&
      !isManualSaveInFlight &&
      !(formState.data as unknown)?.moderation &&
      !(formState.data as unknown)?.publish,
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
        const wantsToLeaveSoon = !!(dataOverride as unknown)?.publish || !!(dataOverride as unknown)?.moderation;
        if (wantsToLeaveSoon) {
          suppressAutosaveErrorToastRef.current = true;
        }

        // Отменяем отложенный автосейв, чтобы не отправить старые данные (publish=false) после ручного сохранения.
        autosave?.cancelPending?.();
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
        // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
        const savedData = await cleanAndSave(toSave);
        const normalizedSavedData = normalizeDraftPlaceholders(savedData);
        applySavedData(normalizedSavedData, toSave as TravelFormData);
        autosave?.cancelPending?.();
        showToast('Сохранено');
        return savedData;
      } catch (error) {
        if ((error as Error)?.message === 'Request aborted') {
          throw error;
        }
        const errAny: unknown = error;
        const details =
          errAny instanceof ApiError
            ? errAny.message
            : (typeof errAny?.message === 'string' ? errAny.message : null);

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
  }, [applySavedData, autosave, cleanAndSave, showToast]);

  // ✅ FIX: Выносим updateBaseline в ref чтобы избежать stale closure
  const updateBaselineRef = useRef<((data: unknown) => void) | null>(null);
  useEffect(() => {
    updateBaselineRef.current = autosave.updateBaseline;
  }, [autosave.updateBaseline]);

  const loadTravelData = useCallback(
    async (id: string) => {
      try {
        setLoadError(null);
        const travelData = await fetchTravel(Number(id));

        if (!isNew && travelData) {
          const canEdit = checkTravelEditAccess(travelData, userId, isSuperAdmin);

          if (!canEdit) {
            void showToastMessage({
              type: 'error',
              text1: 'Нет доступа',
              text2: 'Вы можете редактировать только свои путешествия',
            });
            // ✅ FIX: Явно устанавливаем hasAccess в false при отсутствии доступа
            setHasAccess(false);
            return;
          }

          setHasAccess(true);
        } else if (isNew) {
          setHasAccess(true);
        }

        const transformed = normalizeDraftPlaceholders(transformTravelToFormData(travelData));
        const markersFromData = (transformed.coordsMeTravel as unknown) || [];
        const syncedCountries = syncCountriesFromMarkers(markersFromData, transformed.countries || []);

        const finalData = {
          ...transformed,
          countries: syncedCountries,
        };

        setTravelDataOld(travelData);
        formState.reset(finalData);
        setMarkers(markersFromData);

        // ✅ FIX: Используем ref для updateBaseline чтобы избежать stale closure и race condition
        updateBaselineRef.current?.(finalData);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        const status = apiError?.status ?? -1;
        const message =
          apiError?.message ||
          (error instanceof Error ? error.message : 'Не удалось загрузить путешествие');

        console.error('Ошибка загрузки путешествия:', error);

        if (status === 401) {
          try {
            await onAuthRequired?.({ redirect: `/travel/${encodeURIComponent(String(id))}` });
          } catch {
            // ignore
          }
          void showToastMessage({
            type: 'error',
            text1: 'Требуется вход',
            text2: 'Войдите в аккаунт, чтобы редактировать путешествие',
          });
          setHasAccess(false);
          setLoadError({ status, message });
          const redirect = `/travel/${encodeURIComponent(String(id))}`;
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}&intent=edit-travel` as unknown);
          return;
        }

        if (status === 403) {
          void showToastMessage({
            type: 'error',
            text1: 'Нет доступа',
            text2: 'Вы можете редактировать только свои путешествия',
          });
          setHasAccess(false);
          setLoadError({ status, message });
          return;
        }

        if (status === 404) {
          void showToastMessage({
            type: 'error',
            text1: 'Путешествие не найдено',
            text2: 'Возможно, оно было удалено или недоступно',
          });
          setHasAccess(false);
          setLoadError({ status, message });
          return;
        }

        void showToastMessage({
          type: 'error',
          text1: 'Ошибка загрузки',
          text2: status === 0 ? message : 'Не удалось загрузить путешествие',
        });

        // Don't redirect away: keep the user on the edit screen and allow retry.
        setHasAccess(false);
        setLoadError({ status, message });
      }
    },
    [formState, isNew, onAuthRequired, router, userId, isSuperAdmin]
  );

  const retryLoad = useCallback(async () => {
    if (isNew) return;
    if (!travelId) return;
    setIsInitialLoading(true);
    await loadTravelData(travelId as string).finally(() => setIsInitialLoading(false));
  }, [isNew, loadTravelData, travelId]);


  // ✅ FIX: Cleanup на размонтирование
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      // React StrictMode can mount/unmount effects twice in development.
      // Reset the initial-load guard so the next mount can re-trigger loading.
      initialLoadKeyRef.current = null;
      // Отменяем все pending запросы
      if (saveAbortControllerRef.current) {
        saveAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const loadKey = String(travelId ?? 'new');
    if (initialLoadKeyRef.current === loadKey) return;
    initialLoadKeyRef.current = loadKey;

    if (!isNew && travelId) {
      setIsInitialLoading(true);
      void loadTravelData(travelId as string).finally(() => {
        setIsInitialLoading(false);
      });
    } else if (isNew) {
      setHasAccess(true);
      setIsInitialLoading(false);
    }
  }, [authReady, travelId, isNew, loadTravelData]);

  const handleCountrySelect = useCallback(
    (countryId: string) => {
      setHasUserInteracted(true);
      const id = String(countryId);
      const current = (formState.data.countries || []).map(String);
      if (id && !current.includes(id)) {
        formState.updateField('countries', [...current, id]);
      }
    },
    [formState]
  );

  const handleCountryDeselect = useCallback(
    (countryId: string) => {
      setHasUserInteracted(true);
      const id = String(countryId);
      const current = (formState.data.countries || []).map(String);
      formState.updateField('countries', current.filter(c => c !== id));
    },
    [formState]
  );

  const setFormData = useCallback<React.Dispatch<React.SetStateAction<TravelFormData>>>(
    updater => {
      setHasUserInteracted(true);
      if (typeof updater === 'function') {
        const next = updater(formDataRef.current);
        formDataRef.current = next as TravelFormData;
        formState.updateFields(next);
      } else {
        formDataRef.current = updater as TravelFormData;
        formState.updateFields(updater as Partial<TravelFormData>);
      }
    },
    [formState]
  );

  const handleMarkersUpdate = useCallback(
    (updatedMarkers: MarkerData[]) => {
      setHasUserInteracted(true);
      setMarkers(updatedMarkers);
      formState.updateField('coordsMeTravel', updatedMarkers as unknown);
    },
    [formState]
  );

  return useMemo(() => ({
    formData: formState.data,
    setFormData,
    markers,
    setMarkers: handleMarkersUpdate,
    travelDataOld,
    isInitialLoading,
    hasAccess,
    loadError,
    autosave,
    handleManualSave,
    handleCountrySelect,
    handleCountryDeselect,
    hasUserInteracted,
    formState,
    retryLoad,
  }), [
    formState,
    setFormData,
    markers,
    handleMarkersUpdate,
    travelDataOld,
    isInitialLoading,
    hasAccess,
    loadError,
    autosave,
    handleManualSave,
    handleCountrySelect,
    handleCountryDeselect,
    hasUserInteracted,
    retryLoad,
  ]);
}
