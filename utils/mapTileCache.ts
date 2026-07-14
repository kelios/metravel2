// utils/mapTileCache.ts
// Офлайн-кэш тайлов карты для native (iOS/Android). Тайлы пишутся на диск в
// персистентный documentDirectory (НЕ cacheDirectory — ОС чистит cache под
// давлением памяти), реестр скачанных регионов — в AsyncStorage.
//
// Модуль импортируется ТОЛЬКО из native-путей карты (Map.ios.tsx,
// hooks/map/useOfflineTileDownload.ts). expo-file-system подключаем через
// /legacy — главный экспорт бросает legacy-методы в рантайме (NATIVE_COMPAT_RULES §8).
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TILE_ROOT = `${FileSystem.documentDirectory ?? ''}map-tiles/`;
const REGIONS_KEY = 'map-offline-regions';
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

// Суммарный лимит дискового кэша регионов. При превышении удаляем старейший
// регион (FIFO по savedAt), пока не влезем — как в hooks/useOfflineTravelCache.ts.
export const MAX_OFFLINE_BYTES = 500 * 1024 * 1024; // 500 MB
// Средний вес тайла OSM-подложки для оценки размера ДО скачивания.
export const AVG_TILE_BYTES = 15 * 1024;

export interface OfflineBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  bbox: OfflineBBox;
  minZ: number;
  maxZ: number;
  tileCount: number;
  bytes: number;
  savedAt: number;
}

// ───────────────────────── Тайл-математика ─────────────────────────
// Зеркалит questNativeMapPng.ts __qmLngToTileX/__qmLatToTileY (та же формула
// slippy-map, что использует Leaflet), чтобы координаты тайлов совпадали с тем,
// что запрашивает GridLayer в WebView.
export const lngToTileX = (lng: number, z: number): number =>
  ((lng + 180) / 360) * Math.pow(2, z);

export const latToTileY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

const clampTile = (value: number, z: number): number => {
  const max = Math.pow(2, z) - 1;
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
};

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * Перечисляет тайлы, покрывающие bbox на всех зумах [minZ, maxZ].
 * north соответствует меньшему y (slippy-map ось Y растёт на юг).
 */
export const enumerateTiles = (bbox: OfflineBBox, minZ: number, maxZ: number): TileCoord[] => {
  const tiles: TileCoord[] = [];
  const lo = Math.max(0, Math.min(minZ, maxZ));
  const hi = Math.max(minZ, maxZ);
  for (let z = lo; z <= hi; z += 1) {
    const x1 = clampTile(lngToTileX(bbox.west, z), z);
    const x2 = clampTile(lngToTileX(bbox.east, z), z);
    const y1 = clampTile(latToTileY(bbox.north, z), z);
    const y2 = clampTile(latToTileY(bbox.south, z), z);
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
};

/** Оценка количества тайлов для bbox без перечисления (для превью размера). */
export const estimateTiles = (bbox: OfflineBBox, minZ: number, maxZ: number): number => {
  let total = 0;
  const lo = Math.max(0, Math.min(minZ, maxZ));
  const hi = Math.max(minZ, maxZ);
  for (let z = lo; z <= hi; z += 1) {
    const x1 = clampTile(lngToTileX(bbox.west, z), z);
    const x2 = clampTile(lngToTileX(bbox.east, z), z);
    const y1 = clampTile(latToTileY(bbox.north, z), z);
    const y2 = clampTile(latToTileY(bbox.south, z), z);
    const nx = Math.abs(x2 - x1) + 1;
    const ny = Math.abs(y2 - y1) + 1;
    total += nx * ny;
  }
  return total;
};

// ───────────────────────── Файловые операции ─────────────────────────
const tileDir = (z: number): string => `${TILE_ROOT}${z}/`;
const tilePath = (z: number, x: number, y: number): string => `${tileDir(z)}${x}_${y}.png`;

const ensuredDirs = new Set<string>();

const ensureDir = async (dir: string): Promise<void> => {
  if (ensuredDirs.has(dir)) return;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    ensuredDirs.add(dir);
  } catch {
    // Каталог мог быть создан параллельным запросом — не критично.
    ensuredDirs.add(dir);
  }
};

export const hasTile = async (z: number, x: number, y: number): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(tilePath(z, x, y));
    return Boolean(info.exists) && !info.isDirectory;
  } catch {
    return false;
  }
};

/** Читает тайл с диска как data-URL (для инъекции в <img> внутри WebView). */
export const getCachedTileDataUrl = async (
  z: number,
  x: number,
  y: number,
): Promise<string | null> => {
  try {
    const path = tilePath(z, x, y);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.isDirectory) return null;
    const base64 = await FileSystem.readAsStringAsync(path, { encoding: 'base64' });
    if (!base64) return null;
    return `${PNG_DATA_URL_PREFIX}${base64}`;
  } catch {
    return null;
  }
};

/** Сохраняет тайл из base64 (когда данные уже в JS, напр. из WebView). */
export const saveTileBase64 = async (
  z: number,
  x: number,
  y: number,
  base64: string,
): Promise<void> => {
  if (!base64) return;
  const clean = base64.startsWith(PNG_DATA_URL_PREFIX)
    ? base64.slice(PNG_DATA_URL_PREFIX.length)
    : base64;
  try {
    await ensureDir(tileDir(z));
    await FileSystem.writeAsStringAsync(tilePath(z, x, y), clean, { encoding: 'base64' });
  } catch {
    // Диск полон / нет прав — тайл просто не закэшируется.
  }
};

/**
 * Скачивает тайл по URL прямо на диск (downloadAsync — без ручной base64-конверсии
 * сетевого ответа). Возвращает размер в байтах или null при ошибке.
 */
export const downloadTileToDisk = async (
  z: number,
  x: number,
  y: number,
  url: string,
): Promise<number | null> => {
  try {
    await ensureDir(tileDir(z));
    const path = tilePath(z, x, y);
    const result = await FileSystem.downloadAsync(url, path);
    if (!result || result.status !== 200) {
      // Битый ответ (404/429/HTML) — не оставляем мусорный файл.
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {
        // noop
      }
      return null;
    }
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && typeof info.size === 'number' ? info.size : AVG_TILE_BYTES;
  } catch {
    return null;
  }
};

// ───────────────────────── Реестр регионов ─────────────────────────
export const listRegions = async (): Promise<OfflineRegion[]> => {
  try {
    const raw = await AsyncStorage.getItem(REGIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is OfflineRegion =>
      Boolean(r) && typeof r === 'object' && typeof (r as OfflineRegion).id === 'string',
    );
  } catch {
    return [];
  }
};

const writeRegions = async (regions: OfflineRegion[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(regions));
  } catch {
    // noop
  }
};

export const getTotalOfflineBytes = async (): Promise<number> => {
  const regions = await listRegions();
  return regions.reduce((sum, r) => sum + (Number.isFinite(r.bytes) ? r.bytes : 0), 0);
};

/**
 * Удаляет тайлы региона, не покрытые ОСТАЛЬНЫМИ регионами (регионы могут
 * перекрываться — общий тайл не должен пропасть из живого региона).
 */
const deleteRegionTiles = async (
  region: OfflineRegion,
  remaining: OfflineRegion[],
): Promise<void> => {
  const keep = new Set<string>();
  for (const other of remaining) {
    for (const t of enumerateTiles(other.bbox, other.minZ, other.maxZ)) {
      keep.add(`${t.z}/${t.x}/${t.y}`);
    }
  }
  for (const t of enumerateTiles(region.bbox, region.minZ, region.maxZ)) {
    const key = `${t.z}/${t.x}/${t.y}`;
    if (keep.has(key)) continue;
    try {
      await FileSystem.deleteAsync(tilePath(t.z, t.x, t.y), { idempotent: true });
    } catch {
      // noop
    }
  }
};

export const deleteRegion = async (id: string): Promise<void> => {
  const regions = await listRegions();
  const target = regions.find((r) => r.id === id);
  if (!target) return;
  const remaining = regions.filter((r) => r.id !== id);
  await deleteRegionTiles(target, remaining);
  await writeRegions(remaining);
};

/**
 * Регистрирует скачанный регион и обеспечивает суммарный лимит: пока суммарный
 * размер > MAX_OFFLINE_BYTES — удаляем старейший регион (FIFO по savedAt).
 */
export const registerRegion = async (region: OfflineRegion): Promise<void> => {
  const regions = await listRegions();
  const next = regions.filter((r) => r.id !== region.id);
  next.push(region);
  next.sort((a, b) => a.savedAt - b.savedAt);
  let total = next.reduce((sum, r) => sum + (Number.isFinite(r.bytes) ? r.bytes : 0), 0);
  while (total > MAX_OFFLINE_BYTES && next.length > 1) {
    const oldest = next.shift();
    if (!oldest) break;
    await deleteRegionTiles(oldest, next);
    total -= Number.isFinite(oldest.bytes) ? oldest.bytes : 0;
  }
  await writeRegions(next);
};
