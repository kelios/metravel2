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

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}
