export interface MapFilterValues {
  categories: string[];
  radius: string;
  address: string;
  transportMode?: 'car' | 'bike' | 'foot';
  lastMode?: 'radius' | 'route';
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'map-filters';
const MAX_JSON_LENGTH = 10_000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_CATEGORIES = 50;
const MAX_ADDRESS_LENGTH = 500;

export function sanitizeMapFilterValues(input: unknown): MapFilterValues {
  const fallback: MapFilterValues = {
    categories: [],
    radius: '60',
    address: '',
    transportMode: 'car',
    lastMode: 'radius'
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback;

  const unsafe = input as {
    categories?: unknown;
    radius?: unknown;
    address?: unknown;
    transportMode?: unknown;
    lastMode?: unknown
  };

  const categories = Array.isArray(unsafe.categories)
    ? unsafe.categories
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length < MAX_CATEGORY_LENGTH)
        .slice(0, MAX_CATEGORIES)
    : [];

  const radius =
    typeof unsafe.radius === 'string' && /^\d+$/.test(unsafe.radius) ? unsafe.radius : '60';

  const address =
    typeof unsafe.address === 'string' && unsafe.address.length < MAX_ADDRESS_LENGTH
      ? unsafe.address
      : '';

  const transportMode =
    typeof unsafe.transportMode === 'string' && ['car', 'bike', 'foot'].includes(unsafe.transportMode)
      ? (unsafe.transportMode as 'car' | 'bike' | 'foot')
      : 'car';

  const lastMode =
    typeof unsafe.lastMode === 'string' && ['radius', 'route'].includes(unsafe.lastMode)
      ? (unsafe.lastMode as 'radius' | 'route')
      : 'radius';

  return { categories, radius, address, transportMode, lastMode };
}

export function loadMapFilterValues(storage: StorageLike): MapFilterValues {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (!saved || saved.length === 0 || saved.length >= MAX_JSON_LENGTH) {
      return {
        categories: [],
        radius: '60',
        address: '',
        transportMode: 'car',
        lastMode: 'radius',
      };
    }

    const parsed: unknown = JSON.parse(saved);
    return sanitizeMapFilterValues(parsed);
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
    return {
      categories: [],
      radius: '60',
      address: '',
      transportMode: 'car',
      lastMode: 'radius'
    };
  }
}

export function saveMapFilterValues(storage: StorageLike, values: MapFilterValues): void {
  const sanitized = sanitizeMapFilterValues(values);
  const jsonString = JSON.stringify(sanitized);
  if (jsonString.length >= MAX_JSON_LENGTH) return;
  storage.setItem(STORAGE_KEY, jsonString);
}


