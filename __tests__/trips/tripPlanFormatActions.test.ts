import { applyTripPlanFormat } from '@/components/trips/planning/tripPlanFormatActions';
import { parseTripPlanInline, parseTripPlanRichText } from '@/components/trips/planning/tripPlanRichText';

/**
 * #2072: кнопки редактора плана ставят и снимают разметку #2070. Каждый
 * результат сверяется с разборщиком показа (`tripPlanRichText.ts`): кнопка,
 * чей текст разметкой не читается, пользователю бесполезна.
 */
const sel = (start: number, end = start) => ({ start, end });

describe('applyTripPlanFormat — жирный и курсив (#2072)', () => {
  it('оборачивает выделенное слово в ** и оставляет выделенным само слово', () => {
    const result = applyTripPlanFormat('Ужин в кафе', sel(7, 11), 'bold');
    expect(result.value).toBe('Ужин в **кафе**');
    expect(result.value.slice(result.selection.start, result.selection.end)).toBe('кафе');
    expect(parseTripPlanInline(result.value)).toEqual([
      { text: 'Ужин в ', bold: false, italic: false },
      { text: 'кафе', bold: true, italic: false },
    ]);
  });

  it('повторное нажатие снимает ** (выделение внутри и выделение вместе с маркерами)', () => {
    const once = applyTripPlanFormat('Ужин в кафе', sel(7, 11), 'bold');
    expect(applyTripPlanFormat(once.value, once.selection, 'bold')).toEqual({
      value: 'Ужин в кафе',
      selection: sel(7, 11),
    });
    expect(applyTripPlanFormat('a **b** c', sel(2, 7), 'bold')).toEqual({ value: 'a b c', selection: sel(2, 3) });
  });

  it('курсив через _ читается разборщиком и снимается повторно', () => {
    const result = applyTripPlanFormat('очень важно', sel(6, 11), 'italic');
    expect(result.value).toBe('очень _важно_');
    expect(parseTripPlanInline(result.value)[1]).toEqual({ text: 'важно', bold: false, italic: true });
    expect(applyTripPlanFormat(result.value, result.selection, 'italic').value).toBe('очень важно');
  });

  it('курсор внутри слова — оборачивается слово целиком', () => {
    const result = applyTripPlanFormat('Ночь: хостел', sel(9), 'bold');
    expect(result.value).toBe('Ночь: **хостел**');
    expect(result.value.slice(result.selection.start, result.selection.end)).toBe('хостел');
  });

  it('курсор между словами — пара маркеров и курсор между ними', () => {
    expect(applyTripPlanFormat('a  b', sel(2), 'bold')).toEqual({ value: 'a **** b', selection: sel(4) });
  });

  it('пробелы по краям выделения остаются снаружи маркеров', () => {
    const result = applyTripPlanFormat('взять воду ', sel(6, 11), 'bold');
    expect(result.value).toBe('взять **воду** ');
    expect(parseTripPlanInline(result.value)[1]).toEqual({ text: 'воду', bold: true, italic: false });
  });

  it('выделение на несколько строк оборачивает каждую строку отдельно', () => {
    const result = applyTripPlanFormat('один\n\nдва', sel(0, 9), 'bold');
    expect(result.value).toBe('**один**\n\n**два**');
    expect(result.selection).toEqual(sel(0, result.value.length));
  });
});

describe('applyTripPlanFormat — заголовок и списки (#2072)', () => {
  it('курсор в строке → «## » и строка становится заголовком дня; курсор сдвигается за маркер', () => {
    const value = 'Вступление\nСуббота, Краков\nтекст';
    const result = applyTripPlanFormat(value, sel(14), 'heading');
    expect(result.value).toBe('Вступление\n## Суббота, Краков\nтекст');
    expect(result.selection).toEqual(sel(17));
    expect(parseTripPlanRichText(result.value)[1].kind).toBe('day');
  });

  it('три строки → «- » у каждой, повторное нажатие снимает', () => {
    const value = 'вода\nхлеб\nсыр';
    const result = applyTripPlanFormat(value, sel(0, value.length), 'bullet');
    expect(result.value).toBe('- вода\n- хлеб\n- сыр');
    expect(parseTripPlanRichText(result.value).map((line) => line.kind)).toEqual(['bullet', 'bullet', 'bullet']);
    expect(applyTripPlanFormat(result.value, result.selection, 'bullet').value).toBe(value);
  });

  it('нумерованный список нумерует по порядку, пропуская пустые строки', () => {
    const result = applyTripPlanFormat('паспорт\n\nбилеты\nстраховка', sel(0, 24), 'ordered');
    expect(result.value).toBe('1. паспорт\n\n2. билеты\n3. страховка');
  });

  it('список поверх нумерованного заменяет маркер, а не добавляет второй', () => {
    expect(applyTripPlanFormat('1. a\n2. b', sel(0, 9), 'bullet').value).toBe('- a\n- b');
    expect(applyTripPlanFormat('## День', sel(4), 'bullet').value).toBe('- День');
  });

  it('частично размеченный блок сначала размечается целиком', () => {
    expect(applyTripPlanFormat('- a\nb', sel(0, 5), 'bullet').value).toBe('- a\n- b');
  });

  it('выделение до перевода строки не захватывает следующую строку', () => {
    expect(applyTripPlanFormat('a\nb\nc', sel(0, 2), 'bullet').value).toBe('- a\nb\nc');
  });

  it('пустая строка под курсором получает маркер — так начинают новый список', () => {
    expect(applyTripPlanFormat('a\n\nb', sel(2), 'bullet')).toEqual({ value: 'a\n- \nb', selection: sel(4) });
  });

  it('курсор внутри старого маркера встаёт в начало текста строки', () => {
    expect(applyTripPlanFormat('## День', sel(1), 'heading')).toEqual({ value: 'День', selection: sel(0) });
  });

  it('выделение за пределами текста не ломает функцию', () => {
    expect(applyTripPlanFormat('abc', sel(-5, 99), 'bold').value).toBe('**abc**');
    expect(applyTripPlanFormat('', sel(0), 'heading')).toEqual({ value: '## ', selection: sel(3) });
  });
});

describe('applyTripPlanFormat — находки ревью #2072', () => {
  it('курсор на пустой первой строке: маркер получает она, а не следующая', () => {
    expect(applyTripPlanFormat('\nabc', sel(0), 'heading')).toEqual({ value: '## \nabc', selection: sel(3) });
    expect(applyTripPlanFormat('\n\nabc', sel(0), 'bullet').value).toBe('- \n\nabc');
  });

  it('повторный «Жирный»/«Курсив» после многострочной обёртки снимает маркеры у каждой строки', () => {
    for (const action of ['bold', 'italic'] as const) {
      const once = applyTripPlanFormat('foo\nbar', sel(0, 7), action);
      expect(applyTripPlanFormat(once.value, once.selection, action).value).toBe('foo\nbar');
    }
  });

  it('жирный поверх выделения с жирными кусками сливает стиль, а не склеивает маркеры', () => {
    expect(applyTripPlanFormat('**a** и **b**', sel(0, 13), 'bold').value).toBe('**a и b**');
    const line = applyTripPlanFormat('Ужин в **кафе** у озера', sel(0, 23), 'bold');
    expect(line.value).toBe('**Ужин в кафе у озера**');
    expect(parseTripPlanInline(line.value)).toEqual([{ text: 'Ужин в кафе у озера', bold: true, italic: false }]);
    expect(applyTripPlanFormat('- **Ночь:** отель', sel(0, 17), 'bold').value).toBe('- **Ночь: отель**');
    expect(applyTripPlanFormat('_a_ и _b_', sel(0, 9), 'italic').value).toBe('_a и b_');
  });

  it('жирный и курсив на одном слове снимаются по отдельности в любом порядке', () => {
    const press = (value: string, selection: { start: number; end: number }, ...actions: ('bold' | 'italic')[]) =>
      actions.reduce((state, action) => applyTripPlanFormat(state.value, state.selection, action), { value, selection });
    expect(press('кафе', sel(0, 4), 'bold', 'italic').value).toBe('**_кафе_**');
    expect(press('кафе', sel(0, 4), 'bold', 'italic', 'italic')).toEqual({ value: '**кафе**', selection: sel(2, 6) });
    expect(press('кафе', sel(0, 4), 'bold', 'italic', 'bold')).toEqual({ value: '_кафе_', selection: sel(1, 5) });
    expect(press('кафе', sel(0, 4), 'italic', 'bold', 'italic')).toEqual({ value: '**кафе**', selection: sel(2, 6) });
    expect(parseTripPlanInline(press('кафе', sel(0, 4), 'italic', 'bold', 'italic').value)).toEqual([
      { text: 'кафе', bold: true, italic: false },
    ]);
  });

  it('повторное нажатие на пустой паре между словами снимает её', () => {
    const once = applyTripPlanFormat('слово ', sel(6), 'bold');
    expect(once.value).toBe('слово ****');
    expect(applyTripPlanFormat(once.value, once.selection, 'bold')).toEqual({ value: 'слово ', selection: sel(6) });
    const italic = applyTripPlanFormat('слово ', sel(6), 'italic');
    expect(applyTripPlanFormat(italic.value, italic.selection, 'italic').value).toBe('слово ');
  });

  it('пустая пара в строке пункта встаёт после маркера строки; курсив между `**` не трогает жирный', () => {
    expect(applyTripPlanFormat('- вода', sel(0), 'bold').value).toBe('- ****вода');
    expect(applyTripPlanFormat('**жир**', sel(6), 'italic').value).not.toBe('**жир');
  });

  it('курсив на выделении, разрезающем слово, дотягивается до границ слова', () => {
    const result = applyTripPlanFormat('Ужин в кафе у озера', sel(10, 14), 'italic');
    expect(result.value).toBe('Ужин в _кафе у озера_');
    expect(applyTripPlanFormat(result.value, result.selection, 'italic').value).toBe('Ужин в кафе у озера');
  });

  it('жирный по всей строке пункта или заголовка оставляет маркер строки снаружи', () => {
    const bullet = applyTripPlanFormat('- вода', sel(0, 6), 'bold');
    expect(bullet.value).toBe('- **вода**');
    expect(parseTripPlanRichText(bullet.value)[0]).toEqual({
      kind: 'bullet',
      marker: '•',
      inlines: [{ text: 'вода', bold: true, italic: false }],
    });
    const heading = applyTripPlanFormat('## День 1', sel(0, 9), 'italic');
    expect(heading.value).toBe('## _День 1_');
    expect(parseTripPlanRichText(heading.value)[0].kind).toBe('day');
  });

  it('курсив не удаляет подчёркивания внутри адреса и snake_case — берёт фрагмент целиком через *', () => {
    const url = 'см https://ex.com/a_path_b';
    const once = applyTripPlanFormat(url, sel(url.indexOf('path') + 1), 'italic');
    expect(once.value).toBe('см *https://ex.com/a_path_b*');
    expect(parseTripPlanInline(once.value)[1]).toEqual({ text: 'https://ex.com/a_path_b', bold: false, italic: true });
    expect(applyTripPlanFormat(once.value, once.selection, 'italic').value).toBe(url);
    expect(applyTripPlanFormat('a_b_c', sel(2), 'italic').value).toBe('*a_b_c*');
  });

  it('курсив рядом с жирным не съедает звёздочку жирного', () => {
    const value = '**кафе**';
    const result = applyTripPlanFormat(value, sel(2, 6), 'italic');
    expect(result.value).toBe('**_кафе_**');
    expect(parseTripPlanInline(result.value)).toEqual([{ text: 'кафе', bold: true, italic: true }]);
  });

  it('P3 ревью: частичное выделение с одним маркером жирного дотягивается до пары', () => {
    const value = 'Ужин в **кафе** у озера';
    const bold = applyTripPlanFormat(value, sel(0, 13), 'bold');
    expect(bold.value).toBe('**Ужин в кафе** у озера');
    expect(parseTripPlanInline(bold.value)[0]).toEqual({ text: 'Ужин в кафе', bold: true, italic: false });
    expect(applyTripPlanFormat(bold.value, bold.selection, 'bold').value).toBe('Ужин в кафе у озера');
  });

  it('P3 ревью: жирный курсив текста с `_` не превращается в `***…***`', () => {
    const value = '**https://ex.com/a_b**';
    expect(applyTripPlanFormat(value, sel(2, 20), 'italic').value).toBe(value);
    expect(applyTripPlanFormat('*a_b*', sel(1, 4), 'bold').value).toBe('*a_b*');
  });

  it('P3 ревью: курсив снимается и при выделении части слова внутри жирного', () => {
    expect(applyTripPlanFormat('_**кафе**_', sel(4, 6), 'italic').value).toBe('**кафе**');
    expect(applyTripPlanFormat('_кафе_', sel(2, 4), 'italic').value).toBe('кафе');
  });
});
