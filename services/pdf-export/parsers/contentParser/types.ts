export type ContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'image'
  | 'image-gallery'
  | 'info-block'
  | 'warning-block'
  | 'tip-block'
  | 'danger-block'
  | 'code'
  | 'separator'
  | 'table';

/**
 * Базовый интерфейс блока контента
 */
export interface ContentBlock {
  type: ContentBlockType;
  id?: string;
}

/**
 * Заголовок
 */
export interface HeadingBlock extends ContentBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

/**
 * Параграф
 */
export interface ParagraphBlock extends ContentBlock {
  type: 'paragraph';
  text: string;
  html?: string; // Оригинальный HTML для сложных случаев
}

/**
 * Список
 */
export interface ListBlock extends ContentBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

/**
 * Цитата
 */
export interface QuoteBlock extends ContentBlock {
  type: 'quote';
  text: string;
  author?: string;
}

/**
 * Изображение
 */
export interface ImageBlock extends ContentBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  layout?: 'single-wide' | 'float-left' | 'float-right';
}

/**
 * Галерея изображений
 */
export interface ImageGalleryBlock extends ContentBlock {
  type: 'image-gallery';
  images: Array<{
    src: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
  }>;
  columns?: number;
  layout?:
    | 'stack-landscape'
    | 'pair-portraits'
    | 'pair-mixed'
    | 'pair-balanced'
    | 'row-2-balanced'
    | 'row-2-landscape'
    | 'row-2-portrait'
    | 'row-2-mixed'
    | 'quilt-3'
    | 'quilt-4'
    | 'pair-grid'
    | 'column-portraits'
    | 'editorial-grid'
    | 'grid-default'
    | 'grid-portrait'
    | 'grid-mixed'
    | 'grid-mixed-reverse'
    | 'grid-balanced'
    | 'grid-quilt';
}

/**
 * Информационный блок (Совет, Важно, Лайфхак, Предупреждение)
 */
export interface InfoBlock extends ContentBlock {
  type: 'info-block' | 'warning-block' | 'tip-block' | 'danger-block';
  title?: string;
  content: string;
  icon?: string;
}

/**
 * Код
 */
export interface CodeBlock extends ContentBlock {
  type: 'code';
  code: string;
  language?: string;
}

/**
 * Разделитель
 */
export interface SeparatorBlock extends ContentBlock {
  type: 'separator';
}

/**
 * Таблица
 */
export interface TableBlock extends ContentBlock {
  type: 'table';
  headers?: string[];
  rows: string[][];
}

/**
 * Объединенный тип всех блоков
 */
export type ParsedContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | ImageBlock
  | ImageGalleryBlock
  | InfoBlock
  | CodeBlock
  | SeparatorBlock
  | TableBlock;
