// src/types/pdf-export.ts
// ✅ АРХИТЕКТУРА: Типы для PDF экспорта


/**
 * Нормализованная структура путешествия для генерации PDF
 */
export interface TravelForBook {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
  description?: string | null;
  recommendation?: string | null;
  plus?: string | null;
  minus?: string | null;
  countryName?: string;
  cityName?: string;
  year?: string | number;
  monthName?: string;
  number_days?: number;
  travel_image_thumb_url?: string;
  travel_image_url?: string;
  gallery?: Array<{
    url: string;
    id?: number | string;
    updated_at?: string;
    caption?: string;
    /** width / height из медиа-манифеста API (#2232); нет — пропорция неизвестна. */
    aspect?: number;
  }>;
  /** Пропорции картинок описания из медиа-манифеста: ключ файла → width / height (#2232). */
  descriptionImageAspects?: Record<string, number>;
  travelAddress?: Array<{
    id: string;
    address: string;
    coord: string;
    travelImageThumbUrl?: string;
    categoryName?: string;
  }>;
  youtube_link?: string;
  userName?: string;
  /** Frozen worker summaries avoid retaining complete gallery/point arrays. */
  sourceCounts?: { photos: number; locations: number };
}

/**
 * Прогресс экспорта
 */
export interface ExportProgress {
  stage: ExportStage;
  progress: number; // 0-100
  message?: string;
}

/**
 * Этапы экспорта
 */
export enum ExportStage {
  VALIDATING = 'validating',
  TRANSFORMING = 'transforming',
  GENERATING_HTML = 'generating_html',
  LOADING_IMAGES = 'loading_images',
  RENDERING = 'rendering',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/**
 * Типы ошибок
 */
export enum ExportErrorType {
  VALIDATION_ERROR = 'validation_error',
  TRANSFORMATION_ERROR = 'transformation_error',
  HTML_GENERATION_ERROR = 'html_generation_error',
  IMAGE_LOAD_ERROR = 'image_load_error',
  RENDERING_ERROR = 'rendering_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Структурированная ошибка экспорта
 */
export class ExportError extends Error {
  constructor(
    public type: ExportErrorType,
    message: string,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Конфигурация экспорта
 */
export interface ExportConfig {
  maxRetries?: number;
  imageLoadTimeout?: number;
  batchSize?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

/**
 * Callback для прогресса
 */
export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Callback для ошибок
 */
export type ErrorCallback = (error: ExportError) => void;

