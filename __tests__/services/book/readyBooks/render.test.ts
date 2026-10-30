import {buildReadyBookHtml, embeddedImage, type ReadyBookRenderInput} from '../../../../services/book/readyBooks/render';
import {splitStory} from '../../../../services/book/readyBooks/render/pages';
import type {EditorialBookDraft} from '../../../../types/readyBook';

const draft = require('../../../../data/travelBooks/by/editorial.json') as EditorialBookDraft;
const image = {dataUri: 'data:image/png;base64,aGVsbG8=', credit: 'Test author', sourceUrl: 'https://example.org/photo', rights: 'CC BY 4.0', illustrated: false};
function input(profileId: 'pocket-150x100' | 'album-a5' = 'pocket-150x100'): ReadyBookRenderInput {
  return {book: structuredClone(draft), profile: {id: profileId, widthMm: profileId === 'album-a5' ? 148 : 150,
    heightMm: profileId === 'album-a5' ? 210 : 100, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'},
  purpose: 'read', assets: Object.fromEntries(draft.stops.map(stop => [stop.id, image])), cover: {...image, illustrated: true},
  qr: Object.fromEntries(draft.stops.map(stop => [stop.id, image.dataUri])),
  fonts: {regular: 'data:font/ttf;base64,aGVsbG8=', bold: 'data:font/ttf;base64,aGVsbG8=', serif: 'data:font/ttf;base64,aGVsbG8='}};
}

describe('ready-book physical rendering', () => {
  it.each(['pocket-150x100', 'album-a5'] as const)('keeps 56 internal pages and four separate covers in %s', id => {
    const book = input(id);
    const output = buildReadyBookHtml(book);
    expect(output.bodyPages).toHaveLength(56);
    expect(output.coverPages).toHaveLength(4);
    expect(output.pageMap[5]).toEqual({folio: 6, kind: 'destination', stopId: draft.stops[0].id});
    expect(output.pageMap[49]).toEqual({folio: 50, kind: 'destination', stopId: draft.stops[11].id});
    expect(output.bodyPages[5]).toContain('class="book-page left');
    expect(output.bodyPages[6]).toContain('class="book-page right');
    expect(output.stylesCss).toContain(`@page{size:${book.profile.widthMm}mm ${book.profile.heightMm}mm`);
    expect(output.stylesCss).toContain(id === 'album-a5' ? 'width:108mm;height:158mm' : 'width:100mm;height:70mm');
    expect(output.stylesCss).toContain(id === 'album-a5' ? 'font-size:10.5pt' : 'font-size:9pt');
    expect(output.bodyPages[8]).toContain(image.credit);
    expect(output.bodyPages[8]).toContain(image.sourceUrl);
    expect(output.bodyHtml).not.toContain('overflow:hidden');
  });

  it('extends only production page boxes, preserving the trim dimensions and margins', () => {
    const book = input();
    book.purpose = 'print-shop';
    book.profile.bleedMm = 3;
    const output = buildReadyBookHtml(book);
    expect(output.stylesCss).toContain('@page{size:156mm 106mm');
    expect(output.stylesCss).toContain('left:3mm;top:3mm;width:150mm;height:100mm');
    expect(output.bodyPages[5]).toContain('--inner:15mm;--outer:5mm');
    expect(output.bodyHtml).not.toMatch(/CMYK|PDF\/X/);
  });

  it('prints mountain metrics, direction and current safety sources in the same stop block', () => {
    const book = input();
    book.book.stops[0].natureRoute = {name: 'Тестовый горный маршрут', direction: 'one-way', distanceKm: 2.4,
      elevationGainM: 226, durationMinutes: 60, difficulty: 'Камни могут быть скользкими.', seasonality: 'Проверить снег и закрытия.',
      officialAlertsUrl: 'https://example.org/alerts', metricsSourceUrl: 'https://example.org/route', metricNote: 'Опубликованный ориентир.'};
    const html = buildReadyBookHtml(book).bodyPages[8].replace(/\u00a0/g, ' ');
    for (const value of ['2,4 км', '226 м', '60 мин', 'в одну сторону; обратный путь добавляется', 'Камни могут быть скользкими.', 'Проверить снег и закрытия.', 'https://example.org/alerts', 'https://example.org/route']) expect(html).toContain(value);
    book.book.stops[0].source.url = book.book.stops[0].natureRoute.metricsSourceUrl;
    const sharedSource = buildReadyBookHtml(book).bodyPages[8];
    expect(sharedSource.match(/href="https:\/\/example.org\/route"/g)).toHaveLength(1);
    expect(sharedSource).toContain(image.sourceUrl);
    expect(sharedSource).not.toContain('История и посещение:');
    const memory = buildReadyBookHtml(book).bodyPages[6];
    expect(memory).toContain('<header>Дата');
    expect(memory).not.toContain('<p class="small">Дата');
  });

  it('retains every word when the story continues on the notes page', () => {
    const source = Array.from({length: 90}, (_, index) => `слово${index}`).join(' ');
    for (const pocket of [true, false]) {
      const parts = splitStory(source, pocket);
      expect(parts.filter(Boolean).join(' ')).toBe(source);
      expect(parts[0].length).toBeLessThanOrEqual(pocket ? 385 : 730);
    }
  });

  it('escapes editorial text and requires self-contained images and fonts', () => {
    const book = input();
    book.book.stops[0].title = '<script>alert("story")</script>';
    const output = buildReadyBookHtml(book);
    expect(output.bodyHtml).toContain('&lt;script&gt;alert(&quot;story&quot;)&lt;/script&gt;');
    expect(output.bodyHtml).not.toContain('<script>');
    expect(() => embeddedImage('https://example.org/picture.jpg')).toThrow('embedded image');
    book.fonts.regular = 'https://example.org/font.ttf';
    expect(() => buildReadyBookHtml(book)).toThrow('Embedded TTF');
  });

  it('rejects missing media, invalid margins and bleed in reading files', () => {
    const book = input();
    delete book.assets[book.book.stops[0].id];
    expect(() => buildReadyBookHtml(book)).toThrow('Missing image');
    const invalid = input();
    invalid.profile.bindingMm = 50;
    expect(() => buildReadyBookHtml(invalid)).toThrow();
    const bleeding = input();
    bleeding.profile.bleedMm = 2;
    expect(() => buildReadyBookHtml(bleeding)).toThrow('Bleed');
  });
});
