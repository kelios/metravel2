// utils/urlParams.ts
// Небольшие чистые помощники для работы с query-параметрами URL. Вынесены сюда,
// чтобы UTM-строители (utils/achievementShare.ts, utils/questResultShare.ts) не
// дублировали одну и ту же логику добавления параметров без потери hash-части.

/** true, если в URL уже есть query-параметр с таким ключом. */
export const hasQueryParam = (url: string, key: string): boolean => {
  const queryStart = url.indexOf('?');
  const firstHash = url.indexOf('#');
  if (queryStart < 0 || (firstHash >= 0 && queryStart > firstHash)) return false;
  const hashStart = url.indexOf('#', queryStart);
  const query = url.slice(queryStart + 1, hashStart < 0 ? undefined : hashStart);
  const encodedKey = encodeURIComponent(key);
  return query.split('&').some((part) => part.startsWith(`${encodedKey}=`));
};

/**
 * Добавляет `key=value` в URL, сохраняя уже существующие query-параметры и
 * hash-часть. Пустое значение не добавляется. Ключ и значение экранируются.
 */
export const appendQueryParam = (url: string, key: string, value: string): string => {
  if (!value) return url;
  const hashStart = url.indexOf('#');
  const base = hashStart < 0 ? url : url.slice(0, hashStart);
  const hash = hashStart < 0 ? '' : url.slice(hashStart + 1);
  const sep = base.includes('?') ? '&' : '?';
  const param = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  const withParam = `${base}${sep}${param}`;
  return hash ? `${withParam}#${hash}` : withParam;
};
