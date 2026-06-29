// Лёгкие фиче-флаги через EXPO_PUBLIC_* env (инлайнятся Metro/Expo на web и native).
// Централизуем чтение, чтобы флаг легко снять одним местом, когда фича стабилизируется.

const isTruthyFlag = (value: unknown): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes';
};

/**
 * Создание пользовательской категории точки маршрута прямо из редактора точки
 * (компонент SimpleMultiSelect в EditMarkerModal).
 *
 * OFF по умолчанию до готовности бэкенд-эндпоинта (тикет #633): без него
 * созданный на лету id не сохранится при апсерте travel (categories.set()
 * принимает только существующие pk). Включить на dev: EXPO_PUBLIC_POINT_CATEGORY_CREATE=true
 */
export const isPointCategoryCreateEnabled = (): boolean =>
  isTruthyFlag(process.env.EXPO_PUBLIC_POINT_CATEGORY_CREATE);
