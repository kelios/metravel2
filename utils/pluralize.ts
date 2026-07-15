import { selectPlural, translate as i18nT } from '@/i18n'
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
  return selectPlural(n, {
    one: i18nT('errors:utils.pluralize.value1_den_ccf4a6cb', { value1: n }),
    few: i18nT('errors:utils.pluralize.value1_dnya_eb5bfa3c', { value1: n }),
    many: i18nT('errors:utils.pluralize.value1_dney_b4bd2392', { value1: n }),
    other: i18nT('errors:utils.pluralize.value1_dney_b4bd2392', { value1: n }),
  });
}

export function getDayLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.den_915a5af4'),
    few: i18nT('errors:utils.pluralize.dnya_8134108a'),
    many: i18nT('errors:utils.pluralize.dney_dcbc0521'),
    other: i18nT('errors:utils.pluralize.dney_dcbc0521'),
  });
}

export function getTravelLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.puteshestvie_af5bdd17'),
    few: i18nT('errors:utils.pluralize.puteshestviya_39b91aa9'),
    many: i18nT('errors:utils.pluralize.puteshestviy_d2163ca2'),
    other: i18nT('errors:utils.pluralize.puteshestviy_d2163ca2'),
  });
}

export function getPhotoLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.fotografiya_c07ae562'),
    few: i18nT('errors:utils.pluralize.fotografii_7c873ad1'),
    many: i18nT('errors:utils.pluralize.fotografiy_e6a63104'),
    other: i18nT('errors:utils.pluralize.fotografiy_e6a63104'),
  });
}

export function getCountryLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.strana_37a706b2'),
    few: i18nT('errors:utils.pluralize.strany_97e54e0d'),
    many: i18nT('errors:utils.pluralize.stran_ee2fb9ba'),
    other: i18nT('errors:utils.pluralize.stran_ee2fb9ba'),
  });
}

export function getLocationLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.lokatsiya_33a76b5c'),
    few: i18nT('errors:utils.pluralize.lokatsii_e2abc332'),
    many: i18nT('errors:utils.pluralize.lokatsiy_d23139a0'),
    other: i18nT('errors:utils.pluralize.lokatsiy_d23139a0'),
  });
}

export function getPlaceLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('errors:utils.pluralize.mesto_f62e3de3'),
    few: i18nT('errors:utils.pluralize.mesta_2a37b18a'),
    many: i18nT('errors:utils.pluralize.mest_a176fbe2'),
    other: i18nT('errors:utils.pluralize.mest_a176fbe2'),
  });
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
