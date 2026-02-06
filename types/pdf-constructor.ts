// src/types/pdf-constructor.ts
// ✅ АРХИТЕКТУРА: Типы для визуального конструктора PDF

/**
 * Формат страницы
 */
export type PageFormat = 'A4' | 'A5' | 'A6' | 'Letter';

/**
 * Размеры формата в мм
 */
export const PAGE_FORMATS: Record<PageFormat, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  Letter: { width: 216, height: 279 },
};

/**
 * Ориентация страницы
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Типы блоков конструктора
 */
export type BlockType =
  | 'heading-h1'
  | 'heading-h2'
  | 'heading-h3'
  | 'paragraph'
  | 'image'
  | 'image-gallery'
  | 'image-with-caption'
  | 'map'
  | 'tip-block'
  | 'important-block'
  | 'warning-block'
  | 'quote'
  | 'checklist'
  | 'table'
  | 'divider'
  | 'spacer'
  | 'background-block'
  | 'cover'
  | 'toc'
  | 'author-block'
  | 'recommendations-block';

/**
 * Позиция блока на странице
 */
export interface BlockPosition {
  x: number; // в мм или процентах
  y: number;
  width: number;
  height: number;
  unit?: 'mm' | 'percent'; // единица измерения
}

/**
 * Стили блока
 */
export interface BlockStyles {
  // Текст
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  
  // Фон
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  
  // Отступы
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  
  // Границы
  border?: {
    width?: number;
    style?: 'solid' | 'dashed' | 'dotted';
    color?: string;
    radius?: number;
  };
  
  // Тени
  shadow?: {
    offsetX?: number;
    offsetY?: number;
    blur?: number;
    spread?: number;
    color?: string;
  };
  
  // Дополнительно
  opacity?: number;
  transform?: {
    rotate?: number;
    scale?: number;
  };
}

/**
 * Конфигурация блока изображения
 */
export interface ImageBlockConfig {
  url: string;
  alt?: string;
  caption?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  objectPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Конфигурация галереи
 */
export interface GalleryBlockConfig {
  images: Array<{
    url: string;
    alt?: string;
    caption?: string;
  }>;
  columns: 1 | 2 | 3 | 4;
  gap?: number;
  aspectRatio?: number;
}

/**
 * Конфигурация карты
 */
export interface MapBlockConfig {
  imageUrl: string;
  points?: Array<{
    name: string;
    lat: number;
    lng: number;
  }>;
  description?: string;
}

/**
 * Конфигурация таблицы
 */
export interface TableBlockConfig {
  headers: string[];
  rows: string[][];
  striped?: boolean;
  bordered?: boolean;
}

/**
 * Конфигурация чек-листа
 */
export interface ChecklistBlockConfig {
  items: Array<{
    text: string;
    checked: boolean;
  }>;
  style?: 'checkbox' | 'bullet';
}

/**
 * Конфигурация оглавления
 */
export interface TocBlockConfig {
  items: Array<{
    title: string;
    page: number;
    level: 1 | 2 | 3;
  }>;
}

/**
 * Конфигурация обложки
 */
export interface CoverBlockConfig {
  title: string;
  subtitle?: string;
  author?: string;
  coverImage?: string;
  backgroundGradient?: [string, string];
}

/**
 * Блок на странице
 */
export interface PdfBlock {
  id: string;
  type: BlockType;
  position: BlockPosition;
  styles: BlockStyles;
  content: string | ImageBlockConfig | GalleryBlockConfig | MapBlockConfig | TableBlockConfig | ChecklistBlockConfig | TocBlockConfig | CoverBlockConfig;
  zIndex?: number;
  locked?: boolean; // Заблокирован ли для редактирования
  visible?: boolean; // Видим ли блок
}

/**
 * Страница документа
 */
export interface PdfPage {
  id: string;
  pageNumber: number;
  format: PageFormat;
  orientation: PageOrientation;
  blocks: PdfBlock[];
  background?: {
    color?: string;
    image?: string;
    gradient?: [string, string];
  };
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Тема оформления
 */
export interface PdfTheme {
  id: string;
  name: string;
  description?: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    background: string;
    surface: string;
    accent: string;
    border: string;
    tipBlock: {
      background: string;
      border: string;
      text: string;
    };
    importantBlock: {
      background: string;
      border: string;
      text: string;
    };
    warningBlock: {
      background: string;
      border: string;
      text: string;
    };
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingSizes: {
      h1: number;
      h2: number;
      h3: number;
    };
    bodySize: number;
    lineHeight: number;
  };
  spacing: {
    pagePadding: number;
    blockSpacing: number;
    elementSpacing: number;
  };
  blocks: {
    borderRadius: number;
    borderWidth: number;
    shadow: string;
  };
}

/**
 * Документ PDF
 */
export interface PdfDocument {
  id: string;
  title: string;
  pages: PdfPage[];
  theme: PdfTheme;
  format: PageFormat;
  orientation: PageOrientation;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

/**
 * Настройки экспорта
 */
export interface PdfExportConfig {
  dpi: number; // Разрешение для печати (300 для качественной печати)
  imageFormat: 'png' | 'webp' | 'jpeg';
  imageQuality?: number; // 0-1 для JPEG/WebP
  optimizeImages?: boolean;
  compressPdf?: boolean;
}

/**
 * Результат рендеринга страницы
 */
export interface RenderedPage {
  pageId: string;
  pageNumber: number;
  imageData: string; // base64 или blob URL
  width: number;
  height: number;
}

/**
 * Результат экспорта
 */
export interface PdfExportResult {
  blob: Blob;
  filename: string;
  size: number;
  pagesCount: number;
  renderedPages: RenderedPage[];
}
