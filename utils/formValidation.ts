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
      message: 'Описание должно содержать минимум 50 символов',
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
export function validateYear(year: string | undefined | null): ValidationError | null {
  if (!year || year.trim().length === 0) {
    return null; // Год не обязателен
  }
  const yearNum = parseInt(year, 10);
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
export function validateDays(days: string | undefined | null): ValidationError | null {
  if (!days || days.trim().length === 0) {
    return null; // Количество дней не обязательно
  }
  const daysNum = parseInt(days, 10);
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
export function validatePeople(people: string | undefined | null): ValidationError | null {
  if (!people || people.trim().length === 0) {
    return null; // Количество людей не обязательно
  }
  const peopleNum = parseInt(people, 10);
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

