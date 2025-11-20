// src/types/pdf-layout.ts
// ✅ АРХИТЕКТУРА: Типы для конструктора макета PDF

/**
 * Типы блоков, которые можно добавить в макет
 */
export type LayoutBlockType = 
  | 'cover'      // Обложка
  | 'toc'        // Оглавление
  | 'photo'      // Фото путешествия
  | 'description' // Описание
  | 'recommendation' // Рекомендации
  | 'plus'       // Плюсы
  | 'minus'      // Минусы
  | 'gallery'    // Галерея
  | 'map'        // Карта
  | 'qr'         // QR код
  | 'spacer';    // Отступ

/**
 * Блок в макете
 */
export interface LayoutBlock {
  id: string;
  type: LayoutBlockType;
  order: number; // Порядок отображения
  enabled: boolean; // Включен ли блок
  config?: Record<string, any>; // Дополнительные настройки блока
  pageBreak?: 'auto' | 'always' | 'avoid'; // Разрыв страницы: auto, всегда новая страница, избегать разрыва
}

/**
 * Макет PDF
 */
export interface PdfLayout {
  id?: string;
  name: string;
  blocks: LayoutBlock[];
  layoutMode?: 'flow' | 'page-per-block'; // Режим размещения: поток или каждый блок на новой странице
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Предустановленные макеты
 */
export const DEFAULT_LAYOUTS: PdfLayout[] = [
  {
    name: 'Классический',
    blocks: [
      { id: '1', type: 'cover', order: 1, enabled: true },
      { id: '2', type: 'toc', order: 2, enabled: true },
      { id: '3', type: 'photo', order: 3, enabled: true },
      { id: '4', type: 'description', order: 4, enabled: true },
      { id: '5', type: 'recommendation', order: 5, enabled: true },
      { id: '6', type: 'gallery', order: 6, enabled: true },
      { id: '7', type: 'map', order: 7, enabled: true },
    ],
  },
  {
    name: 'Минималистичный',
    blocks: [
      { id: '1', type: 'cover', order: 1, enabled: true },
      { id: '2', type: 'photo', order: 2, enabled: true },
      { id: '3', type: 'description', order: 3, enabled: true },
      { id: '4', type: 'gallery', order: 4, enabled: true },
    ],
  },
  {
    name: 'С QR кодом',
    blocks: [
      { id: '1', type: 'cover', order: 1, enabled: true },
      { id: '2', type: 'toc', order: 2, enabled: true },
      { id: '3', type: 'photo', order: 3, enabled: true },
      { id: '4', type: 'description', order: 4, enabled: true },
      { id: '5', type: 'qr', order: 5, enabled: true },
      { id: '6', type: 'gallery', order: 6, enabled: true },
    ],
  },
];

/**
 * Метаданные блока для отображения в конструкторе
 */
export interface BlockMetadata {
  type: LayoutBlockType;
  label: string;
  icon: string;
  description: string;
  defaultConfig?: Record<string, any>;
}

export const BLOCK_METADATA: Record<LayoutBlockType, BlockMetadata> = {
  cover: {
    type: 'cover',
    label: 'Обложка',
    icon: 'book',
    description: 'Титульная страница с названием',
  },
  toc: {
    type: 'toc',
    label: 'Оглавление',
    icon: 'list',
    description: 'Содержание путешествий',
  },
  photo: {
    type: 'photo',
    label: 'Фото',
    icon: 'image',
    description: 'Главное фото путешествия',
  },
  description: {
    type: 'description',
    label: 'Описание',
    icon: 'description',
    description: 'Текст описания путешествия',
  },
  recommendation: {
    type: 'recommendation',
    label: 'Рекомендации',
    icon: 'star',
    description: 'Рекомендации и советы',
  },
  plus: {
    type: 'plus',
    label: 'Плюсы',
    icon: 'thumb-up',
    description: 'Положительные стороны',
  },
  minus: {
    type: 'minus',
    label: 'Минусы',
    icon: 'thumb-down',
    description: 'Отрицательные стороны',
  },
  gallery: {
    type: 'gallery',
    label: 'Галерея',
    icon: 'photo-library',
    description: 'Фотогалерея',
    defaultConfig: {
      imageSize: 'medium', // 'small' | 'medium' | 'large'
      columns: 3, // Количество колонок
      selectedPhotos: [], // Выбранные фото (индексы или ID)
    },
  },
  map: {
    type: 'map',
    label: 'Карта',
    icon: 'map',
    description: 'Карта маршрута',
  },
  qr: {
    type: 'qr',
    label: 'QR код',
    icon: 'qr-code',
    description: 'QR код для онлайн-версии',
  },
  spacer: {
    type: 'spacer',
    label: 'Отступ',
    icon: 'space-bar',
    description: 'Пустой блок для отступа',
  },
};

