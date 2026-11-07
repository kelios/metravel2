/* global module */

// Pure ingress policy shared by native routing, website handoff and Node SSG.
const TRUSTED_HTTPS_HOST = 'metravel.by';
const CUSTOM_SCHEME_PREFIX = /^metravel:\/\//i;
const DOT_PATH_SEGMENT = /(?:^|\/)(?:(?:\.|%2e){1,2})(?:\/|$)/i;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;
const MALFORMED_PERCENT_ESCAPE = /%(?![0-9a-f]{2})/i;

function getCustomSchemePath(url) {
  const schemeSeparatorIndex = url.indexOf('://');
  const routeWithSuffix = url.slice(schemeSeparatorIndex + 3);
  const suffixIndex = routeWithSuffix.search(/[?#]/);
  const route =
    suffixIndex === -1
      ? routeWithSuffix
      : routeWithSuffix.slice(0, suffixIndex);

  return route.startsWith('/') ? route : `/${route}`;
}

function getRawHttpsPath(url) {
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

function getRawHttpsAuthority(url) {
  const schemeSeparatorIndex = url.indexOf('://');
  const authorityAndPath = url.slice(schemeSeparatorIndex + 3);
  const authorityEndIndex = authorityAndPath.search(/[/?#]/);
  return authorityEndIndex === -1
    ? authorityAndPath
    : authorityAndPath.slice(0, authorityEndIndex);
}

function hasAsciiControlCharacter(
  value,
  includeSpace = false,
) {
  const upperBound = includeSpace ? 32 : 31;
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= upperBound || codePoint === 127;
  });
}

function isSafeRawPath(path) {
  return (
    !hasAsciiControlCharacter(path, true) &&
    !path.includes('\\') &&
    !DOT_PATH_SEGMENT.test(path) &&
    !ENCODED_PATH_SEPARATOR.test(path)
  );
}

function isSafeDynamicSegment(segment) {
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

function isSafePreservedSearch(search) {
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
const PUBLIC_STATIC_ROUTES = new Set([
  '/map',
  '/quests',
  '/trips',
  '/trips/my',
  '/trips/community',
]);

/**
 * Экраны, которые открываются только «изнутри» — кастомной схемой и
 * уведомлением. Их веб-адреса приложение перехватывать не должно: серверный
 * AASA их не объявляет, и тап по такой ссылке остаётся в браузере.
 */
const IN_APP_STATIC_ROUTES = new Set(['search', 'favorites', 'messages']);

/**
 * Одноуровневые маршруты со свободным сегментом-слагом. `quests` — лендинг
 * города (`app/(tabs)/quests/[city]`): на него ведёт локальное напоминание
 * «вернуться к квестам города» (`services/notifications.ts`), и без этой записи
 * тап по уведомлению молча ничего не открывал (DL-3).
 */
const SLUG_ROUTE_PARENTS = new Set(['travels', 'article', 'user', 'quests']);

/**
 * Семейства путей, которые Android-приложение забирает у браузера (App Links,
 * `android.intentFilters` в `app.json`). #3104: фильтр был `pathPrefix: "/"`,
 * то есть весь домен, а таблица выше знала лишь часть путей — любая другая
 * страница сайта (`/places/help`, `/become-author`) открывала приложение и
 * превращалась в главную. Список зеркалит компоненты серверного AASA, как и
 * `isSupportedRoute`; тест `__tests__/utils/incomingAppLinkRouteParity.test.ts`
 * сверяет все три. Внутри семейства точный маршрут по-прежнему решает политика,
 * а неподдерживаемый путь уходит во внешний браузер (`classifyIncomingAppLink`).
 */
const ANDROID_APP_LINK_PATHS = Object.freeze([
  Object.freeze({ path: '/map' }),
  Object.freeze({ path: '/quests' }),
  Object.freeze({ pathPrefix: '/quests/' }),
  Object.freeze({ path: '/trips' }),
  Object.freeze({ pathPrefix: '/trips/' }),
  Object.freeze({ pathPrefix: '/travels/' }),
  Object.freeze({ pathPrefix: '/article/' }),
  Object.freeze({ pathPrefix: '/user/' }),
]);

/** Поймает ли Android-фильтр этот путь (семантика `path` / `pathPrefix` манифеста). */
function isAndroidAppLinkPath(pathname) {
  return ANDROID_APP_LINK_PATHS.some((entry) =>
    entry.path !== undefined
      ? pathname === entry.path
      : pathname.startsWith(entry.pathPrefix),
  );
}

const isPositiveIntegerSegment = (segment) =>
  /^[1-9]\d*$/.test(segment);

function isSupportedRoute(
  pathname,
  source,
) {
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

function classifyIncomingAppLink(url) {
  const ignore = Object.freeze({ kind: 'ignore' });
  if (
    typeof url !== 'string' ||
    url.length === 0 ||
    url !== url.trim() ||
    hasAsciiControlCharacter(url)
  ) {
    return ignore;
  }

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    let source;
    let pathname;
    let rawPath;

    if (protocol === 'https:') {
      if (
        parsed.hostname.toLowerCase() !== TRUSTED_HTTPS_HOST ||
        getRawHttpsAuthority(url).toLowerCase() !== TRUSTED_HTTPS_HOST ||
        parsed.port !== '' ||
        parsed.username !== '' ||
        parsed.password !== ''
      ) {
        return ignore;
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
        return ignore;
      }
      source = 'custom-scheme';
      pathname = getCustomSchemePath(url);
      rawPath = pathname;
    } else {
      return ignore;
    }

    if (!isSafeRawPath(rawPath) || !isSafePreservedSearch(parsed.search)) {
      return ignore;
    }

    if (isSupportedRoute(pathname, source)) {
      return { kind: 'route', href: `${pathname}${parsed.search}` };
    }

    // #3104: безопасная https-ссылка на сайт без экрана в приложении. ОС отдала
    // её приложению (Android App Links берут семейство целиком, а старые сборки —
    // весь домен), и единственный честный ответ — открыть сайт во внешнем
    // браузере, а не молча показать главную. Кастомная схема и уведомления
    // остаются fail-closed: у них нет «сайта», куда можно вернуть пользователя.
    if (source === 'https') {
      return { kind: 'external', url: `https://${TRUSTED_HTTPS_HOST}${pathname}${parsed.search}` };
    }
    return ignore;
  } catch {
    return ignore;
  }
}

/**
 * Maps an OS-delivered MeTravel URL to the exact native route policy.
 * HTTPS mirrors AASA; the custom scheme keeps explicit tracked native fallbacks.
 *
 * ВНИМАНИЕ (#1724 / #1413): «зеркало AASA» — договорённость, а не автоматика.
 * С 2026-09-04 production AASA отдаёт `appIDs` + `components` и включает
 * семейство `/trips` (листинг, деталь по id, `/trips/plan/<id>`). Таблица выше
 * должна оставаться согласованной с этими компонентами и с `ANDROID_APP_LINK_PATHS`.
 * Неподдерживаемый вход возвращает null, чтобы warm-ссылка не сбивала текущий
 * экран; что с ним делать дальше (внешний браузер или ничего), решает
 * `classifyIncomingAppLink`.
 * Native hash navigation is intentionally excluded; the path and query are preserved.
 */
function mapIncomingAppLinkToHref(url) {
  const decision = classifyIncomingAppLink(url);
  return decision.kind === 'route' ? decision.href : null;
}

function mapRelativeNotificationRoute(value) {
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

function safePayloadSegment(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  return isSafeDynamicSegment(normalized) ? encodeURIComponent(normalized) : null;
}

function positiveIntegerPayloadSegment(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  return isPositiveIntegerSegment(normalized) ? normalized : null;
}

/**
 * Convert a notification payload into one known in-app route. Both path-shaped
 * values and structured quest/message/trip payloads use the same route policy;
 * external URLs and arbitrary screen names fail closed.
 */
function mapNotificationPayloadToHref(
  payload,
) {
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

module.exports = {
  ANDROID_APP_LINK_PATHS,
  classifyIncomingAppLink,
  isAndroidAppLinkPath,
  mapIncomingAppLinkToHref,
  mapNotificationPayloadToHref,
};
