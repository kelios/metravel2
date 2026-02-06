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
 * Склонение «путешествие»: «1 путешествие», «3 путешествия», «5 путешествий»
 */
export function getTravelLabel(count: number): string {
  if (count === 1) return 'путешествие';
  if (count < 5) return 'путешествия';
  return 'путешествий';
}

/**
 * Склонение «фотография»: «1 фотография», «3 фотографии», «5 фотографий»
 */
export function getPhotoLabel(count: number): string {
  if (count === 1) return 'фотография';
  if (count >= 2 && count <= 4) return 'фотографии';
  return 'фотографий';
}

/**
 * Склонение «страна»: «1 страна», «3 страны», «5 стран»
 */
export function getCountryLabel(count: number): string {
  if (count === 1) return 'страна';
  if (count < 5) return 'страны';
  return 'стран';
}

/**
 * Склонение «локация»: «1 локация», «3 локации», «5 локаций»
 */
export function getLocationLabel(count: number): string {
  if (count === 1) return 'локация';
  if (count >= 2 && count <= 4) return 'локации';
  return 'локаций';
}
