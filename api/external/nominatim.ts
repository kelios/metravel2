const BASE = 'https://nominatim.openstreetmap.org';

export interface NominatimSearchParams {
  q: string;
  limit?: number;
  addressdetails?: 0 | 1;
  acceptLanguage?: string;
  countrycodes?: string;
}

export interface NominatimReverseParams {
  lat: number;
  lng: number;
  zoom?: number;
  addressdetails?: 0 | 1;
  acceptLanguage?: string;
  extratags?: 0 | 1;
  namedetails?: 0 | 1;
}

export interface NominatimRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

function applyDefaultHeaders(headers?: HeadersInit): HeadersInit {
  return { Accept: 'application/json', ...(headers ?? {}) };
}

export function nominatimSearch(
  params: NominatimSearchParams,
  init: NominatimRequestInit = {},
): Promise<Response> {
  const search = new URLSearchParams({ format: 'json', q: params.q });
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.addressdetails != null) search.set('addressdetails', String(params.addressdetails));
  if (params.countrycodes) search.set('countrycodes', params.countrycodes);
  if (params.acceptLanguage) search.set('accept-language', params.acceptLanguage);
  return fetch(`${BASE}/search?${search.toString()}`, {
    headers: applyDefaultHeaders(init.headers),
    signal: init.signal,
  });
}

export function nominatimReverse(
  params: NominatimReverseParams,
  init: NominatimRequestInit = {},
): Promise<Response> {
  const search = new URLSearchParams({
    format: 'json',
    lat: String(params.lat),
    lon: String(params.lng),
  });
  if (params.zoom != null) search.set('zoom', String(params.zoom));
  if (params.addressdetails != null) search.set('addressdetails', String(params.addressdetails));
  if (params.extratags != null) search.set('extratags', String(params.extratags));
  if (params.namedetails != null) search.set('namedetails', String(params.namedetails));
  if (params.acceptLanguage) search.set('accept-language', params.acceptLanguage);
  return fetch(`${BASE}/reverse?${search.toString()}`, {
    headers: applyDefaultHeaders(init.headers),
    signal: init.signal,
  });
}
