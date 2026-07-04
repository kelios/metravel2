import { apiClient } from './client';
import type {
  ImportedPoint,
  ImportPointsResult,
  ImportPreviewResult,
  ImportPreviewPoint,
  ImportPreviewSummary,
  DedupePolicy,
  PointFilters,
  RouteRequest,
  RouteResponse,
  RecommendationRequest,
  RecommendationResponse,
  UserPointsStats
} from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';

type FileInput = File | DocumentPickerAsset;

export interface ImportOptions {
  dedupePolicy?: DedupePolicy;
  defaultColor?: string;
  defaultStatus?: string;
}

 const USER_POINTS_LIST_TIMEOUT_MS = 30000;

const normalizeImportPointsResult = (raw: unknown): ImportPointsResult => {
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

  const r = raw as Record<string, unknown>;

  const rawErrors = r.errors;
  const errors: Record<string, unknown>[] = Array.isArray(rawErrors)
    ? rawErrors.map((e: unknown) =>
        e && typeof e === 'object' ? (e as Record<string, unknown>) : { message: String(e) }
      )
    : [];

  const created =
    (typeof r.created === 'number' ? r.created : undefined) ??
    (typeof r.imported === 'number' ? r.imported : undefined) ??
    (Array.isArray(r.points) ? r.points.length : undefined) ??
    0;

  const updated =
    (typeof r.updated === 'number' ? r.updated : undefined) ??
    (typeof r.updated_count === 'number' ? r.updated_count : undefined) ??
    0;

  const skipped =
    (typeof r.skipped === 'number' ? r.skipped : undefined) ??
    (typeof r.skipped_count === 'number' ? r.skipped_count : undefined) ??
    0;

  const totalParsed =
    (typeof r.totalParsed === 'number' ? r.totalParsed : undefined) ??
    (typeof r.total_parsed === 'number' ? r.total_parsed : undefined) ??
    (typeof r.parsed === 'number' ? r.parsed : undefined) ??
    (typeof r.imported === 'number' && typeof r.skipped === 'number'
      ? (r.imported as number) + (r.skipped as number)
      : undefined) ??
    (created + skipped);

  const importId =
    (typeof r.importId === 'string' ? r.importId : undefined) ??
    (typeof r.import_id === 'string' ? r.import_id : undefined) ??
    (typeof r.id === 'string' ? r.id : undefined) ??
    '';

  const dp = r.dedupePolicy ?? r.dedupe_policy;
  const dedupePolicy: DedupePolicy =
    (dp === 'merge' || dp === 'skip' || dp === 'duplicate' ? dp : 'skip');

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

const toNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x))) : [];

const normalizePreviewPoint = (raw: unknown): ImportPreviewPoint => {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: typeof p.name === 'string' && p.name ? p.name : 'Без названия',
    description: typeof p.description === 'string' ? p.description : null,
    latitude: toNumber(p.latitude),
    longitude: toNumber(p.longitude),
    address: typeof p.address === 'string' ? p.address : null,
    color: typeof p.color === 'string' ? p.color : 'brown',
    status: typeof p.status === 'string' ? p.status : 'planned',
    source: typeof p.source === 'string' ? p.source : '',
    originalId:
      typeof p.original_id === 'string'
        ? p.original_id
        : typeof p.originalId === 'string'
          ? p.originalId
          : null,
    categoryIds: toStringArray(p.category_ids ?? p.categoryIds),
  };
};

const normalizeImportPreviewSummary = (raw: unknown): ImportPreviewSummary => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : [];
  return {
    totalParsed: toNumber(s.total_parsed ?? s.totalParsed),
    valid: toNumber(s.valid),
    created: toNumber(s.created),
    updated: toNumber(s.updated),
    skipped: toNumber(s.skipped),
    duplicates: toNumber(s.duplicates),
    warnings: strings(s.warnings),
    errors: strings(s.errors),
  };
};

const normalizeImportPreviewResult = (raw: unknown): ImportPreviewResult => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dp = r.dedupe_policy ?? r.dedupePolicy;
  const dedupePolicy: DedupePolicy =
    dp === 'merge' || dp === 'skip' || dp === 'duplicate' ? dp : 'merge';
  const previewRows = Array.isArray(r.points_preview)
    ? r.points_preview
    : Array.isArray(r.points)
      ? r.points
      : [];
  return {
    importId:
      (typeof r.importId === 'string' ? r.importId : undefined) ??
      (typeof r.import_id === 'string' ? r.import_id : undefined) ??
      '',
    dryRun: r.dry_run === true || r.dryRun === true,
    source: typeof r.source === 'string' ? r.source : '',
    dedupePolicy,
    points: previewRows.map(normalizePreviewPoint),
    summary: normalizeImportPreviewSummary(r.summary),
  };
};

/**
 * Resolve a picked file / File into a FormData `file` part usable on web and native.
 * Backend now parses every supported format server-side (KML/KMZ/GPX/GeoJSON/JSON),
 * so no client-side KMZ extraction happens here anymore.
 */
const appendFilePart = async (formData: FormData, file: FileInput): Promise<void> => {
  if ('uri' in file) {
    const asset = file as DocumentPickerAsset;
    const webFile = (asset as DocumentPickerAsset & { file?: File }).file ?? null;

    if (webFile) {
      formData.append('file', webFile);
      return;
    }

    // Native: pass the RN multipart part { uri, name, type }. apiClient uploads
    // native FormData through XHR which serializes such parts correctly.
    formData.append('file', {
      uri: asset.uri,
      name: asset.name || 'points',
      type: asset.mimeType || 'application/octet-stream',
    } as unknown as Blob);
    return;
  }

  formData.append('file', file as File);
};

const buildImportFormData = async (
  file: FileInput,
  options?: ImportOptions,
  dryRun = false
): Promise<FormData> => {
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
  if (dryRun) {
    formData.append('dry_run', 'true');
  }

  await appendFilePart(formData, file);
  return formData;
};

export const userPointsApi = {
  /**
   * Server-side preview (dry-run): backend parses + validates the file and returns
   * `points_preview` + `summary` without writing anything to the DB.
   */
  async previewImport(file: FileInput, options?: ImportOptions): Promise<ImportPreviewResult> {
    const formData = await buildImportFormData(file, options, true);
    const raw = await apiClient.uploadFormData<unknown>('/user-points/import/', formData, 'POST');
    return normalizeImportPreviewResult(raw);
  },

  async importPoints(file: FileInput, options?: ImportOptions) {
    const formData = await buildImportFormData(file, options, false);
    const raw = await apiClient.uploadFormData<unknown>('/user-points/import/', formData, 'POST');
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

    const raw = await apiClient.get<unknown>(endpoint, USER_POINTS_LIST_TIMEOUT_MS);
    if (Array.isArray(raw)) return raw as ImportedPoint[];
    if (raw && typeof raw === 'object') {
      const rec = raw as Record<string, unknown>;
      if (Array.isArray(rec.data)) return rec.data as ImportedPoint[];
      if (Array.isArray(rec.results)) return rec.results as ImportedPoint[];
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
      route: RouteResponse;
    }>('/user-points/route/save/', { name, route, pointIds });
  },
  
  async getSavedRoutes() {
    return apiClient.get<{ routes: unknown[] }>('/user-points/routes/');
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
