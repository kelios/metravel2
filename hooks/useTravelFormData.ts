import { useCallback, useEffect, useRef, useState } from 'react';
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

  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isManualSaveInFlight, setIsManualSaveInFlight] = useState(false);

  const initialFormData = getEmptyFormData(isNew ? null : String(travelId));
  const formDataRef = useRef<TravelFormData>(initialFormData);

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

  const cleanAndSave = useCallback(async (data: TravelFormData) => {
    const normalizedMarkers = Array.isArray((data as any).coordsMeTravel)
      ? (data as any).coordsMeTravel.map((m: any) => ({
          ...m,
          categories: Array.isArray(m?.categories)
            ? m.categories
                .map((c: any) => Number(c))
                .filter((n: number) => Number.isFinite(n))
            : [],
        }))
      : [];

    const cleanedData = cleanEmptyFields({
      ...data,
      id: normalizeTravelId(data.id),
      coordsMeTravel: normalizedMarkers,
    });

    return await saveFormData(cleanedData);
  }, []);

  const applySavedData = useCallback(
    (savedData: TravelFormData) => {
      const markersFromResponse = Array.isArray(savedData.coordsMeTravel) ? (savedData.coordsMeTravel as any) : [];
      const currentMarkers = Array.isArray(formState.data.coordsMeTravel) ? (formState.data.coordsMeTravel as any) : [];
      // Если бэкенд не вернул точки (например, черновик без coords в ответе), сохраняем локальные маркеры.
      const effectiveMarkers = markersFromResponse.length > 0 ? markersFromResponse : currentMarkers;
      const syncedCountries = syncCountriesFromMarkers(effectiveMarkers, savedData.countries || []);

      formState.updateFields({
        ...savedData,
        countries: syncedCountries,
        coordsMeTravel: effectiveMarkers,
      });
      setMarkers(effectiveMarkers);
    },
    [formState]
  );

  const handleSaveSuccess = useCallback(
    (savedData: TravelFormData) => {
      // После первого автосейва создаётся id — остаёмся в мастере и просто подставляем новые данные.
      applySavedData(savedData);
    },
    [applySavedData]
  );

  const handleSaveError = useCallback(
    (error: Error) => {
      showToast('Ошибка автосохранения', 'error');
      console.error('Autosave error:', error);
    },
    [showToast]
  );

  const autosave = useImprovedAutoSave(formState.data, initialFormData, {
    debounce: 5000,
    onSave: cleanAndSave,
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
    enabled: isAuthenticated && hasAccess && !isManualSaveInFlight,
  });

  const handleManualSave = useCallback(async (dataOverride?: TravelFormData) => {
    setIsManualSaveInFlight(true);
    try {
      // Отменяем отложенный автосейв, чтобы не отправить старые данные (publish=false) после ручного сохранения.
      autosave?.cancelPending?.();
      const toSave = (dataOverride ?? (formState.data as TravelFormData)) as TravelFormData;
      // Если пришли извне готовые данные — сохраняем напрямую, минуя отложенный стейт.
      const savedData = await cleanAndSave(toSave);
      applySavedData(savedData);
      autosave?.updateBaseline?.(savedData);
      autosave?.cancelPending?.();
      showToast('Сохранено');
      return savedData;
    } catch (error) {
      showToast('Ошибка сохранения', 'error');
      console.error('Manual save error:', error);
      return;
    } finally {
      setIsManualSaveInFlight(false);
    }
  }, [applySavedData, cleanAndSave, formState.data, showToast]);

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

        const transformed = transformTravelToFormData(travelData);
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
    [autosave, formState, isNew, router, userId, isSuperAdmin]
  );

  const initialLoadKeyRef = useRef<string | null>(null);
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
