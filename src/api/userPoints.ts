import { apiClient } from './client';
import type { 
  ImportedPoint, 
  ImportPointsResult,
  DedupePolicy,
  PointFilters, 
  RouteRequest, 
  RouteResponse,
  RecommendationRequest,
  RecommendationResponse,
  UserPointsStats
} from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';

import JSZip from 'jszip';

type FileInput = File | DocumentPickerAsset;

export const userPointsApi = {
  async importPoints(
    source: 'google_maps' | 'osm',
    file: FileInput,
    options?: {
      dedupePolicy?: DedupePolicy;
      defaultColor?: string;
      defaultStatus?: string;
    }
  ) {
    const formData = new FormData();
    formData.append('source', source);

    if (options?.dedupePolicy) {
      formData.append('dedupe_policy', options.dedupePolicy);
    }
    if (options?.defaultColor) {
      formData.append('default_color', options.defaultColor);
    }
    if (options?.defaultStatus) {
      formData.append('default_status', options.defaultStatus);
    }

    const extractKmlFromKmz = async (buffer: ArrayBuffer) => {
      const zip = await JSZip.loadAsync(buffer);

      const fileNames = Object.keys(zip.files);
      const kmlName =
        fileNames.find((n) => n.toLowerCase().endsWith('/doc.kml')) ??
        fileNames.find((n) => n.toLowerCase().endsWith('doc.kml')) ??
        fileNames.find((n) => n.toLowerCase().endsWith('.kml'));

      if (!kmlName) {
        throw new Error('KMZ не содержит KML файла');
      }

      const kmlFile = zip.file(kmlName);
      if (!kmlFile) {
        throw new Error('KMZ не содержит KML файла');
      }

      const kmlText = await kmlFile.async('string');
      return kmlText;
    };

    const toKmlName = (originalName: string) => {
      if (!originalName) return 'doc.kml';
      const lower = originalName.toLowerCase();
      if (lower.endsWith('.kmz')) return `${originalName.slice(0, -4)}.kml`;
      return originalName;
    };

    // file upload handling for web/native
    if ('uri' in file) {
      const asset = file as DocumentPickerAsset;
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const isKmz = String(asset.name || '').toLowerCase().endsWith('.kmz');
      if (isKmz) {
        const buffer = await blob.arrayBuffer();
        const kmlText = await extractKmlFromKmz(buffer);
        const kmlBlob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
        formData.append('file', kmlBlob, toKmlName(asset.name));
      } else {
        formData.append('file', blob, asset.name);
      }
    } else {
      const webFile = file as File;
      const isKmz = String(webFile.name || '').toLowerCase().endsWith('.kmz');

      if (isKmz) {
        const buffer = await webFile.arrayBuffer();
        const kmlText = await extractKmlFromKmz(buffer);
        const kmlFile = new File([kmlText], toKmlName(webFile.name), {
          type: 'application/vnd.google-earth.kml+xml',
        });
        formData.append('file', kmlFile);
      } else {
        formData.append('file', webFile);
      }
    }

    return apiClient.uploadFormData<ImportPointsResult>('/user-points/import/', formData, 'POST');
  },
  
  async getPoints(filters?: PointFilters) {
    const params = new URLSearchParams();
    
    if (filters?.colors && filters.colors.length > 0) {
      params.append('colors', filters.colors.join(','));
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

    if (typeof filters?.page === 'number' && Number.isFinite(filters.page) && filters.page > 0) {
      params.append('page', String(filters.page));
    }
    if (
      typeof filters?.perPage === 'number' &&
      Number.isFinite(filters.perPage) &&
      filters.perPage > 0
    ) {
      params.append('perPage', String(filters.perPage));
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/user-points/?${queryString}` : '/user-points/';
    
    return apiClient.get<ImportedPoint[]>(endpoint);
  },
  
  async getPoint(id: number) {
    return apiClient.get<ImportedPoint>(`/user-points/${id}/`);
  },
  
  async createPoint(point: Partial<ImportedPoint>) {
    return apiClient.post<ImportedPoint>('/user-points/', point);
  },
  
  async updatePoint(id: number, updates: Partial<ImportedPoint>) {
    return apiClient.patch<ImportedPoint>(`/user-points/${id}/`, updates);
  },
  
  async deletePoint(id: number) {
    return apiClient.delete(`/user-points/${id}/`);
  },
  
  async bulkUpdatePoints(pointIds: number[], updates: Partial<ImportedPoint>) {
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
