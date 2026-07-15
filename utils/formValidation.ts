import { translate as i18nT } from '@/i18n'
// utils/formValidation.ts
// ✅ УЛУЧШЕНИЕ: Утилиты для валидации формы создания путешествия

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface TravelFormValidation {
  name?: string;
  description?: string;
  countries?: string[];
  categories?: string[];
  coordsMeTravel?: unknown[];
  year?: string;
  number_days?: string;
  number_peoples?: string;
  youtube_link?: string;
}

// Упрощённый тип данных формы для использования в шаговой валидации
export interface TravelFormLike {
  name?: string | null;
  description?: string | null;
  countries?: string[] | null;
  categories?: string[] | null;
  coordsMeTravel?: unknown[] | null;
  // Дополнительные поля, которые могут участвовать в чек-листе модерации
  gallery?: unknown[] | null;
  travel_image_thumb_small_url?: string | null;
}

export type ModerationIssueKey =
  | 'name'
  | 'description'
  | 'countries'
  | 'categories'
  | 'route'
  | 'photos';

export interface ModerationIssue {
  key: ModerationIssueKey;
  label: string;
  targetStep: number;
  anchorId?: string;
}

/**
 * Валидация названия путешествия
 */
export function validateName(name: string | undefined | null): ValidationError | null {
  if (!name || name.trim().length === 0) {
    return {
      field: 'name',
      message: i18nT('errors:utils.formValidation.nazvanie_obyazatelno_dlya_zapolneniya_6eb95801'),
    };
  }
  if (name.trim().length < 3) {
    return {
      field: 'name',
      message: i18nT('errors:utils.formValidation.nazvanie_dolzhno_soderzhat_minimum_3_simvola_bf588f66'),
    };
  }
  if (name.trim().length > 200) {
    return {
      field: 'name',
      message: i18nT('errors:utils.formValidation.nazvanie_ne_dolzhno_prevyshat_200_simvolov_c5e64d65'),
    };
  }
  return null;
}

/**
 * Централизованная валидация шагов мастера
 *
 * Требования по ТЗ:
 *  - Шаг 1: блокируем переход только без name
 *  - Шаги 2–4: переходы не блокируются (поля проверяются при отправке на модерацию)
 *  - Шаг 5: валидация на уровне модерации (см. getModerationErrors)
 */
export function validateStep(
  step: number,
  formData: TravelFormLike,
  _markers?: unknown[] | null,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (step === 1) {
    const nameError = validateName(formData.name ?? undefined);
    if (nameError) errors.push(nameError);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Для шагов 2–4 по ТЗ валидация не должна блокировать переход
  return {
    isValid: true,
    errors: [],
  };
}

/**
 * Получить ошибки для модерации (шаг публикации)
 *
 * Критичные поля по ТЗ:
 *  - Название (name)
 *  - Описание (description)
 *  - Страны (countries)
 *  - Категории (categories)
 *  - Маршрут (минимум одна точка: coordsMeTravel или markers)
 *  - Фото (обложка или ≥1 фото в галерее)
 */
export function getModerationErrors(
  formData: TravelFormLike,
  markers?: unknown[] | null,
): string[] {
  return getModerationIssues(formData, markers).map((i) => i.label);
}

export function getModerationIssues(
  formData: TravelFormLike,
  markers?: unknown[] | null,
): ModerationIssue[] {
  const missing: ModerationIssue[] = [];

  const nameError = validateName(formData.name ?? undefined);
  if (nameError) {
    missing.push({
      key: 'name',
      label: i18nT('errors:utils.formValidation.nazvanie_569bb861'),
      targetStep: 1,
      anchorId: 'travelwizard-basic-name',
    });
  }

  const descriptionError = validateDescription(formData.description ?? undefined);
  if (descriptionError) {
    missing.push({
      key: 'description',
      label: i18nT('errors:utils.formValidation.opisanie_fd0e899c'),
      targetStep: 1,
      anchorId: 'travelwizard-basic-description',
    });
  }

  const countriesError = validateCountries((formData.countries ?? []) as string[]);
  if (countriesError) {
    missing.push({
      key: 'countries',
      label: i18nT('errors:utils.formValidation.strany_minimum_odna_cb1fb7cb'),
      targetStep: 2,
      anchorId: 'travelwizard-route-countries',
    });
  }

  const categoriesError = validateCategories((formData.categories ?? []) as string[]);
  if (categoriesError) {
    missing.push({
      key: 'categories',
      label: i18nT('errors:utils.formValidation.kategorii_minimum_odna_2425408b'),
      targetStep: 5,
      anchorId: 'travelwizard-extras-categories',
    });
  }

  // Если markers передан и не пустой — используем его.
  // Если это пустой массив или undefined/null — используем coordsMeTravel из формы.
  const markersSource = Array.isArray(markers) && markers.length > 0 ? markers : (formData.coordsMeTravel ?? []);
  const markersError = validateMarkers(markersSource);
  if (markersError) {
    missing.push({
      key: 'route',
      label: i18nT('errors:utils.formValidation.marshrut_minimum_odna_tochka_4def96d5'),
      targetStep: 2,
      anchorId: 'markers-list-root',
    });
  }

  const gallery = (formData.gallery ?? []) as unknown[];
  const hasCover = !!(formData.travel_image_thumb_small_url && formData.travel_image_thumb_small_url.trim().length > 0);
  const hasPhotos = hasCover || gallery.length > 0;
  if (!hasPhotos) {
    missing.push({
      key: 'photos',
      label: i18nT('errors:utils.formValidation.foto_ili_oblozhka_eb83919e'),
      targetStep: 3,
      anchorId: 'travelwizard-media-cover',
    });
  }

  return missing;
}

/**
 * Валидация описания
 */
export function validateDescription(description: string | undefined | null): ValidationError | null {
  if (!description || description.trim().length === 0) {
    return {
      field: 'description',
      message: i18nT('errors:utils.formValidation.opisanie_obyazatelno_dlya_zapolneniya_6e663676'),
    };
  }
  if (description.trim().length < 50) {
    return {
      field: 'description',
      message: i18nT('errors:utils.formValidation.opishite_marshrut_chut_podrobnee_minimum_50__71c170a7'),
    };
  }
  return null;
}

/**
 * Валидация стран
 */
export function validateCountries(countries: string[] | undefined | null): ValidationError | null {
  if (!countries || countries.length === 0) {
    return {
      field: 'countries',
      message: i18nT('errors:utils.formValidation.vyberite_hotya_by_odnu_stranu_6d706075'),
    };
  }
  return null;
}

/**
 * Валидация категорий
 */
export function validateCategories(categories: string[] | undefined | null): ValidationError | null {
  if (!categories || categories.length === 0) {
    return {
      field: 'categories',
      message: i18nT('errors:utils.formValidation.vyberite_hotya_by_odnu_kategoriyu_87ec77b6'),
    };
  }
  return null;
}

/**
 * Валидация точек маршрута
 */
export function validateMarkers(markers: unknown[] | undefined | null): ValidationError | null {
  if (!markers || markers.length === 0) {
    return {
      field: 'coordsMeTravel',
      message: i18nT('errors:utils.formValidation.dobavte_hotya_by_odnu_tochku_marshruta_na_ka_baf962d7'),
    };
  }
  return null;
}

/**
 * Валидация года
 */
export function validateYear(year: string | number | undefined | null): ValidationError | null {
  if (year === undefined || year === null) {
    return null; // Год не обязателен
  }

  const yearStr = typeof year === 'number' ? String(year) : String(year ?? '').trim();
  if (yearStr.length === 0) {
    return null; // Пустое значение игнорируем
  }

  const yearNum = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
    return {
      field: 'year',
      message: i18nT('errors:utils.formValidation.god_dolzhen_byt_ot_1900_do_value1_60553492', { value1: currentYear + 1 }),
    };
  }
  return null;
}

/**
 * Валидация количества дней
 */
export function validateDays(days: string | number | undefined | null): ValidationError | null {
  if (days === undefined || days === null) {
    return null; // Количество дней не обязательно
  }

  const daysStr = typeof days === 'number' ? String(days) : String(days ?? '').trim();
  if (daysStr.length === 0) {
    return null; // Пустое значение игнорируем
  }

  const daysNum = parseInt(daysStr, 10);
  if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
    return {
      field: 'number_days',
      message: i18nT('errors:utils.formValidation.kolichestvo_dney_dolzhno_byt_ot_1_do_365_bb7a91c9'),
    };
  }
  return null;
}

/**
 * Валидация количества людей
 */
export function validatePeople(people: string | number | undefined | null): ValidationError | null {
  if (people === undefined || people === null) {
    return null; // Количество людей не обязательно
  }

  const peopleStr = typeof people === 'number' ? String(people) : String(people ?? '').trim();
  if (peopleStr.length === 0) {
    return null; // Пустое значение игнорируем
  }

  const peopleNum = parseInt(peopleStr, 10);
  if (isNaN(peopleNum) || peopleNum < 1 || peopleNum > 100) {
    return {
      field: 'number_peoples',
      message: i18nT('errors:utils.formValidation.kolichestvo_lyudey_dolzhno_byt_ot_1_do_100_638b929a'),
    };
  }
  return null;
}

/**
 * Валидация YouTube ссылки
 */
export function validateYouTubeLink(link: string | undefined | null): ValidationError | null {
  if (!link || link.trim().length === 0) {
    return null; // YouTube ссылка не обязательна
  }
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  if (!youtubeRegex.test(link.trim())) {
    return {
      field: 'youtube_link',
      message: i18nT('errors:utils.formValidation.vvedite_korrektnuyu_ssylku_na_youtube_05431d43'),
    };
  }
  return null;
}

/**
 * Полная валидация формы путешествия
 */
export function validateTravelForm(data: TravelFormValidation): ValidationResult {
  const errors: ValidationError[] = [];

  const nameError = validateName(data.name);
  if (nameError) errors.push(nameError);

  const descriptionError = validateDescription(data.description);
  if (descriptionError) errors.push(descriptionError);

  const countriesError = validateCountries(data.countries);
  if (countriesError) errors.push(countriesError);

  const categoriesError = validateCategories(data.categories);
  if (categoriesError) errors.push(categoriesError);

  const markersError = validateMarkers(data.coordsMeTravel);
  if (markersError) errors.push(markersError);

  const yearError = validateYear(data.year);
  if (yearError) errors.push(yearError);

  const daysError = validateDays(data.number_days);
  if (daysError) errors.push(daysError);

  const peopleError = validatePeople(data.number_peoples);
  if (peopleError) errors.push(peopleError);

  const youtubeError = validateYouTubeLink(data.youtube_link);
  if (youtubeError) errors.push(youtubeError);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Получить сообщение об ошибке для поля
 */
export function getFieldError(field: string, errors: ValidationError[]): string | null {
  const error = errors.find(e => e.field === field);
  return error ? error.message : null;
}
