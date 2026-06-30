// Лёгкие фиче-флаги через EXPO_PUBLIC_* env (инлайнятся Metro/Expo на web и native).
// Централизуем чтение, чтобы флаг легко снять одним местом, когда фича стабилизируется.

const isFalsyFlag = (value: unknown): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no';
};

/**
 * Создание пользовательской категории точки маршрута прямо из редактора точки
 * (компонент SimpleMultiSelect в EditMarkerModal).
 *
 * Бэкенд-эндпоинт (тикет #633, POST /categoryTravelAddress/) задеплоен на прод —
 * фича включена по умолчанию. Kill-switch для отката без передеплоя кода:
 * EXPO_PUBLIC_POINT_CATEGORY_CREATE=false
 */
export const isPointCategoryCreateEnabled = (): boolean =>
  !isFalsyFlag(process.env.EXPO_PUBLIC_POINT_CATEGORY_CREATE);
