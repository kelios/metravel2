/**
 * Построение внутренних путей приложения из данных, которые могут прийти
 * неполными.
 *
 * Зачем отдельный модуль (#1185): путь собирался шаблонной строкой прямо в
 * местах использования, и пустое поле молча превращалось в валидный с виду
 * адрес. Прод за 48 часов отдал 404 на `/quests/undefined/undefined`,
 * `/api/quests/by-quest-id/undefined/` и `/travels/null` — то есть пользователь
 * кликал по ссылке, которую мы сами и сгенерировали.
 *
 * Ключевая деталь: проверять на `null`/`undefined` недостаточно. Как только
 * такой адрес открыт, роутер отдаёт сегмент обратно уже строкой `"undefined"`,
 * и следующий слой (API-клиент, canonical, разметка) считает её нормальным
 * идентификатором. Поэтому строковые литералы отсекаются наравне с пустыми
 * значениями.
 */

const UNUSABLE_SEGMENTS = new Set(['', 'null', 'undefined', 'nan', 'none', 'false']);

/**
 * Приводит значение к сегменту пути. Возвращает `null`, если сегмент непригоден
 * для навигации: пусто, не-конечное число или строковый литерал пустоты.
 */
export function normalizeRouteSegment(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'object') return null;
  const raw = String(value).trim();
  if (UNUSABLE_SEGMENTS.has(raw.toLowerCase())) return null;
  return raw;
}

/** `true`, если значение годится как сегмент пути (см. `normalizeRouteSegment`). */
export function isUsableRouteSegment(value: unknown): boolean {
  return normalizeRouteSegment(value) !== null;
}

/**
 * Путь к квесту. `null`, если города или квеста нет — вызывающий обязан не
 * рисовать ссылку и не выполнять переход.
 */
export function buildQuestPath(cityId: unknown, questId: unknown): string | null {
  const city = normalizeRouteSegment(cityId);
  const quest = normalizeRouteSegment(questId);
  if (!city || !quest) return null;
  return `/quests/${encodeURIComponent(city)}/${encodeURIComponent(quest)}`;
}

/**
 * Путь к путешествию по slug либо по числовому id. `null`, если ни того, ни
 * другого нет. Нулевой и отрицательный id тоже непригодны: `/travels/0` — такая
 * же несуществующая страница, как `/travels/null`.
 */
export function buildTravelPath(slugOrId: unknown): string | null {
  const segment = normalizeRouteSegment(slugOrId);
  if (!segment) return null;
  if (/^-?\d+$/.test(segment) && Number(segment) <= 0) return null;
  return `/travels/${encodeURIComponent(segment)}`;
}
