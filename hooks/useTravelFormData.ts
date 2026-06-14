import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import { useRouter, type Href } from 'expo-router';
import { QueryClientContext } from '@tanstack/react-query';
import { fetchTravel } from '@/api/travelsApi';
import { ApiError } from '@/api/client';
import { TravelFormData, Travel, MarkerData } from '@/types/types';
import { useFormState } from '@/hooks/useFormState';
import {
  getEmptyFormData,
  transformTravelToFormData,
  syncCountriesFromMarkers,
  normalizeTravelId,
  checkTravelEditAccess,
} from '@/utils/travelFormUtils';
import { normalizeDraftPlaceholders } from '@/utils/travelFormNormalization';
import { showToastMessage } from '@/utils/toast';
import { useMarkerImageUpload } from '@/hooks/useMarkerImageUpload';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';

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
  const [isManualSaveInFlight, setIsManualSaveInFlight] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const manualSaveInFlightRef = useRef(false);
  const manualSavePromiseRef = useRef<Promise<TravelFormData | void> | null>(null);
  const suppressAutosaveErrorToastRef = useRef(false);
  const mountedRef = useRef(true);
  const initialLoadKeyRef = useRef<string | null>(null);
  const pendingBaselineRef = useRef<TravelFormData | null>(null);
  const didInvalidateAfterCreateRef = useRef(false);
  // Каждый вызов loadTravelData увеличивает epoch. Если loadKey меняется (например,
  // userId приходит после authReady и запускается повторная загрузка), более старый
  // fetchTravel не должен затирать state/hasAccess, выставленные более новой загрузкой.
  const loadRequestIdRef = useRef(0);
  // ✅ FIX: Выносим updateBaseline в ref чтобы избежать stale closure
  const updateBaselineRef = useRef<((data: TravelFormData) => void) | null>(null);

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

  const { rehydrateMarkerIdsFromServer, uploadPendingMarkerImages } = useMarkerImageUpload({
    formDataRef,
    updateFormMarkers: useCallback((updatedMarkers: MarkerData[], _nextFormData: TravelFormData) => {
      setMarkers(updatedMarkers);
      formState.updateField('coordsMeTravel', updatedMarkers);
    }, [formState]),
    updateBaseline: useCallback((data: TravelFormData) => {
      updateBaselineRef.current?.(data);
    }, []),
  });

  const { autosave, handleManualSave } = useTravelFormPersistence({
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
  });

  const loadTravelData = useCallback(
    async (id: string) => {
      const requestId = ++loadRequestIdRef.current;
      try {
        setLoadError(null);
        const travelData = await fetchTravel(Number(id));

        // Поздний ответ после ухода со страницы не должен дёргать state/reset формы.
        if (!mountedRef.current) return;
        // Более новая загрузка (например, после прихода userId) уже выставила state —
        // устаревший ответ не должен его перетирать (в т.ч. сбрасывать hasAccess).
        if (requestId !== loadRequestIdRef.current) return;

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
        const markersFromData = Array.isArray(transformed.coordsMeTravel)
          ? (transformed.coordsMeTravel as MarkerData[])
          : [];
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
        // Устаревшая/вытесненная загрузка не должна навигировать или менять state.
        if (!mountedRef.current || requestId !== loadRequestIdRef.current) return;
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
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}&intent=edit-travel` as Href);
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
      // Отменяем все pending запросы.
      // Намеренно читаем текущий контроллер на момент размонтирования, а не снапшот при setup.
      if (saveAbortControllerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        saveAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    // userId/isSuperAdmin входят в ключ: если userId приходит асинхронно после authReady,
    // первичная загрузка с userId=null зафиксировала бы hasAccess=false навсегда (гард по ключу).
    // Смена ключа при появлении userId перезапускает загрузку и выдаёт доступ к своему travel.
    const loadKey = `${String(travelId ?? 'new')}|${userId ?? ''}|${isSuperAdmin ? '1' : '0'}`;
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
  }, [authReady, travelId, isNew, userId, isSuperAdmin, loadTravelData]);

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
      formState.updateField('coordsMeTravel', updatedMarkers);
    },
    [formState]
  );

  const getFormData = useCallback(() => formDataRef.current, []);

  return useMemo(() => ({
    formData: formState.data,
    getFormData,
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
    getFormData,
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
