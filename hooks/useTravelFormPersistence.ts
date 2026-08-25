import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import isEqual from 'fast-deep-equal';
import { type QueryClient } from '@tanstack/react-query';
import { saveFormData, saveTravelContent, type TravelContentSaveResponse } from '@/api/misc';
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
import { applySmartImageLayout } from '@/utils/richTextImageLayout';
import {
  planTravelContentSave,
  type TravelContentSavePlan,
} from '@/utils/travelContentSaveDelta';
import { showToastMessage } from '@/utils/toast';
import {
  getErrorMessage,
  getErrorName,
  localizeBackendFieldError,
  mapKnownServerErrorToRu,
} from '@/utils/errorHelpers';
import {
  confirmRichTextLossIfNeeded,
  type RichTextSnapshot,
} from '@/utils/travelTextLossGuard';
import { mergeGalleryPreserveCurrentCaptions } from '@/utils/galleryEntryModel';
import {
  invalidateTravelCollections,
  invalidateTravelDetails,
} from '@/utils/travelQueryInvalidation';
import { useAutosaveErrorToast } from '@/hooks/useAutosaveErrorToast';
import { translate as i18nT } from '@/i18n'


type ToastAwareError = Error & { toastShown?: boolean };
const getLocalizedSaveErrorDetails = (
  error: unknown,
  rawDetails: string,
): string | undefined => {
  if (rawDetails === 'Save failed') return undefined

  if (error instanceof ApiError) {
    const data = error.data
    const candidates = data && typeof data === 'object' && !Array.isArray(data)
      ? Object.values(data as Record<string, unknown>)
      : [data]

    for (const candidate of candidates) {
      const localized = localizeBackendFieldError(candidate)
      if (localized) return localized
    }
  }

  return localizeBackendFieldError(rawDetails)
}

const SERVER_OWNED_SAVE_RESPONSE_FIELDS = new Set<keyof TravelFormData>([
  'id',
  'slug',
  'gallery',
  'coordsMeTravel',
  'travel_image_thumb_url',
  'travel_image_thumb_small_url',
  'thumbs200ForCollectionArr',
  'travelImageThumbUrlArr',
  'travelImageThumbUrArr',
  'travelImageAddress',
  'countryIds',
  'travelAddressIds',
  'travelAddressCity',
  'travelAddressCountry',
  'travelAddressAdress',
  'travelAddressCategory',
  'categoriesIds',
  'publish',
  'moderation',
]);
const LOCAL_EDITING_STATE_FIELDS = new Set<keyof TravelFormData>(['name', 'description', 'plus', 'minus', 'recommendation', 'youtube_link']);

const preserveFieldsEditedAfterDispatch = (
  savedData: TravelFormData,
  currentData: TravelFormData,
  sourceData?: TravelFormData,
): TravelFormData => {
  if (!sourceData) return savedData;

  const mergedData = { ...savedData };
  (Object.keys(currentData) as Array<keyof TravelFormData>).forEach((key) => {
    if (SERVER_OWNED_SAVE_RESPONSE_FIELDS.has(key)) return;
    if (isEqual(currentData[key], sourceData[key]) && !LOCAL_EDITING_STATE_FIELDS.has(key)) return;
    Reflect.set(mergedData, key, currentData[key]);
  });
  return mergedData;
};

/**
 * Общая обвязка отмены для обоих контрактов сохранения (полного и узкого).
 *
 * Держит в `saveAbortControllerRef` контроллер текущего сохранения: ручной сейв
 * обрывает по нему летящий фоновый, а внешний signal автосейва
 * (cancelPending/unmount) реально прерывает запрос, а не только игнорирует ответ.
 */
async function runWithSaveAbortController<T>(
  saveAbortControllerRef: MutableRefObject<AbortController | null>,
  externalSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (saveAbortControllerRef.current) {
    saveAbortControllerRef.current.abort();
  }

  const abortController = new AbortController();
  saveAbortControllerRef.current = abortController;

  const onExternalAbort = () => abortController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortController.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  try {
    return await run(abortController.signal);
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
}

const markerIdentityMatches = (left: MarkerData, right: MarkerData): boolean => {
  const leftId = left.id == null ? '' : String(left.id).trim();
  const rightId = right.id == null ? '' : String(right.id).trim();
  if (leftId && rightId) return leftId === rightId;

  const leftLat = Number(left.lat);
  const leftLng = Number(left.lng);
  const rightLat = Number(right.lat);
  const rightLng = Number(right.lng);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;

  return (
    Math.abs(leftLat - rightLat) + Math.abs(leftLng - rightLng) <= 1e-5
  );
};

const mergeRehydratedMarkerIdsIntoLive = (
  refreshedMarkers: MarkerData[],
  liveMarkers: MarkerData[],
): MarkerData[] => {
  const usedRefreshedIndexes = new Set<number>();

  return liveMarkers.map((liveMarker) => {
    const refreshedIndex = refreshedMarkers.findIndex(
      (refreshedMarker, index) =>
        !usedRefreshedIndexes.has(index) &&
        markerIdentityMatches(refreshedMarker, liveMarker),
    );
    if (refreshedIndex < 0) return liveMarker;

    usedRefreshedIndexes.add(refreshedIndex);
    const refreshedId = refreshedMarkers[refreshedIndex].id;
    if (liveMarker.id != null || refreshedId == null) return liveMarker;
    return { ...liveMarker, id: refreshedId };
  });
};

type MonitoringWindow = Window & {
  Sentry?: {
    captureException: (error: unknown, context?: Record<string, unknown>) => void;
  };
};

interface UseTravelFormPersistenceParams {
  formState: ReturnType<typeof useFormState<TravelFormData>>;
  initialFormData: TravelFormData;
  stableTravelId: number | null;
  queryClient: QueryClient | null | undefined;
  userId: string | null;
  isAuthenticated: boolean;
  hasAccess: boolean;
  // Форма уже наполнена серверными данными этой поездки (или это новая поездка).
  // Пока false — автосейв запрещён: у существующей записи он ушёл бы с пустой
  // формой, а upsert full-replace стёр бы статью (инцидент 2026-07-21, travel 641).
  isFormHydrated: boolean;
  isOnline: boolean;
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
  // Серверный baseline rich-text полей: значения, с которыми статья сейчас лежит на сервере
  // (выставляется при загрузке и после каждого успешного сохранения). Источник для guard'а
  // «анти-потеря текста» при ручном сохранении существующей статьи.
  serverTextBaselineRef: MutableRefObject<RichTextSnapshot | null>;
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
    isFormHydrated,
    isOnline,
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
    serverTextBaselineRef,
    didInvalidateAfterCreateRef,
    updateBaselineRef,
    rehydrateMarkerIdsFromServer,
    uploadPendingMarkerImages,
  } = params;

  // Каждый вызов applySavedData увеличивает epoch. Асинхронный rehydrate из
  // более старого вызова не должен затирать state/baseline, выставленные более
  // новым applySavedData (или последующими правками пользователя).
  const applyEpochRef = useRef(0);

  // useImprovedAutoSave знает отправленный payload, но onSuccess получает только
  // ответ. Храним его отдельно, чтобы поздний response не объявил более свежую
  // форму (например, уже с точкой B) успешно сохранённым baseline.
  const lastAutosaveSourceRef = useRef<TravelFormData | null>(null);

  // Итог последнего узкого сохранения (#1516). onSuccess движка получает только
  // возвращённое значение, а узкий ответ — это подтверждение текста, а не статья
  // целиком: применять его как полный ответ нельзя. Идентичность `confirmed`
  // отличает «этот успех пришёл с узкого пути» от полного сохранения.
  const lastContentSaveRef = useRef<{
    confirmed: TravelFormData;
    response: TravelContentSaveResponse;
  } | null>(null);

  // Стабильная ссылка на autosave.cancelPending, чтобы handleManualSave не
  // пересоздавался на каждый тик статуса автосейва.
  const autosaveCancelPendingRef = useRef<(() => void) | null>(null);

  // Троттлинг пользовательского тоста «Ошибка автосохранения» (см. хук).
  const {
    notify: notifyAutosaveError,
    reset: resetAutosaveErrorToastThrottle,
  } = useAutosaveErrorToast(showToast);

  // Хвостовой сейв: если во время in-flight ручного сохранения приходит ещё один
  // вызов с dataOverride, мы дедуплицируем (возвращаем текущий промис), но НЕ теряем
  // override — запоминаем последний и один раз прогоняем его после завершения текущего.
  // Сценарий: правка categories точки B во время сейва точки A на опубликованном travel
  // (автосейв выключен) — без этого override B молча терялся.
  const queuedManualSaveRef = useRef<{
    dataOverride?: TravelFormData;
    options?: { intent?: 'save' | 'publish' };
  } | null>(null);
  const handleManualSaveRef = useRef<
    ((
      dataOverride?: TravelFormData,
      options?: { intent?: 'save' | 'publish' },
    ) => Promise<TravelFormData | void>) | null
  >(null);

  const captureTextBaseline = useCallback((data: TravelFormData) => {
    serverTextBaselineRef.current = {
      description: data.description ?? '',
      plus: data.plus ?? '',
      minus: data.minus ?? '',
      recommendation: data.recommendation ?? '',
    };
  }, [serverTextBaselineRef]);

  const cleanAndSave = useCallback(async (
    data: TravelFormData,
    options?: { autosave?: boolean; intent?: 'autosave' | 'save' | 'publish' },
    externalSignal?: AbortSignal,
  ) => {
    return runWithSaveAbortController(saveAbortControllerRef, externalSignal, async (saveSignal) => {
      const baseFormData = getEmptyFormData(data?.id ? String(data.id) : null);
      const mergedData = normalizeNullableStrings({
        ...baseFormData,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
      } as TravelFormData);

      const normalizedGallery = normalizeGalleryForSave(mergedData.gallery);
      const normalizedGalleryIds = normalizeGalleryImageIdsForSave(normalizedGallery);
      // #1182: точке без своего фото раньше подставлялась обложка маршрута /
      // первое фото галереи / og-default.png. Бэк сохраняет такой URL как ключ
      // хранилища и отдаёт `/address-image/<URL>` → вечный 404 (записи 15904,
      // 15905, 15934 на проде). Подстановки больше нет.
      const normalizedMarkers = normalizeMarkersForSave(
        mergedData.coordsMeTravel as Record<string, unknown>[],
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

      const result = await saveFormData(payload, saveSignal, options);

      // ✅ FIX: Проверяем, что запрос не был отменён
      if (saveSignal.aborted) {
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
    });
  }, [queryClient, stableTravelId, mountedRef, saveAbortControllerRef]);

  /**
   * Узкий путь фонового сохранения (#1516): уходят только изменившиеся текстовые
   * поля, поэтому сервер не пересобирает граф статьи — точки, галерея, обложка,
   * справочники и статус публикации остаются нетронутыми.
   */
  const saveContentDelta = useCallback(async (
    plan: Extract<TravelContentSavePlan, { kind: 'content' }>,
    previousSlug: string | null | undefined,
    externalSignal?: AbortSignal,
  ): Promise<TravelContentSaveResponse> => {
    const fields = { ...plan.fields };
    // Тот же smart-layout описания, что и на полном пути: раскладка картинок не
    // должна зависеть от того, каким контрактом ушла правка.
    if (typeof fields.description === 'string') {
      fields.description = applySmartImageLayout(fields.description);
    }

    return runWithSaveAbortController(saveAbortControllerRef, externalSignal, async (saveSignal) => {
      if (!mountedRef.current) {
        throw new Error('Component unmounted');
      }

      const response = await saveTravelContent(plan.travelId, fields, saveSignal);

      if (saveSignal.aborted) {
        throw new Error('Request aborted');
      }

      // Правка названия перестраивает slug: старый ключ детали тоже обязан
      // протухнуть, иначе страница по прежнему адресу отдаст старый текст.
      void invalidateTravelDetails(
        queryClient,
        plan.travelId,
        response?.id,
        response?.slug,
        previousSlug,
      );

      return response;
    });
  }, [queryClient, mountedRef, saveAbortControllerRef]);

  const applySavedData = useCallback(
    (
      savedData: TravelFormData,
      sourceData?: TravelFormData,
      options?: { preserveEditingState?: boolean }
    ) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      const epoch = ++applyEpochRef.current;

      let normalizedSavedData = normalizeDraftPlaceholders(savedData);
      // `sourceData` is the snapshot that started this request. The live ref can
      // already contain another point by the time the response arrives, so it is
      // the only safe merge target. Using the request snapshot here made a stale
      // upsert response remove every point added while that request was in flight.
      const currentDataSnapshot =
        (formDataRef.current as TravelFormData) ??
        (formState.data as TravelFormData) ??
        (sourceData as TravelFormData);
      if (options?.preserveEditingState) {
        normalizedSavedData = preserveFieldsEditedAfterDispatch(
          normalizedSavedData,
          currentDataSnapshot,
          sourceData,
        );
      }
      const hadId = normalizeTravelId(currentDataSnapshot.id) != null;
      const hasId = normalizeTravelId(normalizedSavedData.id) != null;

      // If backend returns placeholders/empty strings for rich text fields, don't wipe user input.
      const kf = (key: keyof TravelFormData, mode: Parameters<typeof keepCurrentField>[3]) =>
        keepCurrentField(normalizedSavedData, currentDataSnapshot, key, mode);

      (['description', 'plus', 'minus', 'recommendation', 'youtube_link'] as const).forEach(k => {
        kf(k, 'emptyString');
        kf(k, 'nil');
      });
      kf('name', 'nil');
      kf('name', 'emptyString');
      kf('visitedDate', 'nil');
      kf('visitedDate', 'emptyString');

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
      normalizedSavedData.gallery = mergeGalleryPreserveCurrentCaptions(
        normalizedSavedData.gallery,
        formDataRef.current?.gallery ?? currentDataSnapshot.gallery,
        sourceData?.gallery,
      ) as TravelFormData['gallery'];

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
      const persistedBaselineData =
        sourceData && !isEqual(currentDataSnapshot, sourceData)
          ? sourceData
          : finalData;

      const shouldSkipFormReset =
        options?.preserveEditingState === true &&
        hadId &&
        hasId &&
        isEqual(finalData, currentDataSnapshot);

      if (shouldSkipFormReset) {
        formDataRef.current = currentDataSnapshot;
        updateBaselineRef.current?.(persistedBaselineData);
        captureTextBaseline(persistedBaselineData);
      } else {
        pendingBaselineRef.current = finalData;
        try {
          formState.reset(finalData);
          formDataRef.current = finalData as TravelFormData;
          setMarkers(effectiveMarkers);
          updateBaselineRef.current?.(persistedBaselineData);
          captureTextBaseline(persistedBaselineData);
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
          // The id refresh is another async response. Merge it into the markers
          // that are live *now* so a point added after rehydrate started is not
          // removed immediately before its pending photo upload.
          const liveDataSnapshot = formDataRef.current as TravelFormData;
          const liveMarkers = Array.isArray(liveDataSnapshot.coordsMeTravel)
            ? (liveDataSnapshot.coordsMeTravel as MarkerData[])
            : [];
          markersForUpload = mergeRehydratedMarkerIdsIntoLive(
            refreshedMarkers,
            liveMarkers,
          );
          const refreshedData = {
            ...liveDataSnapshot,
            coordsMeTravel: markersForUpload as unknown as TravelFormData['coordsMeTravel'],
          };
          formDataRef.current = refreshedData;
          setMarkers(markersForUpload);
          formState.updateField('coordsMeTravel', markersForUpload);
          // Rehydration only proves server ids for the snapshot it started with.
          // Do not baseline user changes made before/during that request.
          if (
            isEqual(persistedBaselineData, finalData) &&
            isEqual(liveDataSnapshot, finalData)
          ) {
            updateBaselineRef.current?.(refreshedData);
          }
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
      captureTextBaseline,
    ]
  );

  /**
   * Применение итога узкого сохранения. Форму здесь НЕ пересобираем: ответ
   * содержит только текст, и прогон его через applySavedData выглядел бы как
   * «сервер удалил точки и галерею». Обновляем ровно то, чем узкий путь владеет:
   * серверный baseline rich-text и slug, если сервер перестроил его по названию.
   */
  const applyContentSavedData = useCallback(
    (contentSave: { confirmed: TravelFormData; response: TravelContentSaveResponse }) => {
      const { confirmed, response } = contentSave;

      captureTextBaseline(confirmed);

      const nextSlug = typeof response?.slug === 'string' ? response.slug : '';
      const liveData = formDataRef.current as TravelFormData;
      if (!nextSlug || !liveData || liveData.slug === nextSlug) return;

      // Правка названия перестраивает slug и на полном пути (`_set_name_and_slug`).
      // Синхронизируем его вместе с baseline движка: иначе следующий тик увидел бы
      // расхождение по slug и отправил бы лишнее полное сохранение.
      formDataRef.current = { ...liveData, slug: nextSlug };
      formState.updateField('slug', nextSlug);
      updateBaselineRef.current?.(confirmed);
    },
    [captureTextBaseline, formDataRef, formState, updateBaselineRef]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      const contentSave = lastContentSaveRef.current;
      lastContentSaveRef.current = null;

      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      // Успешный сейв снимает троттл: следующая ошибка (уже нового «эпизода») покажется сразу.
      resetAutosaveErrorToastThrottle();

      if (contentSave && contentSave.confirmed === savedData) {
        applyContentSavedData(contentSave);
        return;
      }

      // После первого автосейва создаётся id — остаёмся в мастере и просто подставляем новые данные.
      applySavedData(
        savedData,
        lastAutosaveSourceRef.current ?? formDataRef.current,
        { preserveEditingState: true },
      );
    },
    [applyContentSavedData, applySavedData, formDataRef, mountedRef, resetAutosaveErrorToastThrottle]
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

      // Троттлим только пользовательский тост (логирование/Sentry выше — на каждый отказ,
      // чтобы мониторинг не терял события). При затяжном отказе тост не мигает.
      notifyAutosaveError();
    },
    [notifyAutosaveError, stableTravelId, formDataRef, mountedRef, suppressAutosaveErrorToastRef]
  );

  const handleAutosave = useCallback(async (
    dataToSave: TravelFormData,
    signal?: AbortSignal,
    baseline?: TravelFormData,
  ) => {
    // Avoid racing autosave requests while a manual save is in progress.
    if (manualSaveInFlightRef.current) {
      throw new Error('Request aborted');
    }

    // Правка одного абзаца не должна стоить полной пересборки графа статьи:
    // если относительно подтверждённого состояния изменился только текст —
    // уходим узким контрактом (#1516). Всё остальное идёт полным сохранением.
    const plan = planTravelContentSave(dataToSave, baseline, stableTravelId);
    if (plan.kind === 'content') {
      const response = await saveContentDelta(plan, dataToSave.slug, signal);
      // Подтверждённое состояние — отправленный снимок; slug сервер мог
      // перестроить по новому названию, берём его подтверждённое значение.
      const confirmed: TravelFormData =
        typeof response?.slug === 'string' && response.slug && response.slug !== dataToSave.slug
          ? { ...dataToSave, slug: response.slug }
          : dataToSave;
      lastAutosaveSourceRef.current = dataToSave;
      lastContentSaveRef.current = { confirmed, response };
      return confirmed;
    }

    const savedData = await cleanAndSave(dataToSave, { autosave: true }, signal);
    lastAutosaveSourceRef.current = dataToSave;
    return savedData;
  }, [cleanAndSave, saveContentDelta, manualSaveInFlightRef, stableTravelId]);

  const autosave = useImprovedAutoSave(formState.data, initialFormData, {
    debounce: 5000,
    onSave: handleAutosave,
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    // Не автосейвим, когда travel уже в "терминальном" состоянии (moderation/publish),
    // иначе получаем повторные upsert и 400 на обязательные поля.
    enabled:
      isAuthenticated &&
      hasAccess &&
      // Гидратация формы — обязательное условие: до неё formState.data это пустой
      // getEmptyFormData(id), и любой автосейв стёр бы существующую статью.
      isFormHydrated &&
      !isManualSaveInFlight &&
      !formState.data.moderation &&
      !formState.data.publish,
    isOnline,
  });

  const handleManualSave = useCallback(async (
    dataOverride?: TravelFormData,
    options?: { intent?: 'save' | 'publish' },
  ) => {
    if (manualSavePromiseRef.current) {
      // Сейв уже идёт: дедуплицируем, но не теряем override второго вызова —
      // ставим его в хвост (последний побеждает), он прогонится после текущего.
      if (dataOverride) {
        queuedManualSaveRef.current = { dataOverride, options };
      }
      return manualSavePromiseRef.current;
    }

    manualSaveInFlightRef.current = true;
    setIsManualSaveInFlight(true);
    const promise = (async () => {
      try {
        // Publish-намерение определяется ЯВНЫМ флагом от шага публикации
        // (handleSendToModeration/handleApproveModeration), а НЕ по значению
        // dataOverride.publish: у уже опубликованной поездки (travel/225)
        // инкрементальный сейв точки несёт publish=true, но это не публикация —
        // его нельзя гонять через модерационную валидацию и нельзя глушить тосты
        // (тикет #505). По умолчанию любое ручное/фоновое сохранение = intent 'save'.
        const isPublishIntent = options?.intent === 'publish';
        if (isPublishIntent) {
          // После успешной публикации/модерации пользователь уходит со страницы —
          // тосты автосейва больше не нужны.
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

        // Guard «анти-потеря текста»: у существующей статьи (есть id) сверяем rich-text
        // поля с серверным baseline. Если текст резко разрушается (затирается на пустоту/
        // заглушку — инцидент travel/225), спрашиваем подтверждение. Это защита данных,
        // НЕ completeness-валидация: автосейв не трогаем, статус/модерацию не меняем.
        // Отмена → чистый no-op: ничего не отправляем, форму не трогаем.
        const hasServerId = normalizeTravelId(toSave?.id) ?? stableTravelId;
        if (hasServerId != null && serverTextBaselineRef.current) {
          const proceed = await confirmRichTextLossIfNeeded(serverTextBaselineRef.current, {
            description: toSave?.description ?? '',
            plus: toSave?.plus ?? '',
            minus: toSave?.minus ?? '',
            recommendation: toSave?.recommendation ?? '',
          });
          if (!proceed) {
            suppressAutosaveErrorToastRef.current = false;
            return;
          }
        }

        formDataRef.current = toSave as TravelFormData;
        // Явная публикация/отправка на модерацию (пользователь нажал кнопку в шаге
        // публикации → options.intent === 'publish') проходит серверную модерационную
        // валидацию. Любое другое ручное/фоновое сохранение (в т.ч. инкрементальный
        // сейв точки уже опубликованной поездки, тикет #505) лишь персистит текущее
        // состояние без блокирующей проверки полноты.
        const intent: 'save' | 'publish' = isPublishIntent ? 'publish' : 'save';
        // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
        const savedData = await cleanAndSave(toSave, { intent });
        const normalizedSavedData = normalizeDraftPlaceholders(savedData);
        applySavedData(normalizedSavedData, toSave as TravelFormData, {
          preserveEditingState: true,
        });
        autosaveCancelPendingRef.current?.();
        if (!dataOverride) {
          showToast(i18nT('shared:hooks.useTravelFormPersistence.sohraneno_6f40d98d'));
        }
        return savedData;
      } catch (error) {
        // Сохранение не удалось — пользователь остаётся на странице, поэтому снова
        // разрешаем тосты автосейва (иначе после неудачной публикации/модерации
        // последующие ошибки автосейва станут «немыми» до конца сессии).
        suppressAutosaveErrorToastRef.current = false;
        if ((error as Error)?.message === 'Request aborted') {
          throw error;
        }
        const rawDetails =
          error instanceof ApiError
            ? error.message
            : getErrorMessage(error);
        // Маппинг известной серверной ошибки (англ. текст DRF) в локализованное
        // RU-сообщение. Ошибка модерации-публикации означает, что контент сохранён
        // как черновик, но переход в «опубликовано» отклонён — данные НЕ потеряны,
        // поэтому заголовок «Ошибка сохранения» здесь неверен.
        const mappedRu = rawDetails ? mapKnownServerErrorToRu(rawDetails) : null;
        // isPublishIntent объявлен в try-блоке выше — в catch он вне области видимости,
        // поэтому пересчитываем локально.
        const isPublishIntent = options?.intent === 'publish';
        const isModerationPublishError = mappedRu != null && isPublishIntent;
        const localizedDetails = rawDetails
          ? getLocalizedSaveErrorDetails(error, rawDetails)
          : undefined;

        const toastTitle = isModerationPublishError
          ? i18nT('shared:hooks.useTravelFormPersistence.sohraneno_kak_chernovik_6a776ece')
          : i18nT('shared:hooks.useTravelFormPersistence.oshibka_sohraneniya_009a0024');
        const toastText = mappedRu
          ?? localizedDetails
          ?? i18nT('shared:hooks.useTravelFormPersistence.poprobuyte_esche_raz_b527c579');

        void showToastMessage({
          type: isModerationPublishError ? 'info' : 'error',
          text1: toastTitle,
          text2: toastText,
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

        // Хвостовой сейв: если во время этого сейва пришёл новый override, прогоняем
        // его один раз теперь, когда in-flight-refs сброшены (иначе бы снова дедупнулся).
        const queued = queuedManualSaveRef.current;
        if (queued) {
          queuedManualSaveRef.current = null;
          if (mountedRef.current) {
            void handleManualSaveRef.current?.(queued.dataOverride, queued.options);
          }
        }
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
    mountedRef,
    saveAbortControllerRef,
    setIsManualSaveInFlight,
    suppressAutosaveErrorToastRef,
    serverTextBaselineRef,
    stableTravelId,
  ]);

  // Стабильная ссылка на последнюю версию handleManualSave — чтобы хвостовой сейв
  // (queuedManualSaveRef) в finally не замыкал устаревшую копию колбэка.
  handleManualSaveRef.current = handleManualSave;

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
