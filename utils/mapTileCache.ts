// utils/mapTileCache.ts
// Прозрачный кэш реально просмотренных тайлов для native (iOS/Android).
// Массовая/опережающая загрузка стандартных OSM-тайлов запрещена политикой
// tile.openstreetmap.org, поэтому этот модуль не перечисляет и не скачивает
// регионы. Реестр старых регионов читается только для удаления legacy-данных.
// expo-file-system подключаем через /legacy — главный экспорт бросает
// legacy-методы в рантайме (NATIVE_COMPAT_RULES §8).
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TILE_ROOT = `${FileSystem.documentDirectory ?? ''}map-tiles/`;
const REGIONS_KEY = 'map-offline-regions';
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const TILE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Средний вес одного тайла используется как fallback, если файловая система не
// вернула размер после обычной интерактивной загрузки.
const AVG_TILE_BYTES = 15 * 1024;

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

export const isTileCacheEntryFresh = (
  modificationTimeSeconds: number | undefined,
  nowMs = Date.now(),
): boolean => {
  if (!Number.isFinite(modificationTimeSeconds)) return false;
  const ageMs = nowMs - Number(modificationTimeSeconds) * 1000;
  return ageMs >= 0 && ageMs <= TILE_CACHE_MAX_AGE_MS;
};

// Тайл-математика нужна только для точечного удаления старых регионов.
const lngToTileX = (lng: number, z: number): number =>
  ((lng + 180) / 360) * Math.pow(2, z);

const latToTileY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

const clampTile = (value: number, z: number): number => {
  const max = Math.pow(2, z) - 1;
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
};

interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * Перечисляет тайлы, покрывающие bbox на всех зумах [minZ, maxZ].
 * north соответствует меньшему y (slippy-map ось Y растёт на юг).
 */
const enumerateTiles = (bbox: OfflineBBox, minZ: number, maxZ: number): TileCoord[] => {
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
    if (!isTileCacheEntryFresh(info.modificationTime)) {
      await FileSystem.deleteAsync(path, { idempotent: true });
      return null;
    }
    const base64 = await FileSystem.readAsStringAsync(path, { encoding: 'base64' });
    if (!base64) return null;
    return `${PNG_DATA_URL_PREFIX}${base64}`;
  } catch {
    return null;
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
const listLegacyRegions = async (): Promise<OfflineRegion[]> => {
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

const writeLegacyRegions = async (regions: OfflineRegion[]): Promise<void> => {
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(regions));
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

/** Удаляет данные старого bulk-региона при явном удалении legacy-пакета. */
export const deleteRegion = async (id: string): Promise<void> => {
  const regions = await listLegacyRegions();
  const target = regions.find((r) => r.id === id);
  if (!target) return;
  const remaining = regions.filter((r) => r.id !== id);
  await deleteRegionTiles(target, remaining);
  await writeLegacyRegions(remaining);
};
