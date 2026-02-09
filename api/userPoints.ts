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

// JSZip is loaded dynamically to avoid pulling ~90 KiB into the initial bundle
const getJSZip = () => import('jszip').then((m) => m.default ?? m);

type FileInput = File | DocumentPickerAsset;

 const USER_POINTS_LIST_TIMEOUT_MS = 30000;

const normalizeImportPointsResult = (raw: any): ImportPointsResult => {
  if (!raw || typeof raw !== 'object') {
    return {
      importId: '',
      dedupePolicy: 'skip',
      totalParsed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
  }

  const errors = Array.isArray(raw.errors)
    ? raw.errors.map((e: any) => (typeof e === 'object' && e != null ? e : { message: String(e) }))
    : [];

  const created =
    (typeof raw.created === 'number' ? raw.created : undefined) ??
    (typeof raw.imported === 'number' ? raw.imported : undefined) ??
    (Array.isArray(raw.points) ? raw.points.length : undefined) ??
    0;

  const updated =
    (typeof raw.updated === 'number' ? raw.updated : undefined) ??
    (typeof raw.updated_count === 'number' ? raw.updated_count : undefined) ??
    0;

  const skipped =
    (typeof raw.skipped === 'number' ? raw.skipped : undefined) ??
    (typeof raw.skipped_count === 'number' ? raw.skipped_count : undefined) ??
    0;

  const totalParsed =
    (typeof raw.totalParsed === 'number' ? raw.totalParsed : undefined) ??
    (typeof raw.total_parsed === 'number' ? raw.total_parsed : undefined) ??
    (typeof raw.parsed === 'number' ? raw.parsed : undefined) ??
    (typeof raw.imported === 'number' && typeof raw.skipped === 'number'
      ? raw.imported + raw.skipped
      : undefined) ??
    (created + skipped);

  const importId =
    (typeof raw.importId === 'string' ? raw.importId : undefined) ??
    (typeof raw.import_id === 'string' ? raw.import_id : undefined) ??
    (typeof raw.id === 'string' ? raw.id : undefined) ??
    '';

  const dedupePolicy =
    (raw.dedupePolicy === 'merge' || raw.dedupePolicy === 'skip' || raw.dedupePolicy === 'duplicate'
      ? raw.dedupePolicy
      : undefined) ??
    (raw.dedupe_policy === 'merge' || raw.dedupe_policy === 'skip' || raw.dedupe_policy === 'duplicate'
      ? raw.dedupe_policy
      : undefined) ??
    'skip';

  return {
    importId,
    dedupePolicy,
    totalParsed: Number.isFinite(totalParsed) ? totalParsed : 0,
    created: Number.isFinite(created) ? created : 0,
    updated: Number.isFinite(updated) ? updated : 0,
    skipped: Number.isFinite(skipped) ? skipped : 0,
    errors,
  };
};

export const userPointsApi = {
  async importPoints(
    file: FileInput,
    options?: {
      dedupePolicy?: DedupePolicy;
      defaultColor?: string;
      defaultStatus?: string;
    }
  ) {
    const formData = new FormData();

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
      const JSZip = await getJSZip();
      const zip = await JSZip.loadAsync(buffer);

      const fileNames = Object.keys(zip.files);
      const kmlNames = fileNames
        .filter((n) => n.toLowerCase().endsWith('.kml'))
        .filter((n) => !zip.files[n]?.dir);

      if (kmlNames.length === 0) {
        throw new Error('KMZ не содержит KML файла');
      }

      const preferDoc = (name: string) => {
        const lower = name.toLowerCase();
        return lower.endsWith('/doc.kml') || lower.endsWith('doc.kml');
      };

      let bestName: string | null = null;
      let bestText: string | null = null;
      let bestScore = -1;

      for (const name of kmlNames) {
        const kmlFile = zip.file(name);
        if (!kmlFile) continue;
        const kmlText = await kmlFile.async('string');
        const score = (kmlText.match(/<Placemark\b/gi) ?? []).length;

        if (
          score > bestScore ||
          (score === bestScore && bestName != null && preferDoc(name) && !preferDoc(bestName)) ||
          (bestName == null)
        ) {
          bestName = name;
          bestText = kmlText;
          bestScore = score;
        }
      }

      if (!bestText) {
        throw new Error('KMZ не содержит KML файла');
      }

      return bestText;
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
        try {
          const buffer = await blob.arrayBuffer();
          const kmlText = await extractKmlFromKmz(buffer);
          const kmlBlob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
          formData.append('file', kmlBlob, toKmlName(asset.name));
        } catch {
          formData.append('file', blob, asset.name);
        }
      } else {
        formData.append('file', blob, asset.name);
      }
    } else {
      const webFile = file as File;
      const isKmz = String(webFile.name || '').toLowerCase().endsWith('.kmz');

      if (isKmz) {
        try {
          const buffer = await webFile.arrayBuffer();
          const kmlText = await extractKmlFromKmz(buffer);
          const kmlFile = new File([kmlText], toKmlName(webFile.name), {
            type: 'application/vnd.google-earth.kml+xml',
          });
          formData.append('file', kmlFile);
        } catch {
          formData.append('file', webFile);
        }
      } else {
        formData.append('file', webFile);
      }
    }

    const raw = await apiClient.uploadFormData<any>('/user-points/import/', formData, 'POST');
    return normalizeImportPointsResult(raw);
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

    const raw = await apiClient.get<any>(endpoint, USER_POINTS_LIST_TIMEOUT_MS);
    if (Array.isArray(raw)) return raw as ImportedPoint[];
    if (raw && typeof raw === 'object') {
      const data = (raw as any).data;
      if (Array.isArray(data)) return data as ImportedPoint[];
      const results = (raw as any).results;
      if (Array.isArray(results)) return results as ImportedPoint[];
    }
    return [] as ImportedPoint[];
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

  async purgePoints() {
    return apiClient.delete<{ deleted: number }>('/user-points/purge/');
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
  },

  async exportKml() {
    return apiClient.download('/user-points/export-kml/', { method: 'GET' });
  }
};
