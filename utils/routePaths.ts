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
export function buildTravelPath(slugOrId: unknown, options?: { encode?: boolean }): string | null {
  const segment = normalizeRouteSegment(slugOrId);
  if (!segment) return null;
  if (/^-?\d+$/.test(segment) && Number(segment) <= 0) return null;
  return `/travels/${options?.encode === false ? segment : encodeURIComponent(segment)}`;
}

/**
 * Путь к путешествию из самой записи: сначала слаг, потом числовой id. Единая
 * реализация двухступенчатого фолбэка — раньше эта пара строк была скопирована
 * в карточке, в шапке детали и в SEO-слое, и копии успели разъехаться
 * контрактом (#1438).
 *
 * Для внутренней навигации id-форма пригодна: роутер приложения открывает
 * статью и по числу. В canonical/og:url и структурированные данные её брать
 * нельзя — прямой заход на `/travels/<id>` прод отдаёт пустым 404 (#1512).
 */
export function buildTravelPathFromTravel(
  travel: { slug?: unknown; id?: unknown } | null | undefined,
  options?: { encode?: boolean },
): string | null {
  if (!travel) return null;
  return buildTravelPath(travel.slug, options) ?? buildTravelPath(travel.id, options);
}

/**
 * Проверка готового адреса, пришедшего с бэкенда (поле `url` карточки), перед
 * тем как отдать его в `href` или в переход.
 *
 * Возвращает адрес как есть либо `null`, если это наша travel-страница с
 * непригодным сегментом (`/travels/null`, `/travels/undefined`, `/travels/0`).
 *
 * #1438: поле `url` уходило в разметку без проверки, и одна запись с таким
 * адресом делала кликабельной ссылку в 404. Проверяем только относительные
 * пути: абсолютный адрес — это внешняя ссылка, наш роутинг её не обслуживает,
 * и подменять её собственным `/travels/<id>` нельзя.
 */
export function sanitizeTravelHref(href: unknown): string | null {
  const raw = String(href ?? '').trim();
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return raw;

  const pathname = raw.split('?')[0].split('#')[0];
  const match = pathname.match(/^\/travels\/([^/]+)/);
  if (!match) return raw;

  return buildTravelPath(decodeSegmentSafely(match[1])) === null ? null : raw;
}

function decodeSegmentSafely(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
