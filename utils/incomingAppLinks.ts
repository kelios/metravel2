const TRUSTED_HTTPS_HOST = 'metravel.by';
const CUSTOM_SCHEME_PREFIX = /^metravel:\/\//i;
const DOT_PATH_SEGMENT = /(?:^|\/)(?:(?:\.|%2e){1,2})(?:\/|$)/i;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

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
    return !hasAsciiControlCharacter(decodeURIComponent(search));
  } catch {
    return false;
  }
}

function isSupportedRoute(
  pathname: string,
  source: 'https' | 'custom-scheme',
): boolean {
  const segments = pathname.split('/');
  if (
    segments[0] !== '' ||
    segments.some((segment, index) => index > 0 && !segment)
  ) {
    return false;
  }

  if (segments.length === 2) {
    return (
      segments[1] === 'map' ||
      (source === 'custom-scheme' &&
        ['search', 'favorites'].includes(segments[1]))
    );
  }

  if (segments.length === 3) {
    return (
      ['travels', 'article', 'user'].includes(segments[1]) &&
      isSafeDynamicSegment(segments[2])
    );
  }

  if (segments.length === 4) {
    return (
      (segments[1] === 'quests' &&
        isSafeDynamicSegment(segments[2]) &&
        isSafeDynamicSegment(segments[3])) ||
      (source === 'custom-scheme' &&
        segments[1] === 'trips' &&
        segments[2] === 'plan' &&
        /^[1-9]\d*$/.test(segments[3]))
    );
  }

  return false;
}

/**
 * Maps an OS-delivered MeTravel URL to the exact native route policy.
 * HTTPS mirrors AASA; the custom scheme keeps explicit tracked native fallbacks.
 * Unsupported input returns null so warm links leave the current screen untouched.
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
