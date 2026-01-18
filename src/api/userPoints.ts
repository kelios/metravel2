import { apiClient } from './client';
import type { 
  ImportedPoint, 
  PointFilters, 
  RouteRequest, 
  RouteResponse,
  RecommendationRequest,
  RecommendationResponse,
  UserPointsStats
} from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';

type FileInput = File | DocumentPickerAsset;

export const userPointsApi = {
  async importPoints(source: 'google_maps' | 'osm', file: FileInput) {
    const formData = new FormData();
    formData.append('source', source);
    
    // Обрабатываем разные типы файлов
    if ('uri' in file) {
      // React Native DocumentPickerAsset
      const asset = file as DocumentPickerAsset;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append('file', blob, asset.name);
    } else {
      // Web File API
      formData.append('file', file as File);
    }
    
    return apiClient.uploadFormData<{
      success: boolean;
      imported: number;
      skipped: number;
      errors: string[];
      points: ImportedPoint[];
    }>('/user-points/import/', formData, 'POST');
  },
  
  async getPoints(filters?: PointFilters) {
    const params = new URLSearchParams();
    
    if (filters?.colors && filters.colors.length > 0) {
      params.append('colors', filters.colors.join(','));
    }
    if (filters?.categories && filters.categories.length > 0) {
      params.append('categories', filters.categories.join(','));
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.sortBy) {
      params.append('sortBy', filters.sortBy);
    }
    if (filters?.sortOrder) {
      params.append('sortOrder', filters.sortOrder);
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/user-points/?${queryString}` : '/user-points/';
    
    return apiClient.get<{
      data: ImportedPoint[];
      total: number;
      page: number;
      perPage: number;
    }>(endpoint);
  },
  
  async getPoint(id: string) {
    return apiClient.get<{ point: ImportedPoint }>(`/user-points/${id}/`);
  },
  
  async createPoint(point: Partial<ImportedPoint>) {
    return apiClient.post<{ point: ImportedPoint }>('/user-points/', point);
  },
  
  async updatePoint(id: string, updates: Partial<ImportedPoint>) {
    return apiClient.patch<{ point: ImportedPoint }>(`/user-points/${id}/`, updates);
  },
  
  async deletePoint(id: string) {
    return apiClient.delete(`/user-points/${id}/`);
  },
  
  async bulkUpdatePoints(pointIds: string[], updates: Partial<ImportedPoint>) {
    return apiClient.patch<{
      updated: number;
      points: ImportedPoint[];
    }>('/user-points/bulk-update/', { pointIds, updates });
  },
  
  async calculateRoute(request: RouteRequest) {
    return apiClient.post<RouteResponse>('/user-points/route/calculate/', request);
  },
  
  async saveRoute(name: string, route: RouteResponse, pointIds: string[]) {
    return apiClient.post<{
      routeId: string;
      route: any;
    }>('/user-points/route/save/', { name, route, pointIds });
  },
  
  async getSavedRoutes() {
    return apiClient.get<{ routes: any[] }>('/user-points/routes/');
  },
  
  async getRecommendations(request: RecommendationRequest) {
    return apiClient.post<RecommendationResponse>('/user-points/recommendations/', request);
  },
  
  async getStats() {
    return apiClient.get<UserPointsStats>('/user-points/stats/');
  }
};
