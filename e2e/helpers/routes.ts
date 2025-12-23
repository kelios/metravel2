export function getTravelsListPath(): string {
  const raw = (process.env.E2E_TRAVELS_LIST_PATH || '/travelsby').trim();
  if (!raw) return '/travelsby';
  return raw.startsWith('/') ? raw : `/${raw}`;
}
