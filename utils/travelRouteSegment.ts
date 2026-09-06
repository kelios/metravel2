/**
 * #1801: ключ travel-деталей считают ДВА места — экран маршрута (`param` из
 * роутера) и крошки шапки (сегмент `usePathname()`). Пока они нормализуют
 * сегмент по-разному, у одного и того же маршрута получаются разные ключи:
 * владелец грузит данные в свой, а крошка читает пустой и навсегда остаётся на
 * фолбэке «Путешествие».
 *
 * expo-router на web отдаёт percent-encoded сегменты пути, а `fetchTravelBySlug`
 * кодирует слаг ещё раз, поэтому декодировать нужно ровно один раз.
 */
export function normalizeTravelRouteSegment(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim().split('#')[0].split('%23')[0];
  if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
