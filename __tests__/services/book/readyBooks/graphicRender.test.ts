import {buildReadyBookHtml, type ReadyBookRenderInput} from '../../../../services/book/readyBooks/render';
import {renderReadyBookEndMap} from '../../../../services/book/readyBooks/render/endMap';
import {coverTextGeometry, imposedCoverTextGeometry} from '../../../../services/book/readyBooks/render/coverGeometry';
import {buildImpositionPlan} from '../../../../services/book/readyBooks/imposition';
import {makeEditorialDraft} from './fixtures';
import {runNodeCli} from '../../../scripts/cli-test-utils';
import {coverPersonalizationSchemaForStyle, publishedBookSchema} from '../../../../services/book/readyBooks/publication';
import {publishedFixture} from './publicationFixtures';

it('accepts exact graphic template geometry in production and publication while rejecting crossed edition palettes', () => {
  const book = {...publishedFixture(), visualStyle: 'graphic' as const};
  for (const template of book.coverPersonalization!.templates) template.textRegion.colorHex = '#111111';
  expect(coverPersonalizationSchemaForStyle('graphic').safeParse(book.coverPersonalization).success).toBe(true);
  expect(publishedBookSchema.safeParse(book).success).toBe(true);
  expect(coverPersonalizationSchemaForStyle().safeParse(book.coverPersonalization).success).toBe(false);
  expect(publishedBookSchema.safeParse({...book, visualStyle: 'fantasy'}).success).toBe(false);
  book.coverPersonalization!.templates[0].textRegion.colorHex = '#31443d';
  expect(coverPersonalizationSchemaForStyle('graphic').safeParse(book.coverPersonalization).success).toBe(false);
  expect(publishedBookSchema.safeParse(book).success).toBe(false);
});

it.each(['pocket-150x100', 'album-a5'] as const)('keeps the place/blank-page contract and uses approved ink geometry on %s', id => {
  const book = makeEditorialDraft(31);
  const asset = {dataUri: 'data:image/png;base64,aGVsbG8=', credit: 'Author 1', sourceUrl: 'https://metravel.by/travels/source', rights: 'Owner commissioned derivative', illustrated: true, widthPx: 1536, heightPx: 1024, artworkBounds: {left: 0, top: 0, width: 1, height: 1}};
  const font = 'data:font/ttf;base64,aGVsbG8=';
  const input: ReadyBookRenderInput = {book, profile: {id, widthMm: id === 'album-a5' ? 148 : 150, heightMm: id === 'album-a5' ? 210 : 100, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'}, purpose: 'read', assets: Object.fromEntries(book.stops.map(stop => [stop.id, asset])), cover: asset, fonts: {regular: font, bold: font, serif: font, heading: font}, qr: Object.fromEntries(book.stops.map(stop => [stop.id, {map: asset.dataUri, article: asset.dataUri, sizeMm: 22}]))};
  const old = buildReadyBookHtml(input);
  input.book = {...book, visualStyle: 'graphic'};
  const graphic = buildReadyBookHtml(input);
  expect(graphic.pageMap).toEqual(old.pageMap);
  expect(graphic.bodyPages).toHaveLength(108);
  expect(graphic.coverPages).toHaveLength(4);
  for (const [index, page] of graphic.pageMap.entries()) if (['photo-memory', 'notes', 'padding', 'extra-memory'].includes(page.kind)) expect(graphic.bodyPages[index]).toEqual(old.bodyPages[index]);
  const destination = graphic.pageMap.findIndex(page => page.kind === 'destination');
  expect(graphic.bodyPages[destination]).toContain('Графическая иллюстрация:');
  expect(graphic.bodyPages[destination]).toContain('Место на карте');
  expect(graphic.bodyPages[destination]).toContain('Статья на сайте');
  expect(graphic.bodyPages[destination]).not.toContain('Квест');
  expect(graphic.bodyHtml).toContain('Noto Serif и Noto Sans');
  const checklist = graphic.bodyPages.filter((_, index) => graphic.pageMap[index].kind === 'checklist').join('');
  expect((checklist.match(/class="checklist-box"/g) ?? [])).toHaveLength(31);
  expect(checklist).not.toContain('□');
  expect(old.bodyHtml).toContain('□');
  expect(graphic.stylesCss).toContain('body,h1,h2,.qr-link{color:#111}');
  expect(graphic.stylesCss).toContain('.book-page,.cover-quote-space{background:#fff}');
  if (id === 'album-a5') expect(graphic.stylesCss).toContain('left:9mm;top:43mm;width:130mm;height:86.66666666666667mm');
  else expect(graphic.bodyPages[destination]).toContain('class="art-crop"');
  const colors = [...renderReadyBookEndMap(input.book, {id}).matchAll(/(?:fill|stroke)="(#[a-f\d]+)"/g)].map(match => match[1]);
  expect(colors.length).toBeGreaterThan(0);
  expect(new Set(colors)).toEqual(new Set(['#fff', '#111']));
  const regular = coverTextGeometry(input.profile);
  const ink = coverTextGeometry(input.profile, 'graphic');
  expect(ink).toEqual({...regular, textRegion: {...regular.textRegion, colorHex: '#111111'}});
  expect(regular.textRegion.colorHex).toBe('#31443d');
  const plan = buildImpositionPlan({profileId: id, mode: 'home-rings', component: 'cover', pageCount: 4});
  expect(imposedCoverTextGeometry(input.profile, plan, 'graphic').textRegion.colorHex).toBe('#111111');
});

it('creates monochrome graphic QR and reports actual place/cover ppi without changing earlier styles', () => {
  const result = runNodeCli(['--input-type=module', '-e', `
    import {loadReadyBookInputs} from './scripts/books/render-ready-book.mjs';
    const asset={widthPx:1536,heightPx:1024,artworkBounds:{left:0,top:0,width:1,height:1}};
    const stop={id:'point-1',navigation:{mapUrl:'https://metravel.by/map?placeId=1',articleUrl:'https://metravel.by/travels/source'}};
    const source={book:{stops:[stop],visualStyle:'graphic'},assets:{'point-1':asset},cover:asset};
    const album=await loadReadyBookInputs('by','album-a5','read',{source});
    const pocket=await loadReadyBookInputs('by','pocket-150x100','read',{source});
    source.book.visualStyle='fantasy';
    const old=await loadReadyBookInputs('by','album-a5','read',{source});
    const svg=input=>Buffer.from(input.qr['point-1'].map.split(',')[1],'base64').toString('utf8');
    console.log(JSON.stringify({album:album.estimatedMinIllustrationPpi,pocket:pocket.estimatedMinIllustrationPpi,graphicQr:svg(album),oldQr:svg(old)}));
  `]);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout.trim());
  expect(report.album).toBe(264); // Full-width 148 mm cover is lower than the 130 mm place art.
  expect(report.pocket).toBe(629);
  expect(report.graphicQr).toContain('#111111');
  expect(report.graphicQr).toContain('#ffffff');
  expect(report.graphicQr).not.toContain('#4a6655');
  expect(report.oldQr).toContain('#4a6655');
  expect(report.oldQr).toContain('#fffefa');
});
