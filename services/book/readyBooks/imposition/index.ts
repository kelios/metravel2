import {BOOK_PROFILES} from '../../../../data/travelBooks/schema/profiles.ts';
import type {PrintProfile} from '../../../../types/readyBook.ts';

export type Placement = {folio: number; xMm: number; yMm: number; rotation: 0};
export type ImpositionPlan = {
  profileId: PrintProfile['id']; mode: 'home-rings' | 'home-sewn'; component: 'body' | 'cover';
  sheetMm: [number, number]; pageMm: [number, number]; scale: 1;
  duplexFlip: 'long-edge' | 'short-edge';
  sheets: {front: Placement[]; back: Placement[]}[];
  signatures?: number[];
  control: {rulerMm: 50; toleranceMm: 1}; instructions: string[];
};

/** Coordinates are millimetres from the sheet's top left, viewed face-on. */
export function buildImpositionPlan({profileId, mode, component = 'body'}: {
  profileId: PrintProfile['id']; mode: ImpositionPlan['mode']; component?: ImpositionPlan['component'];
}): ImpositionPlan {
  const profile = BOOK_PROFILES[profileId];
  if (!profile || !['home-rings', 'home-sewn'].includes(mode) || !['body', 'cover'].includes(component)) {
    throw new Error('Unknown imposition profile, mode or component');
  }
  if (mode === 'home-sewn' && (profileId !== 'album-a5' || component !== 'body')) {
    throw new Error('Sewn A4 is supported only for the A5 body; a 300 mm pocket spread does not fit A4');
  }
  const pocket = profileId === 'pocket-150x100';
  const slots = pocket ? [[30, 35], [30, 162]] : [[0.5, 0], [148.5, 0]];
  const place = (folios: number[]) => folios.map((folio, index): Placement => ({
    folio, xMm: slots[index][0], yMm: slots[index][1], rotation: 0,
  }));
  const sheets: ImpositionPlan['sheets'] = [];
  const count = component === 'body' ? 56 : 4;
  const signatures = mode === 'home-sewn' ? [16, 16, 16, 8] : undefined;
  if (signatures) {
    let start = 1;
    for (const size of signatures) {
      for (let depth = 0; depth < size / 4; depth++) {
        sheets.push({
          front: place([start + size - 1 - depth * 2, start + depth * 2]),
          back: place([start + depth * 2 + 1, start + size - 2 - depth * 2]),
        });
      }
      start += size;
    }
  } else {
    for (let first = 1; first <= count; first += 4) {
      sheets.push({front: place([first, first + 2]), back: place(pocket ? [first + 1, first + 3] : [first + 3, first + 1])});
    }
  }
  return {
    profileId, mode, component, sheetMm: pocket ? [210, 297] : [297, 210],
    pageMm: [profile.widthMm, profile.heightMm], scale: 1,
    duplexFlip: pocket ? 'long-edge' : 'short-edge', sheets,
    ...(signatures ? {signatures} : {}), control: {rulerMm: 50, toleranceMm: 1},
    instructions: [
      'Печатать в масштабе 100%, без подгонки и повторного режима «Брошюра».',
      `Двусторонняя печать: переворот по ${pocket ? 'длинной' : 'короткой'} стороне. Сначала проверить подачу одним листом.`,
      'Измерить контрольную линейку 50 мм: допустимо 49–51 мм. Если поля принтера обрезают содержимое, сменить принтер; не уменьшать книгу.',
      ...(signatures ? [
        'Сложить каждый лист по центру 148,5 мм, вложить листы внутри тетрадей 16 + 16 + 16 + 8 страниц. Не вкладывать все тетради друг в друга.',
        'После сгиба подрезать 0,5 мм по внешнему краю до ширины A5 148 мм; учитывать подрезку обеих половин.',
      ] : [
        'Разрезать по границам страниц из карты, совместив лицо и оборот. Собрать по номерам 1–56; обложка нумеруется отдельно 1–4.',
        'Пробивать отверстия только в предусмотренном внутреннем поле 15 мм; до сборки проверить разворот 6/7.',
      ]),
    ],
  };
}
