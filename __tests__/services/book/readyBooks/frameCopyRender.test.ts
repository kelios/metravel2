import {buildReadyBookHtml, type ReadyBookRenderInput} from '../../../../services/book/readyBooks/render';
import {buildCountryQuestBookHtml} from '../../../../services/book/readyBooks/questBooks/volume';
import {bookFrameCopy} from '../../../../services/book/readyBooks/render/frameCopy';
import {buildStickerSheets} from '../../../../services/book/readyBooks/stickers';
import {buildCanvasMapViewport} from '../../../../utils/mapSnapshot/viewport';
import {countryQuestBookSchema} from '../../../../data/travelBooks/schema/questBooks';
import byQuests from '../../../../data/travelBooks/quests/by-volume-1.json';
import {makeEditorialDraft} from './fixtures';
import {thematicDraft} from './thematicFixtures';

const image = {dataUri: 'data:image/png;base64,aGVsbG8=', credit: 'Test author', sourceUrl: 'https://example.org/photo', rights: 'Owner commissioned artwork', illustrated: true};
const fonts = {regular: 'data:font/ttf;base64,aGVsbG8=', bold: 'data:font/ttf;base64,aGVsbG8=', serif: 'data:font/ttf;base64,aGVsbG8='};
function input(book: ReadyBookRenderInput['book'], profileId: 'pocket-150x100' | 'album-a5' = 'album-a5'): ReadyBookRenderInput {
  return {book, profile: {id: profileId, widthMm: profileId === 'album-a5' ? 148 : 150, heightMm: profileId === 'album-a5' ? 210 : 100, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'}, purpose: 'read',
    assets: Object.fromEntries(book.stops.map(stop => [stop.id, image])), cover: image,
    qr: Object.fromEntries(book.stops.map(stop => [stop.id, {map: image.dataUri, article: image.dataUri, sizeMm: 22}])), fonts};
}
const printed = (pages: string[]) => pages.join('').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

describe('edition frame copy comes from data, keyed by book id (#2947)', () => {
  it('prints the edition subtitle, epigraph, introduction, page guide, last page and covers', () => {
    const book = makeEditorialDraft(31);
    const result = buildReadyBookHtml(input(book));
    const copy = bookFrameCopy('belarus-memory');
    const page = (kind: string) => printed([result.bodyPages[result.pageMap.findIndex(entry => entry.kind === kind)]]);
    expect(page('title')).toContain(copy.subtitle);
    expect(page('title')).toContain(copy.epigraph);
    expect(page('preparation')).toContain(copy.intro.heading);
    expect(page('preparation')).toContain(copy.intro.text);
    expect(page('usage')).toContain(copy.usage.text);
    expect(page('credits')).toContain(copy.outro.heading);
    expect(page('credits')).toContain('MeTravel.by, ноябрь 2026.');
    expect(printed([result.coverPages[2]])).toContain(copy.endpaper.text);
    expect(printed([result.coverPages[3]])).toContain(copy.backCover.heading);
    const all = printed([...result.bodyPages, ...result.coverPages]);
    for (const retired of ['Для самостоятельных поездок, любимых кадров и своих историй', 'Путешествие продолжается', 'Место для вашей истории', 'Об этой книге', 'Перед поездкой']) expect(all).not.toContain(retired);
    // #2968: production notes never reach the reader.
    for (const note of ['полос', 'Сюда помещается', 'проверенной связи', 'физическая цель', 'авторского маршрута', 'Русский язык', 'масштабе 100%']) expect(all).not.toContain(note);
  });

  it('gives two editions with the same places different frame pages', () => {
    const belarus = buildReadyBookHtml(input(makeEditorialDraft(31)));
    const graphic = buildReadyBookHtml(input({...makeEditorialDraft(31), id: 'belarus-graphic-memory', visualStyle: 'graphic'}));
    for (const kind of ['title', 'preparation', 'usage', 'credits']) {
      const index = belarus.pageMap.findIndex(entry => entry.kind === kind);
      expect(graphic.bodyPages[index]).not.toBe(belarus.bodyPages[index]);
    }
    expect(graphic.coverPages[3]).not.toBe(belarus.coverPages[3]);
    expect(() => buildReadyBookHtml(input({...makeEditorialDraft(31), id: 'unknown-memory'}))).toThrow('No approved frame copy');
  });

  it('keeps memory pages blank: the stored prompt is never printed', () => {
    const book = makeEditorialDraft(31);
    book.stops[0].observation = 'Какая деталь запомнилась первой? Запишите.';
    const result = buildReadyBookHtml(input(book, 'pocket-150x100'));
    expect(printed(result.bodyPages)).not.toContain('Какая деталь запомнилась первой');
  });

  it('prints a fully Latin local name whole and keeps Belarusian local names out of print', () => {
    const book = thematicDraft(30);
    book.stops[0].localName = 'Zamek Morsko (Bąkowiec)';
    book.stops[1].localName = 'Іслач: Турыстычная паляна';
    const result = buildReadyBookHtml(input(book));
    const destinations = result.pageMap.flatMap((entry, index) => entry.kind === 'destination' ? [result.bodyPages[index]] : []);
    expect(destinations[0]).toContain('<p>Zamek Morsko (Bąkowiec)</p>');
    expect(destinations[1]).not.toContain('Турыстычная');
    expect(printed([result.bodyPages[result.pageMap.findIndex(entry => entry.kind === 'usage')]])).toContain(bookFrameCopy('poland-mountains-memory').usage.text);
  });

  it('prints the quest volume frame copy', () => {
    const book = {...countryQuestBookSchema.parse(byQuests), endMatterPages: ['country-map' as const]};
    const profile = {id: 'album-a5' as const, widthMm: 148, heightMm: 210, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings' as const};
    const assets = Object.fromEntries(book.quests.map(quest => [quest.questId, {coverDataUri: image.dataUri, mapDataUri: image.dataUri, mapViewport: buildCanvasMapViewport(quest.points, [], 128 * 5, 161 * 5, 17, 1.3), qrDataUri: image.dataUri, qrSizeMm: 22}]));
    const result = buildCountryQuestBookHtml({book, profile, purpose: 'read', fonts, assets, cover: {dataUri: image.dataUri, widthPx: 100, heightPx: 100}});
    const copy = bookFrameCopy(book.id);
    const all = printed([...result.bodyPages, ...result.coverPages]);
    for (const text of [copy.subtitle, copy.epigraph, copy.intro.text, copy.usage.text, copy.outro.text, copy.endpaper.text, copy.backCover.heading]) expect(all).toContain(text);
    expect(all).not.toContain('Ваша история путешествия');
    // #2968: a quest volume has no last page, so its endpaper carries the edition line with the format.
    expect(printed([result.coverPages[2]])).toMatch(/MeTravel\.by, ноябрь 2026\. Формат \d+×\d+ мм\./);
  });
});

it('prints the gender-neutral «Я здесь!» memory sticker (#2947)', () => {
  const sheets = buildStickerSheets({id: 'belarus-memory', revision: 'test-r1', stops: Array.from({length: 31}, (_, index) => ({id: `point-${index}`, title: `Место ${index}`}))}, 'color');
  const labels = sheets[1].stickers.map(sticker => sticker.label);
  expect(labels).toContain('Я здесь!');
  expect(labels).not.toContain('Был здесь');
});

