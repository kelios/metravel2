/**
 * Функции склонения русских существительных.
 * Канонический модуль; ранее жил в services/pdf-export/utils/pluralize.ts.
 * Вынесен сюда, чтобы критический чанк страницы путешествия не подтягивал
 * граф services/pdf-export.
 */

export function formatDays(days?: number | null): string {
  if (typeof days !== 'number' || Number.isNaN(days)) return '';
  const n = Math.max(0, Math.round(days));
  if (n === 0) return '';
  if (n % 10 === 1 && n % 100 !== 11) return `${n} день`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
    return `${n} дня`;
  }
  return `${n} дней`;
}

export function getDayLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'день';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'дня';
  return 'дней';
}

export function getTravelLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'путешествие';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'путешествия';
  return 'путешествий';
}

export function getPhotoLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'фотография';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'фотографии';
  return 'фотографий';
}

export function getCountryLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'страна';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'страны';
  return 'стран';
}

export function getLocationLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'локация';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'локации';
  return 'локаций';
}
