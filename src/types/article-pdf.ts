// src/types/article-pdf.ts
// ✅ АРХИТЕКТУРА: Типы для экспорта одной статьи путешествия в PDF

/**
 * Ссылка на изображение
 */
export interface ImageRef {
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Точка на карте
 */
export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  description?: string;
  distance?: number; // Расстояние от предыдущей точки в км
}

/**
 * Блок рекомендаций
 */
export interface RecommendationBlock {
  title: string;
  items: string[];
  type?: 'checklist' | 'list' | 'links';
}

/**
 * Секция статьи
 */
export type Section =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string; html?: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string; variant?: 'quote' | 'tip' | 'warning' | 'important'; author?: string }
  | { type: 'image'; image: ImageRef; caption?: string }
  | { type: 'imageGallery'; images: ImageRef[]; caption?: string }
  | { type: 'infoBlock'; variant: 'tip' | 'important' | 'warning' | 'recommendation'; text: string; title?: string };

/**
 * Метаданные путешествия
 */
export interface TravelMeta {
  country?: string;
  region?: string;
  distanceKm?: number;
  ascent?: number; // Набор высоты в метрах
  descent?: number; // Сброс высоты в метрах
  days?: number;
  difficulty?: string;
  season?: string;
  format?: string; // трек, радиалки и т.п.
  duration?: string; // Длительность в часах/днях
}

/**
 * Модель статьи для PDF
 */
export interface ArticlePdfModel {
  title: string;
  subtitle?: string;
  author?: string;
  coverImage?: ImageRef;
  meta: TravelMeta;
  sections: Section[];
  map?: {
    image: ImageRef;
    description?: string;
    points?: MapPoint[];
  };
  recommendations?: RecommendationBlock[];
  gallery?: ImageRef[];
}

