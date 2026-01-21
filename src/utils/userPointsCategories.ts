export type CategoryDictionaryItem = {
  id: string;
  name: string;
};

export const normalizeCategoryDictionary = (
  raw: unknown
): CategoryDictionaryItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (item && typeof item === 'object') {
        const id =
          (item as any).id ??
          (item as any).value ??
          (item as any).category_id ??
          (item as any).pk ??
          idx;
        const name =
          (item as any).name ??
          (item as any).name_ru ??
          (item as any).title_ru ??
          (item as any).title ??
          (item as any).text ??
          String(id);
        return { id: String(id).trim(), name: String(name).trim() };
      }
      const text = String(item ?? '').trim();
      if (!text) return null;
      return { id: text, name: text };
    })
    .filter((v: any): v is CategoryDictionaryItem => Boolean(v?.id));
};

export const createCategoryNameToIdsMap = (
  dictionary: CategoryDictionaryItem[]
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const entry of dictionary) {
    const rawName = String(entry.name ?? entry.id ?? '').trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();
    const prev = map.get(key) ?? [];
    if (!prev.includes(entry.id)) {
      map.set(key, [...prev, entry.id]);
    }
  }
  return map;
};

export const resolveCategoryIdsByNames = (
  names: string[],
  map: Map<string, string[]>
): string[] => {
  const result: string[] = [];
  for (const name of names) {
    const key = String(name ?? '').trim().toLowerCase();
    if (!key) continue;
    const ids = map.get(key) ?? [];
    for (const id of ids) {
      if (!result.includes(id)) {
        result.push(id);
      }
    }
  }
  return result;
};
