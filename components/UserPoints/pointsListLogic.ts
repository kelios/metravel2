export type PointsPreset = {
  id: string;
  label: string;
  baseCategoryNames: string[];
  nearbyCategoryNames: string[];
  proximityKm: number;
};

export const POINTS_PRESETS: PointsPreset[] = [
  {
    id: 'hike_mountains',
    label: 'Поход в горы',
    baseCategoryNames: ['Гора', 'Горный хребет', 'Перевал', 'Треккинговый маршрут'],
    nearbyCategoryNames: [
      'Приют',
      'Заповедник',
      'Национальный парк',
      'Озеро',
      'Родник',
      'Река',
      'Ручей',
      'Водопад',
      'Скала',
      'Утес',
      'Ущелье',
      'Долина',
      'Каньон',
      'Пещера',
      'Ледник',
      'Экологическая тропа',
      'Обзорная точка',
      'Кемпинг',
      'Парковка',
      'Горячий источник',
    ],
    proximityKm: 10,
  },
  {
    id: 'history_ruins',
    label: 'Руины',
    baseCategoryNames: [
      'Руины',
      'Руины замка',
      'Руины усадьбы',
      'Руины мельницы',
      'Руины дворца',
      'Руины моста',
      'Руины церкви',
      'Замок',
      'Крепость',
      'Форт',
      'Усадьба',
      'Древний город',
      'Археологическая достопримечательность',
      'Акведук',
      'Амфитеатр',
      'Арка',
      'Башня',
      'Бункер',
      'Дот',
    ],
    nearbyCategoryNames: [
      'Музей',
      'Музей под открытым небом',
      'Памятник',
      'Религиозная достопримечательность',
      'Церковь',
      'Собор',
      'Часовня',
      'Монастырь',
      'Дворец',
      'Обзорная точка',
      'Парк',
      'Рынок',
      'Кафе',
      'Ресторан',
      'Парковка',
    ],
    proximityKm: 8,
  },
  {
    id: 'lakes',
    label: 'Озёра',
    baseCategoryNames: ['Озеро'],
    nearbyCategoryNames: ['Родник', 'Водопад', 'Парк', 'Лес', 'Место отдыха', 'Пляж', 'Скала'],
    proximityKm: 6,
  },
  {
    id: 'with_kids',
    label: 'С детьми',
    baseCategoryNames: ['Парк развлечений', 'Парк', 'Место отдыха'],
    nearbyCategoryNames: ['Кафе', 'Ресторан', 'Туалет', 'Остановка', 'Музей', 'Пляж', 'Озеро'],
    proximityKm: 4,
  },
  {
    id: 'nature',
    label: 'Природа',
    baseCategoryNames: ['Заповедник', 'Лес', 'Парк', 'Водопад', 'Озеро'],
    nearbyCategoryNames: ['Родник', 'Скала', 'Пещера', 'Гора', 'Место отдыха'],
    proximityKm: 10,
  },
];

export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const pickRandomDistinct = <T,>(items: T[], count: number): T[] => {
  const n = items.length;
  if (count <= 0 || n === 0) return [];
  if (count >= n) return items.slice();

  const result: T[] = [];
  const picked = new Set<number>();
  while (result.length < count) {
    const idx = Math.floor(Math.random() * n);
    if (picked.has(idx)) continue;
    picked.add(idx);
    result.push(items[idx]);
  }
  return result;
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const toTrimmedStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : [];

export const normalizeCategoryIdsFromPoint = (point: unknown): string[] => {
  const src = asObject(point);
  if (!src) return [];

  const multiAlt = src.categories ?? src.categories_ids;
  const fromMultiAlt = toTrimmedStrings(multiAlt);
  if (fromMultiAlt.length > 0) return fromMultiAlt;

  const direct = src.categoryIds ?? src.category_ids;
  const fromDirect = toTrimmedStrings(direct);
  if (fromDirect.length > 0) return fromDirect;

  const single = src.categoryId ?? src.category_id;
  if (single != null && String(single).trim()) return [String(single).trim()];

  const legacy = src.category;
  if (legacy != null && String(legacy).trim()) return [String(legacy).trim()];

  return [];
};

export const sortPointsByPresetProximity = <T extends Record<string, unknown>>(
  list: T[],
  activePreset: PointsPreset | null,
  resolveCategoryIdsByNames: (names: string[]) => string[]
): T[] => {
  if (!activePreset) return list;

  const proximityKm = Number(activePreset.proximityKm);
  if (!Number.isFinite(proximityKm) || proximityKm <= 0) return list;

  const wantedIds = resolveCategoryIdsByNames(activePreset.nearbyCategoryNames);
  if (wantedIds.length === 0) return list;

  const cellSizeKm = proximityKm;
  const cellSizeDeg = cellSizeKm / 111;

  const toCell = (lat: number, lng: number) => {
    const cx = Math.floor(lng / cellSizeDeg);
    const cy = Math.floor(lat / cellSizeDeg);
    return `${cx}:${cy}`;
  };

  const grid = new Map<string, T[]>();
  for (const p of list) {
    const lat = Number(p?.latitude);
    const lng = Number(p?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = toCell(lat, lng);
    const bucket = grid.get(key);
    if (bucket) bucket.push(p);
    else grid.set(key, [p]);
  }

  const wantedSet = new Set(wantedIds);

  const scorePoint = (p: T) => {
    const lat = Number(p?.latitude);
    const lng = Number(p?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;

    const cx = Math.floor(lng / cellSizeDeg);
    const cy = Math.floor(lat / cellSizeDeg);
    const found = new Set<string>();

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx}:${cy + dy}`;
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (const q of bucket) {
          if (q === p) continue;
          const qLat = Number(q?.latitude);
          const qLng = Number(q?.longitude);
          if (!Number.isFinite(qLat) || !Number.isFinite(qLng)) continue;
          if (haversineKm(lat, lng, qLat, qLng) > proximityKm) continue;
          const ids = Array.isArray(q?.categoryIds) ? q.categoryIds : [];
          for (const id of ids) {
            if (wantedSet.has(String(id))) found.add(String(id));
          }
        }
      }
    }

    return found.size;
  };

  return list
    .map((p) => ({ ...p, __presetScore: scorePoint(p) }))
    .sort((a, b) => {
      const sa = Number((a as Record<string, unknown>).__presetScore) || 0;
      const sb = Number((b as Record<string, unknown>).__presetScore) || 0;
      if (sb !== sa) return sb - sa;
      return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
    });
};
