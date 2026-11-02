import {selectPluralCategory} from '../../../../i18n/pluralRules';

type RussianForms = {one: string; few: string; many: string};

/** Printed books are Russian: «31 место», «4 страницы», «108 страниц» via the shared plural rules (#2949). */
export function countRu(count: number, forms: RussianForms) {
  const category = selectPluralCategory(count, 'ru');
  return `${count} ${category === 'one' || category === 'few' ? forms[category] : forms.many}`;
}

export const PLACES: RussianForms = {one: 'место', few: 'места', many: 'мест'};
export const PAGES: RussianForms = {one: 'страница', few: 'страницы', many: 'страниц'};
export const PAGES_ACC: RussianForms = {one: 'страницу', few: 'страницы', many: 'страниц'};
export const QUESTS: RussianForms = {one: 'квест', few: 'квеста', many: 'квестов'};
export const SHEETS: RussianForms = {one: 'лист', few: 'листа', many: 'листов'};

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** «ноябрь 2026» — the month of the edition, printed instead of revision hashes. */
export function editionMonth(editionDate: string) {
  const match = /^(\d{4})-(\d{2})/.exec(editionDate);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error(`Invalid edition date: ${editionDate}`);
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** «Издание: ноябрь 2026» — the reader-facing edition line instead of revision hashes. */
export function editionLabel(editionDate: string) {
  return `Издание: ${editionMonth(editionDate)}`;
}
