const TRUSTED_HTTPS_HOST = 'metravel.by';
const CUSTOM_SCHEME_PREFIX = /^metravel:\/\//i;
const DOT_PATH_SEGMENT = /(?:^|\/)(?:(?:\.|%2e){1,2})(?:\/|$)/i;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;
const MALFORMED_PERCENT_ESCAPE = /%(?![0-9a-f]{2})/i;

function getCustomSchemePath(url: string): string {
  const schemeSeparatorIndex = url.indexOf('://');
  const routeWithSuffix = url.slice(schemeSeparatorIndex + 3);
  const suffixIndex = routeWithSuffix.search(/[?#]/);
  const route =
    suffixIndex === -1
      ? routeWithSuffix
      : routeWithSuffix.slice(0, suffixIndex);

  return route.startsWith('/') ? route : `/${route}`;
}

function getRawHttpsPath(url: string): string {
  const schemeSeparatorIndex = url.indexOf('://');
  const authorityAndPath = url.slice(schemeSeparatorIndex + 3);
  const firstDelimiterIndex = authorityAndPath.search(/[/?#]/);
  if (
    firstDelimiterIndex === -1 ||
    authorityAndPath[firstDelimiterIndex] !== '/'
  ) {
    return '/';
  }

  const pathWithSuffix = authorityAndPath.slice(firstDelimiterIndex);
  const suffixIndex = pathWithSuffix.search(/[?#]/);
  return suffixIndex === -1
    ? pathWithSuffix
    : pathWithSuffix.slice(0, suffixIndex);
}

function getRawHttpsAuthority(url: string): string {
  const schemeSeparatorIndex = url.indexOf('://');
  const authorityAndPath = url.slice(schemeSeparatorIndex + 3);
  const authorityEndIndex = authorityAndPath.search(/[/?#]/);
  return authorityEndIndex === -1
    ? authorityAndPath
    : authorityAndPath.slice(0, authorityEndIndex);
}

function hasAsciiControlCharacter(
  value: string,
  includeSpace = false,
): boolean {
  const upperBound = includeSpace ? 32 : 31;
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= upperBound || codePoint === 127;
  });
}

function isSafeRawPath(path: string): boolean {
  return (
    !hasAsciiControlCharacter(path, true) &&
    !path.includes('\\') &&
    !DOT_PATH_SEGMENT.test(path) &&
    !ENCODED_PATH_SEPARATOR.test(path)
  );
}

function isSafeDynamicSegment(segment: string): boolean {
  if (!segment) return false;

  try {
    const decoded = decodeURIComponent(segment);
    return (
      decoded.length > 0 &&
      decoded !== '.' &&
      decoded !== '..' &&
      !decoded.includes('/') &&
      !decoded.includes('\\') &&
      !hasAsciiControlCharacter(decoded)
    );
  } catch {
    return false;
  }
}

function isSafePreservedSearch(search: string): boolean {
  try {
    const decoded = decodeURIComponent(search);

    return (
      !hasAsciiControlCharacter(decoded) &&
      // NSURL normalizes an invalid `%ZZ` input to `%25ZZ` before React Native
      // receives it. Validate the decoded form too so that normalization cannot
      // turn malformed device input into an accepted query.
      !MALFORMED_PERCENT_ESCAPE.test(decoded)
    );
  } catch {
    return false;
  }
}

/**
 * Статические экраны, которые приложение открывает по ссылке ЛЮБОГО
 * происхождения. #1724: семейство `/trips/*` сюда не входило вовсе, поэтому
 * `https://metravel.by/trips` и `/trips/my` отбраковывались этой таблицей, а
 * `redirectSystemPath` возвращал `null` — на холодном старте это и есть
 * «открылась главная».
 */
const PUBLIC_STATIC_ROUTES = new Set<string>([
  '/map',
  '/trips',
  '/trips/my',
  '/trips/community',
]);

/**
 * Экраны, которые открываются только «изнутри» — кастомной схемой и
 * уведомлением. Их веб-адреса приложение перехватывать не должно: серверный
 * AASA их не объявляет, и тап по такой ссылке остаётся в браузере.
 */
const IN_APP_STATIC_ROUTES = new Set<string>(['search', 'favorites', 'messages']);

/** Одноуровневые маршруты со свободным сегментом-слагом. */
const SLUG_ROUTE_PARENTS = new Set<string>(['travels', 'article', 'user']);

const isPositiveIntegerSegment = (segment: string): boolean =>
  /^[1-9]\d*$/.test(segment);

function isSupportedRoute(
  pathname: string,
  source: 'https' | 'custom-scheme' | 'notification',
): boolean {
  const segments = pathname.split('/');
  if (
    segments[0] !== '' ||
    segments.some((segment, index) => index > 0 && !segment)
  ) {
    return false;
  }

  if (PUBLIC_STATIC_ROUTES.has(pathname)) return true;

  const isInAppSource = source === 'custom-scheme' || source === 'notification';

  if (segments.length === 2) {
    return isInAppSource && IN_APP_STATIC_ROUTES.has(segments[1]);
  }

  if (segments.length === 3) {
    if (
      SLUG_ROUTE_PARENTS.has(segments[1]) &&
      isSafeDynamicSegment(segments[2])
    ) {
      return true;
    }
    // Деталь поездки: только числовой id. `/trips/my` и `/trips/community`
    // разобраны выше как статические экраны того же семейства.
    return segments[1] === 'trips' && isPositiveIntegerSegment(segments[2]);
  }

  if (segments.length === 4) {
    if (
      segments[1] === 'quests' &&
      isSafeDynamicSegment(segments[2]) &&
      isSafeDynamicSegment(segments[3])
    ) {
      return true;
    }
    // `/trips/plan/<id>` — ссылка, которую приложение само раздаёт на шаринг
    // (`utils/tripPlanLinks.ts` → `buildTripPlanUrl`/`buildTripTelegramShareUrl`),
    // поэтому она обязана открываться и по https, а не только по кастомной схеме.
    // `/trips/plan` и `/trips/plan/create` сюда СОЗНАТЕЛЬНО не входят: это
    // раздел и начало сценария создания, ссылками наружу они не раздаются.
    return (
      segments[1] === 'trips' &&
      segments[2] === 'plan' &&
      isPositiveIntegerSegment(segments[3])
    );
  }

  return false;
}

/**
 * Maps an OS-delivered MeTravel URL to the exact native route policy.
 * HTTPS mirrors AASA; the custom scheme keeps explicit tracked native fallbacks.
 *
 * ВНИМАНИЕ (#1724 / #1413): «зеркало AASA» — договорённость, а не автоматика.
 * С 2026-09-04 production AASA отдаёт `appIDs` + `components` и включает
 * семейство `/trips` (листинг, деталь по id, `/trips/plan/<id>`). Таблица ниже
 * должна оставаться согласованной с этими компонентами. Неподдерживаемый вход
 * возвращает null, чтобы warm-ссылка не сбивала текущий экран.
 * Native hash navigation is intentionally excluded; the path and query are preserved.
 */
export function mapIncomingAppLinkToHref(url: unknown): string | null {
  if (
    typeof url !== 'string' ||
    url.length === 0 ||
    url !== url.trim() ||
    hasAsciiControlCharacter(url)
  ) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    let source: 'https' | 'custom-scheme';
    let pathname: string;
    let rawPath: string;

    if (protocol === 'https:') {
      if (
        parsed.hostname.toLowerCase() !== TRUSTED_HTTPS_HOST ||
        getRawHttpsAuthority(url).toLowerCase() !== TRUSTED_HTTPS_HOST ||
        parsed.port !== '' ||
        parsed.username !== '' ||
        parsed.password !== ''
      ) {
        return null;
      }
      source = 'https';
      pathname = parsed.pathname;
      rawPath = getRawHttpsPath(url);
    } else if (protocol === 'metravel:' && CUSTOM_SCHEME_PREFIX.test(url)) {
      if (
        parsed.port !== '' ||
        parsed.username !== '' ||
        parsed.password !== ''
      ) {
        return null;
      }
      source = 'custom-scheme';
      pathname = getCustomSchemePath(url);
      rawPath = pathname;
    } else {
      return null;
    }

    if (
      !isSafeRawPath(rawPath) ||
      !isSafePreservedSearch(parsed.search) ||
      !isSupportedRoute(pathname, source)
    ) {
      return null;
    }

    return `${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function mapRelativeNotificationRoute(value: string): string | null {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value !== value.trim() ||
    hasAsciiControlCharacter(value)
  ) {
    return null;
  }

  const suffixIndex = value.search(/[?#]/);
  const rawPath = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  if (!isSafeRawPath(rawPath)) return null;

  try {
    const parsed = new URL(value, `https://${TRUSTED_HTTPS_HOST}`);
    if (
      parsed.origin !== `https://${TRUSTED_HTTPS_HOST}` ||
      !isSafePreservedSearch(parsed.search) ||
      !isSupportedRoute(parsed.pathname, 'notification')
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function safePayloadSegment(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  return isSafeDynamicSegment(normalized) ? encodeURIComponent(normalized) : null;
}

function positiveIntegerPayloadSegment(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  return isPositiveIntegerSegment(normalized) ? normalized : null;
}

/**
 * Convert a notification payload into one known in-app route. Both path-shaped
 * values and structured quest/message/trip payloads use the same route policy;
 * external URLs and arbitrary screen names fail closed.
 */
export function mapNotificationPayloadToHref(
  payload: Record<string, unknown>,
): string | null {
  if (!payload || typeof payload !== 'object') return null;

  if (typeof payload.url === 'string') {
    if (/^(?:https|metravel):/i.test(payload.url)) {
      return mapIncomingAppLinkToHref(payload.url);
    }
    return mapRelativeNotificationRoute(payload.url);
  }

  if (typeof payload.screen !== 'string') return null;
  if (payload.screen.startsWith('/')) {
    return mapRelativeNotificationRoute(payload.screen);
  }

  if (payload.screen === 'quest') {
    const city = safePayloadSegment(payload.city);
    const questId = safePayloadSegment(payload.questId ?? payload.quest_id);
    return city && questId ? `/quests/${city}/${questId}` : null;
  }

  if (payload.screen === 'message') {
    const hasUserId = Object.prototype.hasOwnProperty.call(payload, 'userId') ||
      Object.prototype.hasOwnProperty.call(payload, 'user_id');
    if (!hasUserId) return '/messages';
    const userId = positiveIntegerPayloadSegment(payload.userId ?? payload.user_id);
    return userId ? `/messages?userId=${userId}` : null;
  }

  if (payload.screen === 'trip') {
    const tripId = positiveIntegerPayloadSegment(payload.tripId ?? payload.trip_id);
    return tripId ? `/trips/${tripId}` : null;
  }

  return null;
}
