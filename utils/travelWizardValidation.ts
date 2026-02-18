/**
 * Централизованная система валидации для Travel Wizard
 * Каждый шаг имеет свои правила валидации
 */

import { TravelFormData } from '@/types/types';

type UnknownRecord = Record<string, unknown>;

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
  anchorId?: string; // Для навигации к полю
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
  anchorId?: string;
}

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  characterCount?: number;
  maxLength?: number;
  minLength?: number;
}

interface FieldRule {
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  pattern?: RegExp;
  /**
   * How to count length for string fields.
   * - 'plain': use raw string length
   * - 'html': strip tags/entities and count visible text length
   */
  content?: 'plain' | 'html';
  label: string;
}

interface StepRule {
  required?: string[];
  recommended?: string[];
  fields?: Record<string, FieldRule>;
}

/**
 * Правила валидации для каждого шага
 */
export const STEP_VALIDATION_RULES: Record<number, StepRule> = {
  1: {
    // Шаг 1: Основная информация
    required: ['name', 'description'],
    fields: {
      name: {
        minLength: 3,
        maxLength: 200,
        label: 'Название путешествия',
      },
      description: {
        minLength: 50,
        maxLength: 2000,
        content: 'html',
        label: 'Описание',
      },
    },
  },
  2: {
    // Шаг 2: Маршрут
    required: ['coordsMeTravel', 'countries'],
    fields: {
      coordsMeTravel: {
        minItems: 1,
        label: 'Точки маршрута',
      },
      countries: {
        minItems: 1,
        label: 'Страны маршрута',
      },
    },
  },
  3: {
    // Шаг 3: Медиа
    required: [],
    recommended: ['coverImage', 'gallery'],
    fields: {
      coverImage: {
        label: 'Главное изображение',
      },
      gallery: {
        minItems: 3,
        label: 'Галерея фотографий',
      },
      youtube_link: {
        pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        label: 'Ссылка на YouTube',
      },
    },
  },
  4: {
    // Шаг 4: Детали
    required: [],
    recommended: ['plus', 'minus', 'recommendation'],
    fields: {
      plus: {
        maxLength: 1000,
        content: 'html',
        label: 'Плюсы путешествия',
      },
      minus: {
        maxLength: 1000,
        content: 'html',
        label: 'Минусы путешествия',
      },
      recommendation: {
        maxLength: 2000,
        content: 'html',
        label: 'Рекомендации',
      },
      budget: {
        label: 'Бюджет',
      },
    },
  },
  5: {
    // Шаг 5: Дополнительные параметры
    required: [],
    recommended: ['categories', 'transports'],
    fields: {
      categories: {
        minItems: 1,
        label: 'Категории',
      },
      transports: {
        label: 'Транспорт',
      },
      complexity: {
        label: 'Сложность',
      },
      companions: {
        label: 'Компания',
      },
      month: {
        label: 'Сезон',
      },
    },
  },
  6: {
    // Шаг 6: Публикация (все обязательные поля для модерации)
    required: ['name', 'description', 'coordsMeTravel', 'countries', 'categories'],
    fields: {
      name: {
        minLength: 3,
        maxLength: 200,
        label: 'Название путешествия',
      },
      description: {
        minLength: 50,
        maxLength: 2000,
        content: 'html',
        label: 'Описание',
      },
      coordsMeTravel: {
        minItems: 1,
        label: 'Точки маршрута',
      },
      countries: {
        minItems: 1,
        label: 'Страны маршрута',
      },
      categories: {
        minItems: 1,
        label: 'Категории',
      },
    },
  },
};

function htmlToPlainText(value: string): string {
  return String(value)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

function getStringLengthForRules(value: string, rules: FieldRule | undefined): number {
  if (rules?.content === 'html') return htmlToPlainText(value).length;
  return value.length;
}

function isEmptyForRules(value: unknown, rules: FieldRule | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') {
    if (value === '') return true;
    if (rules?.content === 'html') return htmlToPlainText(value).length === 0;
    return value.trim().length === 0;
  }
  return false;
}

/**
 * Валидация конкретного поля
 */
export function validateField(
  _fieldName: string,
  value: unknown,
  rules: FieldRule | undefined
): FieldValidationResult {
  if (!rules) {
    return { isValid: true };
  }

  const result: FieldValidationResult = {
    isValid: true,
  };

  // Проверка на пустое значение
  const isEmpty = isEmptyForRules(value, rules);

  // Минимальная длина
  if (rules.minLength !== undefined) {
    const length = typeof value === 'string' ? getStringLengthForRules(value, rules) : 0;
    result.characterCount = length;
    result.minLength = rules.minLength;
    result.maxLength = rules.maxLength;

    if (length < rules.minLength && !isEmpty) {
      result.isValid = false;
      result.error = `Минимум ${rules.minLength} символов (сейчас: ${length})`;
    }
  }

  // Максимальная длина
  if (rules.maxLength !== undefined) {
    const length = typeof value === 'string' ? getStringLengthForRules(value, rules) : 0;
    result.characterCount = length;
    result.maxLength = rules.maxLength;

    if (length > rules.maxLength) {
      result.isValid = false;
      result.error = `Максимум ${rules.maxLength} символов (сейчас: ${length})`;
    }
  }

  // Минимальное количество элементов (для массивов)
  if (rules.minItems !== undefined && Array.isArray(value)) {
    if (value.length < rules.minItems) {
      result.isValid = false;
      result.error = `Необходимо минимум ${rules.minItems} ${
        rules.minItems === 1 ? 'элемент' : 'элемента'
      }`;
    }
  }

  // Паттерн (регулярное выражение)
  if (rules.pattern && typeof value === 'string' && value.length > 0) {
    if (!rules.pattern.test(value)) {
      result.isValid = false;
      result.error = `Неверный формат`;
    }
  }

  return result;
}

/**
 * Валидация всего шага
 */
export function validateStep(
  step: number,
  formData: TravelFormData
): ValidationResult {
  const rules = STEP_VALIDATION_RULES[step as keyof typeof STEP_VALIDATION_RULES];
  if (!rules) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Проверка обязательных полей
  if (rules.required) {
    for (const fieldName of rules.required) {
      const value = (formData as unknown as UnknownRecord)[fieldName];
      const fieldRules = rules.fields?.[fieldName];
      const isEmpty = isEmptyForRules(value, fieldRules);

      if (isEmpty) {
        errors.push({
          field: fieldName,
          message: `${fieldRules?.label || fieldName} обязательно для заполнения`,
          severity: 'error',
          anchorId: `field-${fieldName}`,
        });
      } else {
        // Валидация значения
        const validation = validateField(fieldName, value, fieldRules);
        if (!validation.isValid && validation.error) {
          errors.push({
            field: fieldName,
            message: `${fieldRules?.label || fieldName}: ${validation.error}`,
            severity: 'error',
            anchorId: `field-${fieldName}`,
          });
        }
      }
    }
  }

  // Проверка рекомендуемых полей (warnings)
  if (rules.recommended) {
    for (const fieldName of rules.recommended) {
      const value = (formData as unknown as UnknownRecord)[fieldName];
      const fieldRules = rules.fields?.[fieldName];
      const isEmpty = isEmptyForRules(value, fieldRules);

      if (isEmpty) {
        warnings.push({
          field: fieldName,
          message: `Рекомендуется заполнить: ${fieldRules?.label || fieldName}`,
          severity: 'warning',
          anchorId: `field-${fieldName}`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Получить прогресс заполнения шага (0-100%)
 */
export function getStepProgress(step: number, formData: TravelFormData): number {
  const rules = STEP_VALIDATION_RULES[step as keyof typeof STEP_VALIDATION_RULES];
  if (!rules) return 100;

  const allFields = [
    ...(rules.required || []),
    ...(rules.recommended || []),
  ];

  if (allFields.length === 0) return 100;

  let filledCount = 0;
  for (const fieldName of allFields) {
    const value = (formData as unknown as UnknownRecord)[fieldName];
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (!isEmpty) {
      filledCount++;
    }
  }

  return Math.round((filledCount / allFields.length) * 100);
}

/**
 * Проверка готовности к публикации (все критичные поля заполнены)
 */
export function isReadyForModeration(formData: TravelFormData): {
  ready: boolean;
  missingFields: string[];
} {
  const validation = validateStep(6, formData);
  
  return {
    ready: validation.isValid,
    missingFields: validation.errors.map(e => e.field),
  };
}

/**
 * Получить качественную оценку заполнения
 */
export function getQualityScore(formData: TravelFormData): {
  score: number; // 0-100
  level: 'poor' | 'fair' | 'good' | 'excellent';
  suggestions: string[];
} {
  let score = 0;
  const suggestions: string[] = [];

  // Базовые поля (40 баллов)
  if (formData.name && formData.name.length >= 10) score += 10;
  if (formData.description && formData.description.length >= 100) score += 15;
  if (formData.coordsMeTravel && formData.coordsMeTravel.length >= 3) score += 15;
  else if (formData.coordsMeTravel && formData.coordsMeTravel.length >= 1) score += 10;

  // Медиа (30 баллов)
  const hasCover = (formData.travel_image_thumb_small_url && String(formData.travel_image_thumb_small_url).trim().length > 0) ||
    (formData.travelImageThumbUrlArr && formData.travelImageThumbUrlArr.length > 0);
  const hasGallery = formData.gallery && formData.gallery.length >= 3;
  const hasVideo = formData.youtube_link && formData.youtube_link.length > 0;

  if (hasCover) score += 10;
  else suggestions.push('Добавьте главное изображение');

  if (hasGallery) score += 15;
  else suggestions.push('Добавьте минимум 3 фото в галерею');

  if (hasVideo) score += 5;

  // Детали (20 баллов)
  if (formData.plus && formData.plus.length >= 50) score += 7;
  else suggestions.push('Опишите плюсы путешествия');

  if (formData.minus && formData.minus.length >= 50) score += 7;
  else suggestions.push('Опишите минусы путешествия');

  if (formData.recommendation && formData.recommendation.length >= 50) score += 6;
  else suggestions.push('Добавьте рекомендации');

  // Параметры (10 баллов)
  if (formData.categories && formData.categories.length > 0) score += 5;
  else suggestions.push('Выберите категории');

  if (formData.transports && formData.transports.length > 0) score += 5;

  let level: 'poor' | 'fair' | 'good' | 'excellent';
  if (score >= 90) level = 'excellent';
  else if (score >= 60) level = 'good';
  else if (score >= 40) level = 'fair';
  else level = 'poor';

  return { score, level, suggestions };
}
