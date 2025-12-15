export interface Travel {
  id: string | number;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  rating?: number;
  location?: string;
  isFavorite?: boolean;
  // Add other travel-related properties as needed
  [key: string]: any;
}

export interface TravelListResponse {
  data: Travel[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TravelFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  location?: string;
  // Add other filter options as needed
  [key: string]: any;
}
