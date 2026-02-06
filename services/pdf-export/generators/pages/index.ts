// src/services/pdf-export/generators/pages/index.ts
// Экспорт всех генераторов страниц

export { CoverPageGenerator } from './CoverPageGenerator';
export type { CoverPageData } from './CoverPageGenerator';

export { TocPageGenerator } from './TocPageGenerator';
export type { TocEntry } from './TocPageGenerator';

export { FinalPageGenerator } from './FinalPageGenerator';
export type { FinalPageData } from './FinalPageGenerator';

export { TravelPageGenerator } from './TravelPageGenerator';
export type { TravelPageOptions } from './TravelPageGenerator';

export { GalleryPageGenerator } from './GalleryPageGenerator';
export type { GalleryLayout, GalleryPhoto } from './GalleryPageGenerator';

export { MapPageGenerator } from './MapPageGenerator';
export type { MapLocation } from './MapPageGenerator';
