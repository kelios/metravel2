import type { OfflineBBox, TileCoord } from './mapTileCache.types';

export type { OfflineBBox, OfflineRegion, TileCoord } from './mapTileCache.types';
export { isTileCacheEntryFresh } from './mapTileCachePolicy';

/**
 * Web-резолв кэша тайлов. Дисковый SDK остаётся в `mapTileCache.ts` и в
 * web-сборку не входит: на сайте эти вызовы не выполняются.
 */
export const getCachedTileDataUrl = async (
  _z: number,
  _x: number,
  _y: number,
): Promise<string | null> => null;

export const downloadTileToDisk = async (
  _z: number,
  _x: number,
  _y: number,
  _url: string,
): Promise<number | null> => null;

export const hasFreshCachedTile = async (
  _z: number,
  _x: number,
  _y: number,
): Promise<boolean> => false;

export const listViewportTiles = (
  _bbox: OfflineBBox,
  _zoom: number,
  _maxTiles: number,
): TileCoord[] => [];

export const writeTileDataUrlToDisk = async (
  _z: number,
  _x: number,
  _y: number,
  _dataUrl: string,
): Promise<number | null> => null;

export const deleteRegion = async (_id: string): Promise<void> => undefined;
