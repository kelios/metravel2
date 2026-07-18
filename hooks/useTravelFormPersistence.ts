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
import {
  getErrorMessage,
  getErrorName,
  mapKnownServerErrorToRu,
} from '@/utils/errorHelpers';
import {
  confirmRichTextLossIfNeeded,
  type RichTextSnapshot,
} from '@/utils/travelTextLossGuard';
import { translate as i18nT } from '@/i18n'


type ToastAwareError = Error & { toastShown?: boolean };
const DEFAULT_MARKER_SERIALIZER_FALLBACK_IMAGE = '/og-default.png';

// При затяжном отказе автосейва (протухшая сессия, флаки-сеть) onError зовётся
// каждый цикл дебаунса. Показываем тост «Ошибка автосохранения» не чаще раза в
// этот интервал, чтобы он не мигал/не залипал. Троттл сбрасывается после успешного
// сохранения, поэтому первая ошибка после успеха всплывает сразу.
const AUTOSAVE_ERROR_TOAST_THROTTLE_MS = 30000;

type MonitoringWindow = Window & {
  Sentry?: {
    captureException: (error: unknown, context?: Record<string, unknown>) => void;
  };
};

type GalleryEntry = string | Record<string, unknown>;

const getGalleryEntryId = (item: GalleryEntry | null | undefined) => {
  if (!item || typeof item !== 'object') return null;
  const rawId = item.id;
  if (rawId == null || String(rawId).trim().length === 0) return null;
  return String(rawId);
};

const getGalleryEntryUrl = (item: GalleryEntry | null | undefined) => {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return typeof item.url === 'string' ? item.url.trim() : '';
};

const getGalleryEntryCaption = (item: GalleryEntry | null | undefined) => {
  if (!item || typeof item !== 'object') return undefined;
  return typeof item.caption === 'string' ? item.caption : undefined;
};

const buildGalleryEntryMap = (gallery: unknown) => {
  const byId = new Map<string, GalleryEntry>();
  const byUrl = new Map<string, GalleryEntry>();
  if (!Array.isArray(gallery)) return { byId, byUrl };

  gallery.forEach((item) => {
    if (typeof item !== 'string' && (typeof item !== 'object' || item == null)) return;
    const entry = item as GalleryEntry;
    const id = getGalleryEntryId(entry);
    const url = getGalleryEntryUrl(entry);
    if (id) byId.set(id, entry);
    if (url) byUrl.set(url, entry);
  });

  return { byId, byUrl };
};

const findMatchingGalleryEntry = (
  item: GalleryEntry,
  map: ReturnType<typeof buildGalleryEntryMap>,
) => {
  const id = getGalleryEntryId(item);
  if (id && map.byId.has(id)) return map.byId.get(id);

  const url = getGalleryEntryUrl(item);
  if (url && map.byUrl.has(url)) return map.byUrl.get(url);

  return undefined;
};

function mergeGalleryPreserveCurrentCaptions(
  savedGallery: unknown,
  currentGallery: unknown,
  sourceGallery?: unknown,
) {
  if (!Array.isArray(savedGallery)) return savedGallery;

  const currentMap = buildGalleryEntryMap(currentGallery);
  const sourceMap = buildGalleryEntryMap(sourceGallery);

  return savedGallery.map((item) => {
    if (!item || typeof item !== 'object') return item;

    const savedEntry = item as Record<string, unknown>;
    const currentEntry = findMatchingGalleryEntry(savedEntry, currentMap);
    const currentCaption = getGalleryEntryCaption(currentEntry);
    if (currentCaption == null) return item;

    const savedCaption = getGalleryEntryCaption(savedEntry);
    if (savedCaption === currentCaption) return item;

    const sourceEntry = findMatchingGalleryEntry(savedEntry, sourceMap);
    const sourceCaption = getGalleryEntryCaption(sourceEntry);
    const savedCaptionMissing = savedCaption == null || savedCaption.trim().length === 0;
    const currentChangedAfterSaveStarted = sourceCaption !== currentCaption;
    const currentWasCleared = currentCaption.trim().length === 0;

    if (!savedCaptionMissing && !currentChangedAfterSaveStarted && !currentWasCleared) {
      return item;
    }

    return {
      ...savedEntry,
      caption: currentCaption.slice(0, 500),
    };
  });
}

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

  // Стабильная ссылка на autosave.cancelPending, чтобы handleManualSave не
  // пересоздавался на каждый тик статуса автосейва.
  const autosaveCancelPendingRef = useRef<(() => void) | null>(null);

  // Время последнего показанного тоста ошибки автосейва (троттлинг UI, см. константу).
  const lastAutosaveErrorToastAtRef = useRef(0);

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
      kf('visitedDate', 'nil');
      kf('visitedDate', 'emptyString');

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

      const shouldSkipFormReset =
        options?.preserveEditingState === true &&
        hadId &&
        hasId &&
        isEqual(finalData, currentDataSnapshot);

      if (shouldSkipFormReset) {
        formDataRef.current = currentDataSnapshot;
        updateBaselineRef.current?.(currentDataSnapshot);
        captureTextBaseline(currentDataSnapshot);
      } else {
        pendingBaselineRef.current = finalData;
        try {
          formState.reset(finalData);
          formDataRef.current = finalData as TravelFormData;
          setMarkers(effectiveMarkers);
          updateBaselineRef.current?.(finalData);
          captureTextBaseline(finalData as TravelFormData);
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
      captureTextBaseline,
    ]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      // Успешный сейв снимает троттл: следующая ошибка (уже нового «эпизода») покажется сразу.
      lastAutosaveErrorToastAtRef.current = 0;

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

      // Троттлим только пользовательский тост (логирование/Sentry выше — на каждый отказ,
      // чтобы мониторинг не терял события). При затяжном отказе тост не мигает.
      const now = Date.now();
      if (now - lastAutosaveErrorToastAtRef.current >= AUTOSAVE_ERROR_TOAST_THROTTLE_MS) {
        lastAutosaveErrorToastAtRef.current = now;
        showToast(i18nT('shared:hooks.useTravelFormPersistence.oshibka_avtosohraneniya_0fb98f16'), 'error');
      }
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
        applySavedData(normalizedSavedData, toSave as TravelFormData);
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

        const toastTitle = isModerationPublishError
          ? i18nT('shared:hooks.useTravelFormPersistence.sohraneno_kak_chernovik_6a776ece')
          : i18nT('shared:hooks.useTravelFormPersistence.oshibka_sohraneniya_009a0024');
        const toastText = mappedRu
          ?? (rawDetails && rawDetails !== 'Save failed' ? rawDetails : i18nT('shared:hooks.useTravelFormPersistence.poprobuyte_esche_raz_b527c579'));

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
