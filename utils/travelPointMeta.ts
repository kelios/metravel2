type UnknownRecord = Record<string, unknown>;

const normalizeCategoryNameValue = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeCategoryNameValue(item));
  }
  if (typeof value === 'object') {
    const record = value as UnknownRecord;
    return normalizeCategoryNameValue(
      record.name ??
        record.title ??
        record.category ??
        record.label ??
        record.text ??
        ''
    );
  }
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/[;,]/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const normalizeCategoryIdValue = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeCategoryIdValue(item));
  }
  if (typeof value === 'object') {
    const record = value as UnknownRecord;
    return normalizeCategoryIdValue(
      record.id ??
        record.value ??
        record.category_id ??
        record.categoryId ??
        record.pk ??
        ''
    );
  }
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/[;,]/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

export type PointCategorySource = {
  categoryName?: unknown;
  category?: unknown;
  categoryId?: unknown;
  category_id?: unknown;
  categoryIds?: unknown;
  category_ids?: unknown;
  categories?: unknown;
};

export const getPointCategoryNames = (point: PointCategorySource): string[] => {
  const names = new Set<string>();
  normalizeCategoryNameValue(point.categoryName).forEach((item) => names.add(item));
  normalizeCategoryNameValue(point.category).forEach((item) => names.add(item));
  normalizeCategoryNameValue(point.categories).forEach((item) => names.add(item));
  return Array.from(names);
};

export const getPointCategoryIds = (point: PointCategorySource): string[] => {
  const ids = new Set<string>();
  normalizeCategoryIdValue(point.categories).forEach((item) => ids.add(item));
  normalizeCategoryIdValue(point.categoryIds).forEach((item) => ids.add(item));
  normalizeCategoryIdValue(point.category_ids).forEach((item) => ids.add(item));
  normalizeCategoryIdValue(point.categoryId ?? point.category_id ?? point.category).forEach((item) =>
    ids.add(item)
  );
  return Array.from(ids);
};
