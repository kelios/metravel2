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
  coordsMeTravel?: any[];
  year?: string;
  number_days?: string;
  number_peoples?: string;
}

// Упрощённый тип данных формы для использования в шаговой валидации
export interface TravelFormLike {
  name?: string | null;
  description?: string | null;
  countries?: string[] | null;
  categories?: string[] | null;
  coordsMeTravel?: any[] | null;
  // Дополнительные поля, которые могут участвовать в чек-листе модерации
  gallery?: any[] | null;
  travel_image_thumb_small_url?: string | null;
}

/**
 * Валидация названия путешествия
 */
export function validateName(name: string | undefined | null): ValidationError | null {
  if (!name || name.trim().length === 0) {
    return {
      field: 'name',
      message: 'Название обязательно для заполнения',
    };
  }
  if (name.trim().length < 3) {
    return {
      field: 'name',
      message: 'Название должно содержать минимум 3 символа',
    };
  }
  if (name.trim().length > 200) {
    return {
      field: 'name',
      message: 'Название не должно превышать 200 символов',
    };
  }
  return null;
}

/**
 * Централизованная валидация шагов мастера
 *
 * Требования по ТЗ:
 *  - Шаг 1: блокируем переход без name/description/countries
 *  - Шаг 2: блокируем переход без хотя бы одной точки маршрута
 *  - Шаги 3–4: рекомендательные поля, переходы не блокируются
 *  - Шаг 5: валидация на уровне модерации (см. getModerationErrors)
 */
export function validateStep(
  step: number,
  formData: TravelFormLike,
  markers?: any[] | null,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (step === 1) {
    const nameError = validateName(formData.name ?? undefined);
    if (nameError) errors.push(nameError);

    const descriptionError = validateDescription(formData.description ?? undefined);
    if (descriptionError) errors.push(descriptionError);

    const countriesError = validateCountries((formData.countries ?? []) as string[]);
    if (countriesError) errors.push(countriesError);

    const categoriesError = validateCategories((formData.categories ?? []) as string[]);
    if (categoriesError) errors.push(categoriesError);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  if (step === 2) {
    const markersToValidate = (
      Array.isArray(markers) && markers.length > 0
        ? markers
        : (formData.coordsMeTravel ?? [])
    ) as any[];
    const markersError = validateMarkers(markersToValidate);
    if (markersError) errors.push(markersError);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Для шагов 3 и 4 по ТЗ валидация рекомендательная и не должна блокировать переход
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
 *  - Маршрут (минимум одна точка: coordsMeTravel или markers)
 *  - Фото (обложка или ≥1 фото в галерее)
 */
export function getModerationErrors(
  formData: TravelFormLike,
  markers?: any[] | null,
): string[] {
  const missing: string[] = [];

  const nameError = validateName(formData.name ?? undefined);
  if (nameError) {
    missing.push('Название');
  }

  const descriptionError = validateDescription(formData.description ?? undefined);
  if (descriptionError) {
    missing.push('Описание');
  }

  const countriesError = validateCountries((formData.countries ?? []) as string[]);
  if (countriesError) {
    missing.push('Страны (минимум одна)');
  }

  // Если markers передан и не пустой — используем его.
  // Если это пустой массив или undefined/null — используем coordsMeTravel из формы.
  const markersSource = Array.isArray(markers) && markers.length > 0
    ? markers
    : (formData.coordsMeTravel ?? []);

  const markersToValidate = markersSource as any[];
  const markersError = validateMarkers(markersToValidate);
  if (markersError) {
    missing.push('Маршрут (минимум одна точка)');
  }

  const gallery = (formData.gallery ?? []) as any[];
  const hasCover = !!(formData.travel_image_thumb_small_url && formData.travel_image_thumb_small_url.trim().length > 0);
  const hasPhotos = hasCover || gallery.length > 0;
  if (!hasPhotos) {
    missing.push('Фото или обложка');
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
      message: 'Описание обязательно для заполнения',
    };
  }
  if (description.trim().length < 50) {
    return {
      field: 'description',
      message: 'Опишите маршрут чуть подробнее (минимум 50 символов), чтобы путешественникам было понятно, чего ожидать.',
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
      message: 'Выберите хотя бы одну страну',
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
      message: 'Выберите хотя бы одну категорию',
    };
  }
  return null;
}

/**
 * Валидация точек маршрута
 */
export function validateMarkers(markers: any[] | undefined | null): ValidationError | null {
  if (!markers || markers.length === 0) {
    return {
      field: 'coordsMeTravel',
      message: 'Добавьте хотя бы одну точку маршрута на карте',
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
      message: `Год должен быть от 1900 до ${currentYear + 1}`,
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
      message: 'Количество дней должно быть от 1 до 365',
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
      message: 'Количество людей должно быть от 1 до 100',
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
      message: 'Введите корректную ссылку на YouTube',
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

  const youtubeError = validateYouTubeLink((data as any).youtube_link);
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

