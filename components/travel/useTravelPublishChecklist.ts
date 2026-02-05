import { useMemo } from 'react';
import type { TravelFormData } from '@/src/types/types';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { getQualityScore } from '@/utils/travelWizardValidation';

type UnknownRecord = Record<string, unknown>;

type ChecklistItem = {
  key: string;
  label: string;
  detail?: string;
  benefit?: string;
  ok: boolean;
  required?: boolean;
};

const getLegacyArray = (data: UnknownRecord, key: string): unknown[] => {
  const value = data[key];
  return Array.isArray(value) ? value : [];
};

export const useTravelPublishChecklist = (formData: TravelFormData) => {
  const routePoints = useMemo(() => {
    const data = formData as unknown as UnknownRecord;
    const coords = getLegacyArray(data, 'coordsMeTravel');
    if (coords.length > 0) return coords;
    return getLegacyArray(data, 'markers');
  }, [formData]);

  const galleryItems = useMemo(() => {
    const gallery = (formData.gallery ?? []) as unknown[];
    return Array.isArray(gallery) ? gallery : [];
  }, [formData.gallery]);

  const requiredChecklist = useMemo<ChecklistItem[]>(() => {
    const hasName = !!formData.name && formData.name.trim().length >= 3;
    const hasDescription = !!formData.description && formData.description.trim().length >= 50;
    const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
    const hasCategories = Array.isArray(formData.categories) && formData.categories.length > 0;
    const hasRoute = routePoints.length > 0;
    const hasCover = !!formData.travel_image_thumb_small_url;
    const hasPhotos = hasCover || galleryItems.length > 0;

    return [
      { key: 'name', label: 'Название маршрута', detail: 'Минимум 3 символа', ok: hasName, required: true },
      { key: 'description', label: 'Описание маршрута', detail: 'Минимум 50 символов', ok: hasDescription, required: true },
      { key: 'route', label: 'Маршрут на карте', detail: 'Минимум 1 точка (шаг 2)', ok: hasRoute, required: true },
      { key: 'countries', label: 'Страны маршрута', detail: 'Минимум 1 страна (шаг 2)', ok: hasCountries, required: true },
      { key: 'categories', label: 'Категории маршрута', detail: 'Минимум 1 категория (шаг 5)', ok: hasCategories, required: true },
      { key: 'photos', label: 'Фото или обложка', detail: 'Обложка или ≥1 фото (шаг 3)', ok: hasPhotos, required: true },
    ];
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems.length,
    routePoints.length,
  ]);

  const recommendedChecklist = useMemo<ChecklistItem[]>(() => {
    const hasPlus = !!formData.plus && formData.plus.trim().length >= 10;
    const hasMinus = !!formData.minus && formData.minus.trim().length >= 10;
    const hasRecommendation = !!formData.recommendation && formData.recommendation.trim().length >= 10;
    const hasVideo = !!formData.youtube_link && formData.youtube_link.trim().length > 0;
    const hasGallery3 = galleryItems.length >= 3;

    return [
      { key: 'plus', label: 'Плюсы маршрута', detail: 'Опишите преимущества (шаг 4)', benefit: 'Повышает доверие читателей', ok: hasPlus },
      { key: 'minus', label: 'Минусы маршрута', detail: 'Укажите недостатки (шаг 4)', benefit: 'Помогает принять решение', ok: hasMinus },
      { key: 'recommendation', label: 'Рекомендации и лайфхаки', detail: 'Поделитесь советами (шаг 4)', benefit: 'Увеличивает ценность маршрута', ok: hasRecommendation },
      { key: 'gallery3', label: 'Минимум 3 фото в галерее', detail: `Сейчас: ${galleryItems.length} фото (шаг 3)`, benefit: 'Маршруты с фото получают больше просмотров', ok: hasGallery3 },
      { key: 'video', label: 'Видео о путешествии', detail: 'YouTube-ссылка (шаг 3)', benefit: 'Видео повышает вовлечённость', ok: hasVideo },
    ];
  }, [formData.plus, formData.minus, formData.recommendation, formData.youtube_link, galleryItems.length]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    const hasName = !!formData.name && formData.name.trim().length > 0;
    const hasDescription = !!formData.description && formData.description.trim().length > 0;
    const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
    const hasCategories = Array.isArray(formData.categories) && formData.categories.length > 0;
    const hasRoute = routePoints.length > 0;
    const hasCover = !!formData.travel_image_thumb_small_url;
    const hasPhotos = hasCover || galleryItems.length > 0;

    return [
      { key: 'name', label: 'Название маршрута (не менее 3 символов)', ok: hasName },
      { key: 'description', label: 'Описание для кого маршрут и чего ожидать (не менее 50 символов)', ok: hasDescription },
      { key: 'countries', label: 'Страны маршрута (минимум одна, выбираются на шаге "Маршрут")', ok: hasCountries },
      { key: 'categories', label: 'Категории маршрута (минимум одна, выбираются на шаге "Доп. параметры")', ok: hasCategories },
      { key: 'route', label: 'Маршрут на карте (минимум одна точка на шаге "Маршрут")', ok: hasRoute },
      { key: 'photos', label: 'Фото или обложка маршрута (рекомендуем горизонтальное изображение, без коллажей)', ok: hasPhotos },
    ];
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems.length,
    routePoints.length,
  ]);

  const moderationIssues = useMemo(() => {
    return getModerationIssues({
      name: formData.name ?? '',
      description: formData.description ?? '',
      countries: formData.countries ?? [],
      categories: formData.categories ?? [],
      coordsMeTravel: routePoints,
      gallery: galleryItems,
      travel_image_thumb_small_url: formData.travel_image_thumb_small_url ?? null,
    });
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems,
    routePoints,
  ]);

  const moderationIssuesByKey = useMemo(() => {
    const map = new Map<string, ModerationIssue>();
    moderationIssues.forEach((issue) => map.set(issue.key, issue));
    return map;
  }, [moderationIssues]);

  const qualityScore = useMemo(() => getQualityScore(formData), [formData]);

  return {
    routePoints,
    galleryItems,
    requiredChecklist,
    recommendedChecklist,
    checklist,
    moderationIssues,
    moderationIssuesByKey,
    qualityScore,
  };
};
