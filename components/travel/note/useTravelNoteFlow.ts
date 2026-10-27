import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LocationSearchResult } from '@/api/geoQueries';
import type { GalleryValueItem } from '@/components/travel/gallery/types';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import type { MarkerData, TravelFormData } from '@/types/types';
import { translate as i18nT } from '@/i18n';
import type { ModerationIssue } from '@/utils/formValidation';
import { buildPointTitleFromGeocode, matchCountryId } from '@/utils/geocodeHelpers';
import {
  trackRouteCreatePublishAttempted,
  trackRouteCreatePublishBlocked,
  trackRouteCreatePublishFailed,
  trackRouteCreatePublishSucceeded,
} from '@/utils/growthFunnelAnalytics';
import { hapticNotification } from '@/utils/haptics';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { showToastMessage } from '@/utils/toast';
import { normalizeTravelId } from '@/utils/travelFormUtils';
import {
  NOTE_PHOTOS_STEP,
  NOTE_READINESS_CHECKS,
  NOTE_STORY_STEP,
  getNoteModerationIssues,
  noteHtmlToText,
  noteTextToHtml,
} from '@/utils/travelNote';

type CountryOption = UpsertTravelController['filters']['countries'][number];

export type NotePlace = {
  address: string;
  countryId: number | null;
  countryLabel: string | null;
};

const countryTitle = (country: CountryOption | undefined): string | null => {
  const record = country as { title_ru?: unknown; title?: unknown; name?: unknown } | undefined;
  const title = record?.title_ru ?? record?.title ?? record?.name;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
};

const findCountry = (countries: CountryOption[], countryId: unknown) => (countries || [])
  .find((country) => Number((country as { country_id?: unknown }).country_id) === Number(countryId));

/**
 * Состояние и команды двухэкранной заметки (#2666). Заметка — тот же Travel
 * мастера: тот же автосейв, черновик, явная команда `submit`; отличается только
 * набором полей и проверкой готовности (`getNoteModerationIssues`).
 */
export function useTravelNoteFlow(controller: UpsertTravelController) {
  const { formData, setFormData, setMarkers, handleManualSave, wizard, filters } = controller;
  const step = wizard.currentStep >= NOTE_STORY_STEP ? NOTE_STORY_STEP : NOTE_PHOTOS_STEP;
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Черновик создаётся только когда автор выбрал первое фото: галерее нужен id
  // записи, а пустой визит на страницу не должен оставлять пустых черновиков.
  const ensureTravelId = useCallback(async (): Promise<string | null> => {
    const known = normalizeTravelId(formDataRef.current.id);
    if (known != null) return String(known);
    try {
      // Override отличает этот сейв от кнопки «Сохранить» (без тоста), остальные
      // поля handleManualSave берёт из живой формы.
      const saved = await handleManualSave({ publication_format: 'note' } as TravelFormData);
      const id = saved && typeof saved === 'object' ? normalizeTravelId(saved.id) : null;
      return id != null ? String(id) : null;
    } catch {
      // handleManualSave уже показал ошибку сохранения.
      return null;
    }
  }, [handleManualSave]);

  const handleGalleryChange = useCallback((items: GalleryValueItem[]) => {
    const gallery = items
      .filter((item) => typeof item?.url === 'string' && item.url.trim())
      .map((item) => ({
        url: item.url.trim(),
        ...(item.id != null && String(item.id).trim() ? { id: item.id } : {}),
        ...(typeof item.caption === 'string' ? { caption: item.caption.slice(0, 500) } : {}),
      }));
    setFormData((prev) => {
      const current = JSON.stringify(prev.gallery ?? []);
      return current === JSON.stringify(gallery)
        ? prev
        : { ...prev, gallery: gallery as TravelFormData['gallery'] };
    });
  }, [setFormData]);

  const point = (Array.isArray(formData.coordsMeTravel) ? formData.coordsMeTravel[0] : undefined) as
    MarkerData | undefined;
  const place = useMemo<NotePlace | null>(() => {
    if (!point) return null;
    return {
      address: typeof point.address === 'string' ? point.address : '',
      countryId: point.country != null ? Number(point.country) : null,
      countryLabel: countryTitle(findCountry(filters.countries, point.country)),
    };
  }, [filters.countries, point]);

  const [placeError, setPlaceError] = useState<string | null>(null);
  const autoNameRef = useRef<string | null>(null);

  const handlePlaceSelect = useCallback((result: LocationSearchResult) => {
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const countryId = matchCountryId(
      result?.address?.country || '',
      filters.countries || [],
      result?.address?.country_code,
    );
    // Сервер принимает точку заметки только с существующей страной и ничего не
    // подставляет сам; без страны место не сохраняем и говорим об этом.
    if (countryId == null) {
      setPlaceError(i18nT('travel:components.travel.note.place.countryUnknown'));
      return;
    }
    setPlaceError(null);
    const country = findCountry(filters.countries, countryId);
    const address = buildPointTitleFromGeocode(result, { lat, lng }, country);
    const marker: MarkerData = { id: null, lat, lng, address, country: countryId, categories: [], image: null };
    const currentName = (formDataRef.current.name ?? '').trim();
    const nextName = !currentName || currentName === autoNameRef.current ? address : formDataRef.current.name;
    autoNameRef.current = nextName === address ? address : autoNameRef.current;

    setMarkers([marker]);
    setFormData((prev) => ({ ...prev, name: nextName ?? '', countries: [String(countryId)], coordsMeTravel: [marker] }));
    // Точку сохраняем сразу, как и мастер: так она получает id и переживает перезагрузку.
    void handleManualSave({
      countries: [String(countryId)],
      coordsMeTravel: [marker],
    } as TravelFormData).catch(() => undefined);
  }, [filters.countries, handleManualSave, setFormData, setMarkers]);

  const handleNameChange = useCallback((name: string) => {
    setFormData((prev) => ({ ...prev, name }));
  }, [setFormData]);

  // Поле рассказа — простой текст; в статью он уходит абзацами HTML, как описание мастера.
  const [storyText, setStoryText] = useState(() => noteHtmlToText(formData.description));
  const handleStoryChange = useCallback((text: string) => {
    setStoryText(text);
    setFormData((prev) => ({ ...prev, description: noteTextToHtml(text) }));
  }, [setFormData]);
  // Описание меняется и снаружи (восстановление локального черновика): тогда поле
  // берёт новый текст, иначе следующее нажатие клавиши затёрло бы восстановленный
  // рассказ. Сравнение по тексту, а не по HTML: свой ввод (пустые строки, пробелы)
  // и серверная нормализация разметки поле не сбрасывают.
  useEffect(() => {
    const external = noteHtmlToText(formData.description);
    setStoryText((prev) => (noteHtmlToText(noteTextToHtml(prev)) === external ? prev : external));
  }, [formData.description]);

  const [issues, setIssues] = useState<ModerationIssue[]>([]);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitPendingRef = useRef(false);

  // Подсказки после неудачной попытки обновляются по мере того, как автор их закрывает.
  useEffect(() => {
    setIssues((prev) => (prev.length > 0 ? getNoteModerationIssues(formData) : prev));
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (submitPendingRef.current) return;
    submitPendingRef.current = true;
    const current = formDataRef.current;
    const isNew = normalizeTravelId(current.id) == null;
    const missing = getNoteModerationIssues(current);
    trackRouteCreatePublishAttempted({
      mode: 'note',
      travelId: current.id,
      step,
      isNew,
      missingFieldsCount: missing.length,
    });
    if (missing.length > 0) {
      trackRouteCreatePublishBlocked({
        mode: 'note',
        travelId: current.id,
        step,
        missingFieldsCount: missing.length,
        firstMissingField: missing[0]?.key,
      });
      setIssues(missing);
      hapticNotification('warning');
      submitPendingRef.current = false;
      return;
    }

    setIssues([]);
    setIsSubmitting(true);
    try {
      const saved = await handleManualSave(current, { intent: 'submit' });
      if (!saved) return;
      const savedId = normalizeTravelId(typeof saved === 'object' ? saved.id : null) ?? normalizeTravelId(current.id);
      if (savedId == null) {
        trackRouteCreatePublishFailed({ mode: 'note', travelId: current.id, step, errorType: 'missing_saved_id' });
        void showToastMessage({
          type: 'error',
          text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otpravit_46d67527'),
          text2: i18nT('travel:components.travel.TravelWizardStepPublish.sohranenie_ne_udalos_proverte_internet_i_pop_ab095dd2'),
        });
        return;
      }
      trackRouteCreatePublishSucceeded({
        mode: 'note',
        travelId: savedId,
        step,
        checklistCompletedCount: NOTE_READINESS_CHECKS,
        checklistTotalCount: NOTE_READINESS_CHECKS,
      });
      hapticNotification('success');
      await wizard.clearPersistedStep();
      setSubmittedId(String(savedId));
    } catch (error) {
      trackRouteCreatePublishFailed({ mode: 'note', travelId: current.id, step, errorType: 'save_failed' });
      hapticNotification('error');
      if (!hasToastBeenShown(error)) {
        void showToastMessage({
          type: 'error',
          text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otpravit_46d67527'),
          text2: error instanceof Error
            ? error.message
            : i18nT('travel:components.travel.TravelWizardStepPublish.proverte_internet_i_poprobuyte_esche_raz_415d3732'),
        });
      }
    } finally {
      setIsSubmitting(false);
      submitPendingRef.current = false;
    }
  }, [handleManualSave, step, wizard]);

  return {
    step,
    ensureTravelId,
    handleGalleryChange,
    place,
    placeError,
    handlePlaceSelect,
    handleNameChange,
    storyText,
    handleStoryChange,
    issues,
    isSubmitting,
    submittedId,
    handleSubmit,
  };
}
