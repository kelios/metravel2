import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchTravel } from '@/api/travelsApi';
import { saveFormData } from '@/api/misc';
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
} from '@/utils/travelFormUtils';
import { showToast } from '@/utils/toast';
import { ApiError } from '@/api/client';
import {
  isLocalPreviewUrl,
  mergeMarkersPreserveImages,
  ensureRequiredDraftFields,
  normalizeDraftPlaceholders,
  isDraftPlaceholder,
} from '@/utils/travelFormNormalization';

async function showToastMessage(payload: any) {
  await showToast(payload);
}

interface UseTravelFormDataOptions {
  travelId: string | null;
  isNew: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
  onAuthRequired?: (context: { redirect: string }) => void | Promise<void>;
}

export function useTravelFormData(options: UseTravelFormDataOptions) {
  const { travelId, isNew, userId, isSuperAdmin, isAuthenticated, authReady, onAuthRequired } = options;
  const router = useRouter();
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


  const cleanAndSave = useCallback(async (data: TravelFormData) => {
    // ✅ FIX: Отменяем предыдущий запрос для предотвращения race condition
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }

    // Создаём новый контроллер для этого запроса
    const abortController = new AbortController();
    saveAbortControllerRef.current = abortController;

    try {
      const baseFormData = getEmptyFormData(data?.id ? String(data.id) : null);
      const mergedData = {
        ...baseFormData,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
      } as TravelFormData;

      // Normalize nullable string fields (backend expects strings; null breaks drafts and can wipe UI after save)
      ([
        'name',
        'budget',
        'year',
        'number_peoples',
        'number_days',
        'minus',
        'plus',
        'recommendation',
        'description',
        'youtube_link',
      ] as Array<keyof TravelFormData>).forEach((key) => {
        const value = mergedData[key];
        if (value == null) {
          (mergedData as any)[key] = '';
        }
      });

      const normalizedMarkers = Array.isArray((mergedData as any).coordsMeTravel)
        ? (mergedData as any).coordsMeTravel.map((m: any) => {
            const { image, ...rest } = m ?? {};
            // ✅ ИСПРАВЛЕНИЕ: Бэкенд требует ключ image, но не принимает пустую строку.
            // Поэтому всегда отправляем `image: null`, если нет валидного значения.
            const imageValue = typeof image === 'string' ? image.trim() : '';
            const categories = Array.isArray(m?.categories)
              ? m.categories
                  .map((c: any) => Number(c))
                  .filter((n: number) => Number.isFinite(n))
              : [];

            return {
              ...rest,
              categories,
              image:
                imageValue && imageValue.length > 0 && !isLocalPreviewUrl(imageValue)
                  ? imageValue
                  : null,
            };
          })
        : [];

      const normalizedGallery = Array.isArray(mergedData.gallery)
        ? mergedData.gallery.filter((item: any) => {
            if (typeof item === 'string') {
              const value = item.trim();
              return value.length > 0 && !isLocalPreviewUrl(value);
            }
            if (item && typeof item === 'object') {
              const url = typeof item.url === 'string' ? item.url.trim() : '';
              return url.length > 0 && !isLocalPreviewUrl(url);
            }
            return false;
          })
        : undefined;

      const sanitizedCoverUrl = isLocalPreviewUrl(mergedData.travel_image_thumb_url)
        ? null
        : (mergedData.travel_image_thumb_url ?? null);
      const sanitizedCoverSmallUrl = isLocalPreviewUrl(mergedData.travel_image_thumb_small_url)
        ? null
        : (mergedData.travel_image_thumb_small_url ?? null);

      const resolvedId = normalizeTravelId(mergedData.id) ?? stableTravelId ?? null;
      const cleanedData = cleanEmptyFields({
        ...mergedData,
        id: resolvedId,
        coordsMeTravel: normalizedMarkers,
        ...(normalizedGallery ? { gallery: normalizedGallery } : {}),
        travel_image_thumb_url: sanitizedCoverUrl,
        travel_image_thumb_small_url: sanitizedCoverSmallUrl,
      });

      // Не отправляем на сервер неформатные поля (например, вложенный `user` из ответа API),
      // иначе DRF сериализатор может начать валидировать profile/user поля (first_name и т.п.).
      const allowedKeys = new Set<string>([
        ...Object.keys(baseFormData),
        'slug',
        'travel_image_thumb_url',
        'travel_image_thumb_small_url',
      ]);

      const filteredCleanedData = Object.fromEntries(
        Object.entries(cleanedData).filter(([key]) => allowedKeys.has(key))
      ) as Partial<TravelFormData>;

      const payload = ensureRequiredDraftFields(filteredCleanedData as unknown as TravelFormData);

      // ✅ FIX: Проверяем, что компонент всё ещё смонтирован перед сохранением
      if (!mountedRef.current) {
        throw new Error('Component unmounted');
      }

      const result = await saveFormData(payload, abortController.signal);

      // ✅ FIX: Проверяем, что запрос не был отменён
      if (abortController.signal.aborted) {
        throw new Error('Request aborted');
      }

      return result;
    } catch (error) {
      const errAny: any = error;
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
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      const normalizedSavedData = normalizeDraftPlaceholders(savedData);
      const currentDataSnapshot = formState.data as TravelFormData;

      const keepCurrentIfServerEmpty = <K extends keyof TravelFormData>(key: K) => {
        const serverValue = normalizedSavedData[key];
        const currentValue = currentDataSnapshot[key];
        if (typeof serverValue === 'string' && serverValue.trim().length === 0) {
          if (typeof currentValue === 'string' && currentValue.trim().length > 0) {
            (normalizedSavedData as any)[key] = currentValue;
          }
        }
      };

      const keepCurrentIfServerNil = <K extends keyof TravelFormData>(key: K) => {
        const serverValue = (normalizedSavedData as any)[key];
        const currentValue = (currentDataSnapshot as any)[key];
        if (serverValue == null) {
          if (typeof currentValue === 'string' && currentValue.trim().length > 0) {
            (normalizedSavedData as any)[key] = currentValue;
          }
        }
      };

      const keepCurrentIfServerEmptyArray = <K extends keyof TravelFormData>(key: K) => {
        const serverValue = (normalizedSavedData as any)[key];
        const currentValue = (currentDataSnapshot as any)[key];
        if (Array.isArray(serverValue) && serverValue.length === 0) {
          if (Array.isArray(currentValue) && currentValue.length > 0) {
            (normalizedSavedData as any)[key] = currentValue;
          }
        }
      };

      const keepCurrentIfServerNilArray = <K extends keyof TravelFormData>(key: K) => {
        const serverValue = (normalizedSavedData as any)[key];
        const currentValue = (currentDataSnapshot as any)[key];
        if (serverValue == null) {
          if (Array.isArray(currentValue) && currentValue.length > 0) {
            (normalizedSavedData as any)[key] = currentValue;
          }
        }
      };

      const keepCurrentIfServerMissingImageUrl = <K extends keyof TravelFormData>(key: K) => {
        const serverValue = (normalizedSavedData as any)[key];
        const currentValue = (currentDataSnapshot as any)[key];
        if (serverValue == null || (typeof serverValue === 'string' && serverValue.trim().length === 0)) {
          if (typeof currentValue === 'string' && currentValue.trim().length > 0) {
            // ✅ FIX: Сохраняем локальное превью ИЛИ серверный URL если сервер вернул пустое значение
            (normalizedSavedData as any)[key] = currentValue;
          }
        }
      };

      // If backend returns placeholders/empty strings for rich text fields, don't wipe user input.
      keepCurrentIfServerEmpty('description');
      keepCurrentIfServerEmpty('plus');
      keepCurrentIfServerEmpty('minus');
      keepCurrentIfServerEmpty('recommendation');
      keepCurrentIfServerEmpty('youtube_link');
      keepCurrentIfServerNil('description');
      keepCurrentIfServerNil('plus');
      keepCurrentIfServerNil('minus');
      keepCurrentIfServerNil('recommendation');
      keepCurrentIfServerNil('youtube_link');
      keepCurrentIfServerNil('name');

      // If backend returns empty arrays for filter fields, don't wipe user selections.
      keepCurrentIfServerEmptyArray('categories');
      keepCurrentIfServerEmptyArray('transports');
      keepCurrentIfServerEmptyArray('complexity');
      keepCurrentIfServerEmptyArray('companions');
      keepCurrentIfServerEmptyArray('over_nights_stay');
      keepCurrentIfServerEmptyArray('month');

      // Preserve local preview images for cover/gallery while server hasn't produced permanent URLs yet.
      keepCurrentIfServerMissingImageUrl('travel_image_thumb_url');
      keepCurrentIfServerMissingImageUrl('travel_image_thumb_small_url');
      keepCurrentIfServerEmptyArray('gallery');
      keepCurrentIfServerNilArray('gallery');

      const markersFromResponse = Array.isArray(normalizedSavedData.coordsMeTravel)
        ? (normalizedSavedData.coordsMeTravel as any)
        : [];
      const currentMarkers = Array.isArray(formState.data.coordsMeTravel) ? (formState.data.coordsMeTravel as any) : [];
      // Если бэкенд не вернул точки (например, черновик без coords в ответе), сохраняем локальные маркеры.
      const effectiveMarkers = markersFromResponse.length > 0
        ? mergeMarkersPreserveImages(markersFromResponse, currentMarkers)
        : currentMarkers;
      const syncedCountries = syncCountriesFromMarkers(effectiveMarkers, normalizedSavedData.countries || []);

      const finalData = {
        ...normalizedSavedData,
        countries: syncedCountries,
        coordsMeTravel: effectiveMarkers,
      };

      pendingBaselineRef.current = finalData;
      formState.reset(finalData);
      setMarkers(effectiveMarkers);
      updateBaselineRef.current?.(finalData);
      pendingBaselineRef.current = null;

      // ✅ FIX: Обновляем версию данных при получении с сервера
      setDataVersion(prev => prev + 1);
    },
    [formState]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      // После первого автосейва создаётся id — остаёмся в мастере и просто подставляем новые данные.
      applySavedData(savedData);
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
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
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
      return await cleanAndSave(dataToSave as TravelFormData);
    },
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    // Не автосейвим, когда travel уже в "терминальном" состоянии (moderation/publish),
    // иначе получаем повторные upsert и 400 на обязательные поля.
    enabled:
      isAuthenticated &&
      hasAccess &&
      !isManualSaveInFlight &&
      !(formState.data as any)?.moderation &&
      !(formState.data as any)?.publish,
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
        const wantsToLeaveSoon = !!(dataOverride as any)?.publish || !!(dataOverride as any)?.moderation;
        if (wantsToLeaveSoon) {
          suppressAutosaveErrorToastRef.current = true;
        }

        // Отменяем отложенный автосейв, чтобы не отправить старые данные (publish=false) после ручного сохранения.
        autosave?.cancelPending?.();
        // Abort any in-flight autosave request (it will still appear in Network, but won't win the race).
        if (saveAbortControllerRef.current) {
          saveAbortControllerRef.current.abort();
        }

        const mergeWithCurrentSnapshot = (override?: TravelFormData) => {
          if (!override) return formDataRef.current as TravelFormData;
          const current = (formDataRef.current as TravelFormData) ?? ({} as TravelFormData);
          const merged: any = { ...current, ...override };

          // Preserve current values if override contains empty/null/placeholder for user-entered fields.
          (['name', 'description', 'plus', 'minus', 'recommendation', 'youtube_link'] as Array<keyof TravelFormData>).forEach((key) => {
            const o = (override as any)[key];
            const c = (current as any)[key];
            if (o == null) {
              if (c != null) merged[key] = c;
              return;
            }
            if (isDraftPlaceholder(o)) {
              if (typeof c === 'string' && c.trim().length > 0 && !isDraftPlaceholder(c)) {
                merged[key] = c;
              }
              return;
            }
            if (typeof o === 'string' && o.trim().length === 0) {
              if (typeof c === 'string' && c.trim().length > 0) {
                merged[key] = c;
              }
            }
          });

          (['categories', 'transports', 'complexity', 'companions', 'over_nights_stay', 'month', 'countries'] as Array<keyof TravelFormData>).forEach((key) => {
            const o = (override as any)[key];
            const c = (current as any)[key];
            if (Array.isArray(o) && o.length === 0) {
              if (Array.isArray(c) && c.length > 0) {
                merged[key] = c;
              }
            }
          });

          return merged as TravelFormData;
        };

        const toSave = mergeWithCurrentSnapshot(dataOverride);
        // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
        const savedData = await cleanAndSave(toSave);
        const normalizedSavedData = normalizeDraftPlaceholders(savedData);
        applySavedData(normalizedSavedData);
        autosave?.cancelPending?.();
        showToast('Сохранено');
        return savedData;
      } catch (error) {
        if ((error as Error)?.message === 'Request aborted') {
          return;
        }
        showToast('Ошибка сохранения', 'error');
        console.error('Manual save error:', error);
        return;
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
  const updateBaselineRef = useRef<((data: any) => void) | null>(null);
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
        const markersFromData = (transformed.coordsMeTravel as any) || [];
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
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}&intent=edit-travel` as any);
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
      formState.updateField('coordsMeTravel', updatedMarkers as any);
    },
    [formState]
  );

  return {
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
  };
}
