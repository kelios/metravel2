import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { fetchTravel } from '@/src/api/travelsApi';
import { saveFormData } from '@/src/api/misc';
import { TravelFormData, Travel, MarkerData } from '@/src/types/types';
import { useOptimizedFormState } from '@/hooks/useOptimizedFormState';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';
import {
  getEmptyFormData,
  transformTravelToFormData,
  syncCountriesFromMarkers,
  cleanEmptyFields,
  normalizeTravelId,
  checkTravelEditAccess,
} from '@/utils/travelFormUtils';

interface UseTravelFormDataOptions {
  travelId: string | null;
  isNew: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
}

export function useTravelFormData(options: UseTravelFormDataOptions) {
  const { travelId, isNew, userId, isSuperAdmin, isAuthenticated, authReady } = options;
  const router = useRouter();
  const stableTravelId = useMemo(() => {
    if (isNew) return null;
    return travelId ? normalizeTravelId(travelId) : null;
  }, [isNew, travelId]);

  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isManualSaveInFlight, setIsManualSaveInFlight] = useState(false);
  const [_dataVersion, setDataVersion] = useState<number>(0); // ✅ FIX: Версионирование для конфликтов (будет использоваться для обнаружения конфликтов редактирования)

  const initialFormData = getEmptyFormData(isNew ? null : String(travelId));
  const formDataRef = useRef<TravelFormData>(initialFormData);
  const saveAbortControllerRef = useRef<AbortController | null>(null); // ✅ FIX: Race condition защита
  const manualSavePromiseRef = useRef<Promise<TravelFormData | void> | null>(null);
  const mountedRef = useRef(true); // ✅ FIX: Защита от memory leak
  const initialLoadKeyRef = useRef<string | null>(null);

  const formState = useOptimizedFormState(initialFormData, {
    debounce: 5000,
    validateOnChange: true,
    validationDebounce: 300,
  });

  useEffect(() => {
    formDataRef.current = formState.data as TravelFormData;
  }, [formState.data]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type,
      text1: message,
    });
  }, []);

  const DRAFT_PLACEHOLDER_PREFIX = '__draft_placeholder__';

  const ensureRequiredDraftFields = useCallback((payload: TravelFormData) => {
    const normalized: TravelFormData = { ...payload };
    // ✅ FIX: Более безопасный placeholder без раскрытия ID
    const draftPlaceholder = DRAFT_PLACEHOLDER_PREFIX;
    const arrayFields: Array<keyof TravelFormData> = [
      'categories',
      'transports',
      'month',
      'complexity',
      'companions',
      'over_nights_stay',
      'countries',
      'thumbs200ForCollectionArr',
      'travelImageThumbUrlArr',
      'travelImageAddress',
    ];
    const stringFields: Array<keyof TravelFormData> = [
      'minus',
      'plus',
      'recommendation',
      'description',
      'youtube_link',
    ];
    const booleanFields: Array<keyof TravelFormData> = ['publish', 'visa', 'moderation'];

    arrayFields.forEach(field => {
      if (!Array.isArray(normalized[field])) {
        (normalized as any)[field] = [];
      }
    });

    booleanFields.forEach(field => {
      const value = normalized[field];
      if (typeof value !== 'boolean') {
        const valueAny: any = value;
        if (valueAny === 'false' || valueAny === '0' || valueAny === 0) {
          (normalized as any)[field] = false;
        } else if (valueAny === 'true' || valueAny === '1' || valueAny === 1) {
          (normalized as any)[field] = true;
        } else {
          (normalized as any)[field] = Boolean(value);
        }
      }
    });

    const isDraft = !normalized.publish && !normalized.moderation;

    stringFields.forEach(field => {
      const value = normalized[field];
      const isBlank =
        value == null ||
        (typeof value === 'string' && value.trim().length === 0);
      if (isBlank) {
        (normalized as any)[field] = isDraft ? draftPlaceholder : '';
      }
    });

    return normalized;
  }, []);

  const normalizeDraftPlaceholders = useCallback((payload: TravelFormData) => {
    const normalized: TravelFormData = { ...payload };
    const stringFields: Array<keyof TravelFormData> = [
      'minus',
      'plus',
      'recommendation',
      'description',
      'youtube_link',
    ];

    stringFields.forEach(field => {
      const value = normalized[field];
      if (typeof value === 'string' && value.startsWith(DRAFT_PLACEHOLDER_PREFIX)) {
        (normalized as any)[field] = '';
        return;
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        (normalized as any)[field] = '';
      }
    });

    return normalized;
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
              image: imageValue && imageValue.length > 0 ? imageValue : null,
            };
          })
        : [];

      const resolvedId = normalizeTravelId(mergedData.id) ?? stableTravelId ?? null;
      const cleanedData = cleanEmptyFields({
        ...mergedData,
        id: resolvedId,
        coordsMeTravel: normalizedMarkers,
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
  }, [ensureRequiredDraftFields, stableTravelId]);

  const applySavedData = useCallback(
    (savedData: TravelFormData) => {
      // ✅ FIX: Проверяем монтирование перед обновлением состояния
      if (!mountedRef.current) return;

      const normalizedSavedData = normalizeDraftPlaceholders(savedData);
      const markersFromResponse = Array.isArray(normalizedSavedData.coordsMeTravel)
        ? (normalizedSavedData.coordsMeTravel as any)
        : [];
      const currentMarkers = Array.isArray(formState.data.coordsMeTravel) ? (formState.data.coordsMeTravel as any) : [];
      // Если бэкенд не вернул точки (например, черновик без coords в ответе), сохраняем локальные маркеры.
      const effectiveMarkers = markersFromResponse.length > 0 ? markersFromResponse : currentMarkers;
      const syncedCountries = syncCountriesFromMarkers(effectiveMarkers, normalizedSavedData.countries || []);

      formState.updateFields({
        ...normalizedSavedData,
        countries: syncedCountries,
        coordsMeTravel: effectiveMarkers,
      });
      setMarkers(effectiveMarkers);

      // ✅ FIX: Обновляем версию данных при получении с сервера
      setDataVersion(prev => prev + 1);
    },
    [formState, normalizeDraftPlaceholders]
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
    onSave: cleanAndSave,
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    enabled: isAuthenticated && hasAccess && !isManualSaveInFlight,
  });

  const handleManualSave = useCallback(async (dataOverride?: TravelFormData) => {
    if (manualSavePromiseRef.current) {
      return manualSavePromiseRef.current;
    }

    setIsManualSaveInFlight(true);
    const promise = (async () => {
      try {
        // Отменяем отложенный автосейв, чтобы не отправить старые данные (publish=false) после ручного сохранения.
        autosave?.cancelPending?.();
        const toSave = (dataOverride ?? (formState.data as TravelFormData)) as TravelFormData;
        // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
        const savedData = await cleanAndSave(toSave);
        const normalizedSavedData = normalizeDraftPlaceholders(savedData);
        applySavedData(normalizedSavedData);
        autosave?.updateBaseline?.(normalizedSavedData);
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
        setIsManualSaveInFlight(false);
      }
    })();

    manualSavePromiseRef.current = promise;
    return promise;
  }, [applySavedData, autosave, cleanAndSave, formState.data, normalizeDraftPlaceholders, showToast]);

  const loadTravelData = useCallback(
    async (id: string) => {
      try {
        const travelData = await fetchTravel(Number(id));

        if (!travelData) {
          Toast.show({
            type: 'error',
            text1: 'Путешествие не найдено',
            text2: 'Возможно, оно было удалено или недоступно',
          });
          router.replace('/');
          setHasAccess(false);
          return;
        }

        if (!isNew && travelData) {
          const canEdit = checkTravelEditAccess(travelData, userId, isSuperAdmin);

          if (!canEdit) {
            Toast.show({
              type: 'error',
              text1: 'Нет доступа',
              text2: 'Вы можете редактировать только свои путешествия',
            });
            router.replace('/');
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
        formState.updateFields(finalData);
        setMarkers(markersFromData);

        autosave.updateBaseline(finalData);
      } catch (error) {
        console.error('Ошибка загрузки путешествия:', error);
        Toast.show({
          type: 'error',
          text1: 'Ошибка загрузки',
          text2: 'Не удалось загрузить путешествие',
        });
        router.replace('/');
      } finally {
        setIsInitialLoading(false);
      }
    },
    [autosave, formState, isNew, normalizeDraftPlaceholders, router, userId, isSuperAdmin]
  );


  // ✅ FIX: Cleanup на размонтирование
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
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
      loadTravelData(travelId as string);
    } else if (isNew) {
      setHasAccess(true);
      setIsInitialLoading(false);
    }
  }, [authReady, travelId, isNew, loadTravelData]);

  const handleCountrySelect = useCallback(
    (countryId: string) => {
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
      const id = String(countryId);
      const current = (formState.data.countries || []).map(String);
      formState.updateField('countries', current.filter(c => c !== id));
    },
    [formState]
  );

  const setFormData = useCallback<React.Dispatch<React.SetStateAction<TravelFormData>>>(
    updater => {
      if (typeof updater === 'function') {
        const next = updater(formDataRef.current);
        formState.updateFields(next);
      } else {
        formState.updateFields(updater as Partial<TravelFormData>);
      }
    },
    [formState]
  );

  const handleMarkersUpdate = useCallback(
    (updatedMarkers: MarkerData[]) => {
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
    autosave,
    handleManualSave,
    handleCountrySelect,
    handleCountryDeselect,
    formState,
  };
}
