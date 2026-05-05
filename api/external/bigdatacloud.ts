const BASE = 'https://api.bigdatacloud.net';

export interface BigDataCloudRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export function bigDataCloudReverse(
  lat: number,
  lng: number,
  localityLanguage = 'ru',
  init: BigDataCloudRequestInit = {},
): Promise<Response> {
  const search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    localityLanguage,
  });
  return fetch(`${BASE}/data/reverse-geocode-client?${search.toString()}`, {
    headers: init.headers,
    signal: init.signal,
  });
}
