type ProfileNameFields = {
  first_name?: unknown;
  last_name?: unknown;
} | null | undefined;

const EMPTY_PROFILE_NAME_VALUES = new Set(['null', 'undefined']);

const FIRST_PARTY_NAME_BLOCKLIST = new Set([
  'about',
  'accountconfirmation',
  'admin',
  'api',
  'article',
  'articles',
  'calendar',
  'contact',
  'cookies',
  'disclaimer',
  'export',
  'favorites',
  'history',
  'login',
  'map',
  'messages',
  'places',
  'privacy',
  'profile',
  'quests',
  'registration',
  'search',
  'settings',
  'terms',
  'travel',
  'travels',
  'trips',
  'user',
  'userpoints',
]);

const hasUrlPrefix = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ||
  /^\/\//.test(value) ||
  /^www\./i.test(value) ||
  /^(?:www\.)?metravel\.by(?:[/:?#]|$)/i.test(value);

const parseUrlLikeValue = (value: string): URL | null => {
  if (!hasUrlPrefix(value)) return null;
  const withProtocol =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^\/\//.test(value)
      ? value
      : `https://${value}`;
  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
};

const decodePathName = (value: string): string => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const recoverFirstPartyProfileName = (url: URL): string => {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const isMetravelHost = host === 'metravel.by' || host.endsWith('.metravel.by');
  if (!isMetravelHost) return '';

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length !== 1) return '';

  const candidate = decodePathName(pathParts[0]);
  if (!candidate || FIRST_PARTY_NAME_BLOCKLIST.has(candidate.toLowerCase())) return '';
  return candidate;
};

export const normalizeProfileName = (raw: unknown): string => {
  const str = String(raw ?? '').trim();
  if (!str) return '';
  const lower = str.toLowerCase();
  if (EMPTY_PROFILE_NAME_VALUES.has(lower)) return '';

  const parsedUrl = parseUrlLikeValue(str);
  if (parsedUrl) {
    return recoverFirstPartyProfileName(parsedUrl);
  }
  if (hasUrlPrefix(str)) return '';

  return str;
};

export const resolveProfileFullName = (profile: ProfileNameFields): string => {
  if (!profile) return '';
  return [normalizeProfileName(profile.first_name), normalizeProfileName(profile.last_name)]
    .filter(Boolean)
    .join(' ');
};
