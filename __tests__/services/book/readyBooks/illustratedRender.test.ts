import {buildReadyBookHtml, type ReadyBookRenderInput} from '../../../../services/book/readyBooks/render';
import {makeEditorialDraft} from './fixtures';

it.each(['pocket-150x100', 'album-a5'] as const)('keeps the shared page/QR contract when fantasy type and copy are selected for %s', profileId => {
  const book = makeEditorialDraft(31);
  const asset = {dataUri: 'data:image/png;base64,aGVsbG8=', credit: 'Author 1', sourceUrl: 'https://metravel.by/travels/source', rights: 'Owner commissioned derivative', illustrated: true};
  const font = 'data:font/ttf;base64,aGVsbG8=';
  const source: ReadyBookRenderInput = {
    book,
    profile: {id: profileId, widthMm: profileId === 'album-a5' ? 148 : 150, heightMm: profileId === 'album-a5' ? 210 : 100, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'},
    purpose: 'read',
    assets: Object.fromEntries(book.stops.map(stop => [stop.id, asset])),
    cover: asset,
    fonts: {regular: font, bold: font, serif: font},
    qr: Object.fromEntries(book.stops.map(stop => [stop.id, {map: asset.dataUri, article: asset.dataUri, sizeMm: 22}])),
  };
  const watercolor = buildReadyBookHtml(source);
  source.book = {...book, visualStyle: 'fantasy'};
  source.fonts = {...source.fonts, heading: font};
  const fantasy = buildReadyBookHtml(source);
  expect(fantasy.pageMap).toEqual(watercolor.pageMap);
  expect(fantasy.bodyPages).toHaveLength(108);
  expect(fantasy.coverPages).toHaveLength(4);
  const destination = fantasy.pageMap.findIndex(page => page.kind === 'destination');
  expect(fantasy.bodyPages[destination]).toContain('Фэнтези-иллюстрация:');
  expect(fantasy.bodyPages[destination]).toContain('Место на карте');
  expect(fantasy.bodyPages[destination]).toContain('Статья на сайте');
  expect(fantasy.bodyPages[destination]).not.toContain('Квест');
  expect(fantasy.bodyPages[destination + 1]).toEqual(watercolor.bodyPages[destination + 1]);
  expect(fantasy.bodyPages[destination + 2]).toEqual(watercolor.bodyPages[destination + 2]);
  expect(fantasy.coverPages[0]).toContain('Фэнтези-иллюстрация места из книги');
  expect(fantasy.bodyHtml).toContain('Cormorant Garamond — The Cormorant Project Authors');
  expect(fantasy.bodyHtml).not.toContain('Основой акварелей');
  expect(fantasy.stylesCss).toContain('font-family:BookHeading,BookHand,serif');
  expect(watercolor.stylesCss).not.toContain('.destination-content::after');
  if (profileId === 'album-a5') {
    expect(fantasy.stylesCss).toContain('.destination-content::after{');
    expect(fantasy.stylesCss).toContain('top:130mm;height:44mm');
    expect(fantasy.stylesCss).toContain('.place-heading,.place-story,.qr-row{z-index:1}');
  } else expect(fantasy.stylesCss).not.toContain('.destination-content::after');
});
