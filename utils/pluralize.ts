import { selectPlural, translatePlural } from '@/i18n'
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
  return translatePlural('errors:utils.pluralize.daysCount', n);
}

// Каждый набор форм — одно семейство ключей `<ключ>_one/_few/_many/_other`
// во всех локалях (#2238): форму выбирает `translatePlural` по правилам языка,
// а гейт `__tests__/i18n/pluralFormSets.test.ts` сверяет набор целиком.
export function getDayLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.dayNoun', count);
}

export function getTravelLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.travelNoun', count);
}

export function getPhotoLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.photoNoun', count);
}

export function getCountryLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.countryNoun', count);
}

export function getLocationLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.locationNoun', count);
}

export function getPlaceLabel(count: number): string {
  return translatePlural('errors:utils.pluralize.placeNoun', count);
}

/**
 * «1 фото», «5 фото»; PL «1 zdjęcie», «2 zdjęcia», «5 zdjęć»; EN «1 photo», «5 photos».
 * Число и слово — одно значение семейства: подпись «N фото» больше не заводится
 * отдельным ключом со словом в одной форме (#2238, PDF «9 zdjęcie»).
 */
export function formatPhotos(count: number): string {
  return translatePlural('errors:utils.pluralize.photosCount', count);
}

/** «3 места», «1 место», «5 мест» — число + склонённое существительное. */
export function formatPlaces(count: number): string {
  return `${count} ${getPlaceLabel(count)}`;
}

/**
 * Универсальное склонение: возвращает одну из трёх форм по числу.
 * one — для 1, 21, 31… ; few — для 2-4, 22-24… ; many — для 0, 5-20, 11-14…
 */
export function pluralizeRu(count: number, one: string, few: string, many: string): string {
  return selectPlural(count, { one, few, many, other: many });
}
