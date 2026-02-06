import { TravelFormData } from '@/types/types';

/**
 * ✅ ФАЗА 2: Умные подсказки (Contextual Tips)
 * Система подсказок, которая анализирует состояние формы и показывает релевантные советы
 */

export interface ContextualTip {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'tip';
  priority: number; // Чем меньше, тем важнее
  condition: (formData: TravelFormData) => boolean;
  action?: {
    label: string;
    step: number;
  };
}

/**
 * Библиотека контекстных подсказок для каждого шага
 */
export const CONTEXTUAL_TIPS: Record<number, ContextualTip[]> = {
  // Шаг 1: Основная информация
  1: [
    {
      id: 'name-too-short',
      title: 'Название слишком короткое',
      message: 'Добавьте больше деталей в название. Например: "5 дней в горах Грузии" вместо просто "Грузия"',
      type: 'tip',
      priority: 1,
      condition: (data) => {
        const name = data.name || '';
        return name.length > 0 && name.length < 15;
      },
    },
    {
      id: 'no-description',
      title: 'Добавьте описание',
      message: 'Путешествия с описанием получают на 60% больше просмотров. Расскажите о маршруте, впечатлениях, советах.',
      type: 'info',
      priority: 2,
      condition: (data) => {
        const desc = data.description || '';
        return desc.length === 0;
      },
    },
    {
      id: 'description-too-short',
      title: 'Описание можно расширить',
      message: 'Добавьте больше деталей: что увидели, какие были сложности, что понравилось больше всего. Минимум 100 символов рекомендуется.',
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const desc = data.description || '';
        return desc.length > 0 && desc.length < 100;
      },
    },
  ],

  // Шаг 2: Маршрут
  2: [
    {
      id: 'no-points',
      title: 'Добавьте точки на карту',
      message: 'Используйте поиск по названию места - это быстрее чем вводить координаты вручную. Просто начните печатать название.',
      type: 'info',
      priority: 1,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        return points.length === 0;
      },
    },
    {
      id: 'few-points',
      title: 'Маршрут можно детализировать',
      message: 'Добавьте больше точек для полноты маршрута. Путешествия с 5+ точками получают больше внимания.',
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        return points.length > 0 && points.length < 3;
      },
    },
    {
      id: 'points-without-photos',
      title: 'Добавьте фото к точкам',
      message: 'У вас есть точки без фотографий. Фото помогают другим представить места и повышают интерес к маршруту на 40%.',
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        const pointsWithoutPhotos = points.filter((p: any) => !p.image || p.image.trim() === '');
        return points.length > 0 && pointsWithoutPhotos.length > 0;
      },
    },
    {
      id: 'no-countries-selected',
      title: 'Выберите страны',
      message: 'Укажите страны маршрута - это помогает другим путешественникам найти ваш маршрут в поиске.',
      type: 'info',
      priority: 4,
      condition: (data) => {
        const countries = data.countries || [];
        return countries.length === 0;
      },
      action: {
        label: 'Выбрать страны',
        step: 2,
      },
    },
  ],

  // Шаг 3: Медиа
  3: [
    {
      id: 'no-cover',
      title: 'Добавьте обложку',
      message: 'Путешествия с обложкой получают в 3 раза больше просмотров! Выберите лучшее фото из поездки.',
      type: 'warning',
      priority: 1,
      condition: (data) => {
        return !(data as any).travel_image_thumb_small_url && !(data as any).travel_image_thumb_url;
      },
    },
    {
      id: 'cover-added',
      title: 'Отлично!',
      message: 'Обложка добавлена. Для лучшего результата используйте горизонтальное фото 16:9 без текста и коллажей.',
      type: 'success',
      priority: 5,
      condition: (data) => {
        return !!(data as any).travel_image_thumb_small_url || !!(data as any).travel_image_thumb_url;
      },
    },
  ],

  // Шаг 4: Детали
  4: [
    {
      id: 'add-practical-info',
      title: 'Добавьте практическую информацию',
      message: 'Укажите бюджет, длительность, количество участников - это поможет другим спланировать поездку.',
      type: 'tip',
      priority: 2,
      condition: (data) => {
        return !(data as any).budget && !(data as any).number_days && !(data as any).number_peoples;
      },
    },
  ],

  // Шаг 5: Дополнительные параметры
  5: [
    {
      id: 'no-categories',
      title: 'Выберите категории',
      message: 'Категории помогают другим найти ваш маршрут. Путешествия с категориями получают +40% просмотров в поиске.',
      type: 'info',
      priority: 1,
      condition: (data) => {
        const categories = data.categories || [];
        return categories.length === 0;
      },
    },
    {
      id: 'add-transport',
      title: 'Укажите транспорт',
      message: 'Добавьте виды транспорта - это поможет другим понять, подходит ли маршрут для них.',
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const transports = (data as any).transports || [];
        return transports.length === 0;
      },
    },
    {
      id: 'add-difficulty',
      title: 'Укажите сложность',
      message: 'Уровень физической подготовки помогает путешественникам выбрать подходящий маршрут.',
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const complexity = (data as any).complexity || [];
        return complexity.length === 0;
      },
    },
  ],

  // Шаг 6: Публикация
  6: [
    {
      id: 'ready-to-publish',
      title: 'Готово к публикации!',
      message: 'Все обязательные поля заполнены. Проверьте превью карточки перед публикацией.',
      type: 'success',
      priority: 1,
      condition: (data) => {
        const name = (data.name || '').trim();
        const desc = (data.description || '').trim();
        const points = (data as any).coordsMeTravel || [];
        return name.length >= 3 && desc.length >= 50 && points.length >= 1;
      },
    },
    {
      id: 'missing-required',
      title: 'Заполните обязательные поля',
      message: 'Для публикации нужны: название (мин. 3 символа), описание (мин. 50 символов) и хотя бы 1 точка на карте.',
      type: 'warning',
      priority: 1,
      condition: (data) => {
        const name = (data.name || '').trim();
        const desc = (data.description || '').trim();
        const points = (data as any).coordsMeTravel || [];
        return !(name.length >= 3 && desc.length >= 50 && points.length >= 1);
      },
    },
    {
      id: 'add-recommended',
      title: 'Улучшите видимость',
      message: 'Добавьте рекомендуемые поля для лучшей видимости: страны, категории, обложку. Это увеличит просмотры на 200%!',
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const hasCountries = (data.countries || []).length > 0;
        const hasCategories = (data.categories || []).length > 0;
        const hasCover = !!(data as any).travel_image_thumb_small_url;
        return !hasCountries || !hasCategories || !hasCover;
      },
    },
  ],
};

/**
 * Получить релевантные подсказки для текущего шага
 */
export function getContextualTips(step: number, formData: TravelFormData): ContextualTip[] {
  const stepTips = CONTEXTUAL_TIPS[step] || [];

  return stepTips
    .filter(tip => tip.condition(formData))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3); // Показываем максимум 3 подсказки одновременно
}

/**
 * Получить самую важную подсказку для шага
 */
export function getTopTip(step: number, formData: TravelFormData): ContextualTip | null {
  const tips = getContextualTips(step, formData);
  return tips[0] || null;
}

/**
 * Проверить, есть ли критичные подсказки
 */
export function hasCriticalTips(step: number, formData: TravelFormData): boolean {
  const tips = getContextualTips(step, formData);
  return tips.some(tip => tip.type === 'warning' && tip.priority === 1);
}

