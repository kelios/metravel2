import type { TravelForBook } from '@/types/pdf-export';

export interface NormalizedLocation {
  id: string;
  address: string;
  name?: string;
  categoryName?: string;
  coord?: string;
  thumbnailUrl?: string;
  lat?: number;
  lng?: number;
}

export interface TravelSectionMeta {
  travel: TravelForBook;
  hasGallery: boolean;
  hasMap: boolean;
  locations: NormalizedLocation[];
  startPage: number;
}
