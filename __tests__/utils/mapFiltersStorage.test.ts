import {
  loadMapFilterValues,
  saveMapFilterValues,
  sanitizeMapFilterValues,
  type StorageLike,
} from '@/src/utils/mapFiltersStorage';

describe('mapFiltersStorage', () => {
  const createStorage = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
    const data: Record<string, string> = { ...initial };
    return {
      data,
      getItem: (key) => (key in data ? data[key] : null),
      setItem: (key, value) => {
        data[key] = value;
      },
      removeItem: (key) => {
        delete data[key];
      },
    };
  };

  it('sanitizeMapFilterValues returns defaults for invalid input', () => {
    expect(sanitizeMapFilterValues(null)).toEqual({ categories: [], radius: '60', address: '', transportMode: 'car', lastMode: 'radius' });
    expect(sanitizeMapFilterValues([])).toEqual({ categories: [], radius: '60', address: '', transportMode: 'car', lastMode: 'radius' });
    expect(sanitizeMapFilterValues('x')).toEqual({ categories: [], radius: '60', address: '', transportMode: 'car', lastMode: 'radius' });
  });

  it('sanitizeMapFilterValues validates and trims fields', () => {
    const result = sanitizeMapFilterValues({
      categories: ['  A  ', 1, ''],
      radius: '100',
      address: ' Minsk ',
    });

    expect(result).toEqual({ categories: ['A'], radius: '100', address: ' Minsk ', transportMode: 'car', lastMode: 'radius' });
  });

  it('sanitizeMapFilterValues accepts valid transportMode and lastMode', () => {
    const result = sanitizeMapFilterValues({
      categories: ['A'],
      radius: '60',
      address: 'X',
      transportMode: 'bike',
      lastMode: 'route',
    });

    expect(result).toEqual({
      categories: ['A'],
      radius: '60',
      address: 'X',
      transportMode: 'bike',
      lastMode: 'route',
    });
  });

  it('sanitizeMapFilterValues falls back for invalid transportMode and lastMode', () => {
    const result = sanitizeMapFilterValues({
      categories: ['A'],
      radius: '60',
      address: 'X',
      transportMode: 'plane',
      lastMode: 'foo',
    });

    expect(result).toEqual({
      categories: ['A'],
      radius: '60',
      address: 'X',
      transportMode: 'car',
      lastMode: 'radius',
    });
  });

  it('loadMapFilterValues reads and sanitizes storage data', () => {
    const storage = createStorage({
      'map-filters': JSON.stringify({ categories: ['Food'], radius: '200', address: 'X' }),
    });

    expect(loadMapFilterValues(storage)).toEqual({ categories: ['Food'], radius: '200', address: 'X', transportMode: 'car', lastMode: 'radius' });
  });

  it('loadMapFilterValues clears corrupted JSON', () => {
    const storage = createStorage({ 'map-filters': '{bad json' });

    expect(loadMapFilterValues(storage)).toEqual({ categories: [], radius: '60', address: '', transportMode: 'car', lastMode: 'radius' });
    expect(storage.getItem('map-filters')).toBeNull();
  });

  it('saveMapFilterValues stores sanitized data', () => {
    const storage = createStorage();

    saveMapFilterValues(storage, {
      categories: ['  A  ', ''],
      radius: '60',
      address: '',
      transportMode: 'foot',
      lastMode: 'route',
    });

    const loaded = loadMapFilterValues(storage);
    expect(loaded).toEqual({ categories: ['A'], radius: '60', address: '', transportMode: 'foot', lastMode: 'route' });
  });
});
