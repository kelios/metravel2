/**
 * Функции склонения русских существительных для PDF-генераторов.
 * Единая реализация вместо дублирования в каждом генераторе.
 */

/**
 * Форматирует количество дней: «1 день», «3 дня», «5 дней»
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

/**
 * Склонение «день»: возвращает только слово — «день», «дня», «дней»
 */
export function getDayLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'день';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'дня';
  return 'дней';
}

/**
 * Склонение «путешествие»: «1 путешествие», «3 путешествия», «5 путешествий»
 */
export function getTravelLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'путешествие';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'путешествия';
  return 'путешествий';
}

/**
 * Склонение «фотография»: «1 фотография», «3 фотографии», «5 фотографий»
 */
export function getPhotoLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'фотография';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'фотографии';
  return 'фотографий';
}

/**
 * Склонение «страна»: «1 страна», «3 страны», «5 стран»
 */
export function getCountryLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'страна';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'страны';
  return 'стран';
}

/**
 * Склонение «локация»: «1 локация», «3 локации», «5 локаций»
 */
export function getLocationLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'локация';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'локации';
  return 'локаций';
}
