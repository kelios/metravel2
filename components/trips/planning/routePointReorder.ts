// components/trips/planning/routePointReorder.ts
// #1303: чистая арифметика переупорядочивания точек маршрута. Одни и те же
// функции обслуживают стрелки (keyboard/a11y fallback) и drag&drop, поэтому
// desktop web, mobile web и Android считают новую позицию одинаково. Здесь нет
// ни React, ни платформенных API — только индексы и измеренная геометрия строк.

/** Вертикальный габарит строки списка, как его отдаёт `onLayout` контейнера. */
export type RouteRowSpan = { y: number; height: number };

/** Перестановка элемента списка. Выход за границы оставляет список нетронутым. */
export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Куда переезжает индекс, за которым мы следим (например, редактируемая точка),
 * после переноса элемента `from` → `to`. Без этого форма редактирования после
 * переупорядочивания начала бы править соседнюю точку.
 */
export const remapIndexAfterMove = (
  index: number | null,
  from: number,
  to: number,
): number | null => {
  if (index == null || from === to) return index;
  if (index === from) return to;
  if (from < index && to >= index) return index - 1;
  if (from > index && to <= index) return index + 1;
  return index;
};

/**
 * Позиция, в которую упадёт перетаскиваемая строка. Считаем по центру строки в
 * её текущем (сдвинутом на `deltaY`) положении и по измеренным габаритам:
 * строки в списке разной высоты, поэтому «дельта / высота строки» врёт.
 */
export const resolveDropIndex = (
  spans: ReadonlyArray<RouteRowSpan | undefined>,
  fromIndex: number,
  deltaY: number,
): number => {
  const total = spans.length;
  if (total < 2 || fromIndex < 0 || fromIndex >= total) return fromIndex;

  const from = spans[fromIndex];
  if (!from) return fromIndex;

  const center = from.y + from.height / 2 + deltaY;
  for (let index = 0; index < total; index += 1) {
    const span = spans[index];
    if (!span) continue;
    if (center < span.y + span.height) return index;
  }
  return total - 1;
};
