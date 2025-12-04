// src/types/pdf-gallery.ts
// Типы для галерей в PDF экспорте

/**
 * Типы раскладок галерей
 */
export type GalleryLayout = 
  | 'grid'        // Сетка с одинаковыми размерами
  | 'masonry'     // Мозаика Pinterest-style
  | 'collage'     // Коллаж с предопределенными шаблонами
  | 'polaroid'    // Полароид с рамками
  | 'slideshow';  // Одно фото на страницу

/**
 * Позиция подписи к фото
 */
export type CaptionPosition = 'bottom' | 'top' | 'overlay' | 'none';

/**
 * Подпись к фотографии
 */
export interface PhotoCaption {
  text?: string;
  location?: string;
  date?: string;
  showMetadata: boolean;
  position: CaptionPosition;
}

/**
 * Настройки галереи
 */
export interface GallerySettings {
  layout: GalleryLayout;
  columns?: number; // Для grid: 2, 3, 4
  showCaptions: boolean;
  captionPosition: CaptionPosition;
  spacing: 'compact' | 'normal' | 'spacious';
  borderStyle?: 'none' | 'thin' | 'thick' | 'polaroid';
  backgroundColor?: string;
}

/**
 * Фотография с метаданными
 */
export interface GalleryPhoto {
  id: string | number;
  url: string;
  thumbnailUrl?: string;
  caption?: PhotoCaption;
  width?: number;
  height?: number;
  aspectRatio?: number;
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    iso?: string;
    shutterSpeed?: string;
    date?: string;
    location?: {
      lat: number;
      lng: number;
      name?: string;
    };
  };
}

/**
 * Шаблоны коллажей
 */
export type CollageTemplate = 
  | 'hero-left'      // Одно большое слева + 4 маленьких справа
  | 'hero-right'     // Одно большое справа + 4 маленьких слева
  | 'hero-top'       // Одно большое сверху + 3 маленьких снизу
  | 'hero-bottom'    // Одно большое снизу + 3 маленьких сверху
  | 'symmetric'      // Симметричная раскладка
  | 'asymmetric'     // Асимметричная раскладка
  | 'magazine';      // Журнальная раскладка

/**
 * Настройки коллажа
 */
export interface CollageSettings {
  template: CollageTemplate;
  gap: number; // В пикселях
  borderRadius: number;
  shadow: boolean;
}

/**
 * Настройки мозаики (Masonry)
 */
export interface MasonrySettings {
  columns: number; // 2-4
  gap: number;
  maintainAspectRatio: boolean;
}

/**
 * Настройки полароида
 */
export interface PolaroidSettings {
  frameColor: string;
  frameWidth: number;
  rotation: number; // Максимальный угол поворота в градусах (±)
  shadow: boolean;
  showCaption: boolean;
  captionFont: 'handwritten' | 'print';
}

/**
 * Настройки слайдшоу
 */
export interface SlideshowSettings {
  photoSize: 'full' | 'large' | 'medium';
  showCaption: boolean;
  showMetadata: boolean;
  backgroundColor: string;
  textColor: string;
}

/**
 * Полные настройки галереи с специфичными опциями
 */
export interface FullGallerySettings extends GallerySettings {
  collage?: CollageSettings;
  masonry?: MasonrySettings;
  polaroid?: PolaroidSettings;
  slideshow?: SlideshowSettings;
}

/**
 * Настройки по умолчанию для каждого типа раскладки
 */
export const DEFAULT_GALLERY_SETTINGS: Record<GalleryLayout, FullGallerySettings> = {
  grid: {
    layout: 'grid',
    columns: 3,
    showCaptions: true,
    captionPosition: 'bottom',
    spacing: 'normal',
    borderStyle: 'none',
  },
  masonry: {
    layout: 'masonry',
    showCaptions: true,
    captionPosition: 'overlay',
    spacing: 'normal',
    borderStyle: 'none',
    masonry: {
      columns: 3,
      gap: 16,
      maintainAspectRatio: true,
    },
  },
  collage: {
    layout: 'collage',
    showCaptions: false,
    captionPosition: 'none',
    spacing: 'compact',
    borderStyle: 'none',
    collage: {
      template: 'hero-left',
      gap: 12,
      borderRadius: 8,
      shadow: true,
    },
  },
  polaroid: {
    layout: 'polaroid',
    showCaptions: true,
    captionPosition: 'bottom',
    spacing: 'spacious',
    borderStyle: 'polaroid',
    polaroid: {
      frameColor: '#ffffff',
      frameWidth: 20,
      rotation: 3,
      shadow: true,
      showCaption: true,
      captionFont: 'handwritten',
    },
  },
  slideshow: {
    layout: 'slideshow',
    showCaptions: true,
    captionPosition: 'bottom',
    spacing: 'normal',
    borderStyle: 'none',
    slideshow: {
      photoSize: 'large',
      showCaption: true,
      showMetadata: true,
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    },
  },
};

/**
 * Получить настройки по умолчанию для раскладки
 */
export function getDefaultGallerySettings(layout: GalleryLayout): FullGallerySettings {
  return { ...DEFAULT_GALLERY_SETTINGS[layout] };
}

/**
 * Вычислить оптимальное количество колонок для количества фото
 */
export function calculateOptimalColumns(photoCount: number, layout: GalleryLayout): number {
  if (layout === 'slideshow') return 1;
  if (layout === 'collage') return 1; // Коллаж - это один блок
  
  if (photoCount <= 2) return 2;
  if (photoCount <= 4) return 2;
  if (photoCount <= 9) return 3;
  return 4;
}

/**
 * Выбрать оптимальную раскладку на основе количества фото
 */
export function suggestGalleryLayout(photoCount: number): GalleryLayout {
  if (photoCount === 1) return 'slideshow';
  if (photoCount <= 3) return 'grid';
  if (photoCount <= 6) return 'collage';
  if (photoCount <= 12) return 'masonry';
  return 'grid';
}
