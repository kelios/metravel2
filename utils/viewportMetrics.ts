/**
 * Единственная точка чтения размеров вьюпорта на web (#1643).
 *
 * `window.innerWidth`/`innerHeight` — forced layout: браузер обязан досчитать
 * раскладку перед возвратом значения. Во время boot дерево грязное после
 * каждого коммита React, поэтому КАЖДОЕ повторное чтение стоит полного layout
 * заново, а читателей у ширины вьюпорта в шелле несколько независимых.
 *
 * Прод-профиль 2026-08-30 (mobile, CPU ×4, cold, `.codex-temp/1643/`):
 * `getWebWindowSnapshot` (стор `useResponsive`) — 39.4 мс self на `/`,
 * `getHeaderVariant` (`app/(tabs)/_layout.tsx`) — 18.0 мс на `/` и 42.1 мс на
 * travel-детали. Ни один из них не зависит от содержимого DOM.
 *
 * Размер вьюпорта меняется только на `resize`/`orientationchange`, поэтому
 * значение кэшируется до следующего такого события: вместо N layout'ов за boot
 * остаётся один. Это не эвристика с допуском — кэш инвалидируется ровно теми
 * событиями, которые единственные и меняют результат.
 *
 * Инвариант порядка слушателей: слушатель инвалидации вешается ПЕРЕД первым
 * чтением (см. `readViewportSize`), то есть раньше любого прикладного
 * `resize`-обработчика, который позовёт это чтение. При одинаковой цели
 * (`window`) обработчики вызываются в порядке регистрации, поэтому к моменту
 * прикладного обработчика кэш уже сброшен.
 */

export type ViewportSize = {
  width: number;
  height: number;
};

let cachedSize: ViewportSize | null = null;
let invalidationAttached = false;

/** Сбросить кэш вручную (тесты, экзотические источники смены геометрии). */
export const invalidateViewportSize = (): void => {
  cachedSize = null;
};

const attachInvalidationListeners = (): void => {
  if (invalidationAttached) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  invalidationAttached = true;
  window.addEventListener('resize', invalidateViewportSize, { passive: true });
  window.addEventListener('orientationchange', invalidateViewportSize, { passive: true });
};

/**
 * Размер вьюпорта или `null`, если окна нет (SSR/native) либо браузер отдал
 * нечисловое/нулевое значение. `null` — то же самое условие, что раньше
 * проверяли на месте вызова, поведение не меняется.
 */
export const readViewportSize = (): ViewportSize | null => {
  if (typeof window === 'undefined') return null;
  // Слушатели вешаются до чтения: иначе `resize`, случившийся между чтением и
  // подпиской, оставил бы кэш с протухшим значением навсегда.
  attachInvalidationListeners();
  if (cachedSize) return cachedSize;

  const width = Number(window.innerWidth);
  const height = Number(window.innerHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;

  cachedSize = { width, height };
  return cachedSize;
};

/** Ширина вьюпорта или `null` — короткая форма для читателей брейкпоинтов. */
export const readViewportWidth = (): number | null => readViewportSize()?.width ?? null;

/** Только для тестов: полный сброс состояния модуля. */
export const __resetViewportMetricsForTests = (): void => {
  cachedSize = null;
  if (invalidationAttached && typeof window !== 'undefined') {
    window.removeEventListener('resize', invalidateViewportSize);
    window.removeEventListener('orientationchange', invalidateViewportSize);
  }
  invalidationAttached = false;
};
