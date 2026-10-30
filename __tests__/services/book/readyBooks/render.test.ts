import {buildReadyBookHtml, embeddedImage, type ReadyBookRenderInput} from '../../../../services/book/readyBooks/render';
import {makeEditorialDraft} from './fixtures';
import {buildReadyBookPagePlan} from '../../../../services/book/readyBooks/composition';

const image = {dataUri: 'data:image/png;base64,aGVsbG8=', credit: 'Test author', sourceUrl: 'https://example.org/photo', rights: 'Owner commissioned artwork', illustrated: true};
function input(profileId: 'pocket-150x100' | 'album-a5' = 'pocket-150x100', count=30): ReadyBookRenderInput {
  const book=makeEditorialDraft(count);
  return {book,profile:{id:profileId,widthMm:profileId==='album-a5'?148:150,heightMm:profileId==='album-a5'?210:100,bleedMm:0,safeMm:5,bindingMm:15,binding:'rings'},purpose:'read',assets:Object.fromEntries(book.stops.map(stop=>[stop.id,image])),cover:image,
    qr:Object.fromEntries(book.stops.map(stop=>[stop.id,{map:image.dataUri,article:image.dataUri,sizeMm:22}])),fonts:{regular:'data:font/ttf;base64,aGVsbG8=',bold:'data:font/ttf;base64,aGVsbG8=',serif:'data:font/ttf;base64,aGVsbG8='}};
}

describe('approved photo-diary physical rendering',()=>{
  it.each(['pocket-150x100','album-a5'] as const)('renders all three roles at native %s size',profile=>{
    const source=input(profile,31),result=buildReadyBookHtml(source);
    expect(result.bodyPages).toHaveLength(108);expect(result.coverPages).toHaveLength(4);
    expect(result.pageMap.filter(page=>page.kind==='destination')).toHaveLength(31);
    const first=result.pageMap.findIndex(page=>page.kind==='destination');
    expect(result.bodyPages[first]).toContain('Место на карте');expect(result.bodyPages[first]).toContain('Статья на сайте');expect(result.bodyPages[first]).not.toContain('Квест');
    expect(result.bodyPages[first+1]).toContain('personal-photo-space');expect(result.bodyPages[first+2]).toContain('blank-diary-space');
    for(const page of result.bodyPages.slice(first,first+3)){expect(page).not.toContain('<header>');expect(page).not.toContain('<footer>');expect(page).not.toContain('photo-frame');expect(page).not.toContain('class="lines"');}
    expect(result.stylesCss).toContain(`@page{size:${source.profile.widthMm}mm ${source.profile.heightMm}mm`);
    expect(result.stylesCss).toContain(profile==='album-a5'?'width:108mm;height:158mm':'width:100mm;height:70mm');
    if(profile==='pocket-150x100'){expect(result.stylesCss).toContain('bottom:5mm');expect(result.stylesCss).toContain('width:62mm;height:42mm');expect(result.stylesCss).toContain('.art-crop::after');}
    expect(result.stylesCss).toContain('font-family:BookHand');expect(result.stylesCss).toContain('#805e45');
    expect(result.stylesCss).not.toMatch(/\.place-story\{[^}]*overflow/);
  });
  it.each([
    ['pocket-150x100', 30, 104],
    ['pocket-150x100', 31, 107],
    ['album-a5', 30, 104],
    ['album-a5', 31, 107],
  ] as const)('renders the final %s map and its complete legend for %i places', (profile, count, mapFolio) => {
    const source = input(profile, count), result = buildReadyBookHtml(source);
    const plan = buildReadyBookPagePlan(source.book);
    expect(result.pageMap).toEqual(plan.map(({number, ...entry}) => ({folio: number, ...entry})));
    expect(result.pageMap.find(page => page.kind === 'destination')!.folio).toBe(8);
    const map = plan.find(page => page.kind === 'map')!;
    expect(map.number).toBe(mapFolio);
    expect(plan.filter(page => page.kind !== 'padding').at(-1)).toEqual(map);
    const mapHtml = result.bodyPages[map.number - 1];
    expect(mapHtml).toContain('Места этой книги на карте');
    expect(mapHtml).toContain(`data-country-outline="${source.book.country}"`);
    expect([...mapHtml.matchAll(/data-stop-id="([^"]+)"/g)].map(match => match[1])).toEqual(source.book.stops.map(stop => stop.id));
    expect(result.bodyPages.filter(page => page.includes('data-country-outline='))).toHaveLength(1);
    const legend = plan.filter(page => page.kind === 'checklist');
    const legendHtml = legend.map(page => result.bodyPages[page.number - 1]).join('');
    expect(legend.flatMap(page => page.stopIds)).toEqual(source.book.stops.map(stop => stop.id));
    for (const [index, stop] of source.book.stops.entries()) {
      const destination = plan.find(page => page.kind === 'destination' && page.stopId === stop.id)!;
      expect(legendHtml).toContain(`<li><span>□ ${index + 1}. ${stop.title}</span><span>${destination.number}</span></li>`);
    }
    expect(legend.at(-1)!.number).toBeLessThan(map.number);
  });
  it('omits a repeated local name that differs only by case',()=>{
    const source=input();source.book.stops[0].title='Мирский замок';source.book.stops[0].localName='Мирский Замок';const result=buildReadyBookHtml(source);const first=result.pageMap.findIndex(page=>page.kind==='destination');expect(result.bodyPages[first]).not.toContain('Мирский Замок');expect(result.bodyPages[first]).not.toContain('<p>');
  });
  it.each([
    ['экто тропа',''],
    ['Ошмяны - Боруны - граница Минской области',''],
    ['Замок Пескова-Скала (Zamek Pieskowa Skała)','Zamek Pieskowa Skała'],
    ['Zamek Rabsztyn','Zamek Rabsztyn'],
  ])('prints only a distinct native local name from %s',(localName,expected)=>{
    const source=input();source.book.stops[0].title='Замок';source.book.stops[0].localName=localName;const result=buildReadyBookHtml(source);const first=result.pageMap.findIndex(page=>page.kind==='destination');
    if(expected){expect(result.bodyPages[first]).toContain(`<p>${expected}</p>`);}else expect(result.bodyPages[first]).not.toContain('<p>');
  });
  it('prints a third QR only with a verified exact-place quest',()=>{
    const source=input();source.book.stops[0].navigation!.quest={url:'https://metravel.by/quests/16/mir-castle',id:16,evidence:'Verified exact-place step'};source.qr[source.book.stops[0].id].quest=image.dataUri;
    const result=buildReadyBookHtml(source);const first=result.pageMap.findIndex(page=>page.kind==='destination');expect(result.bodyPages[first]).toContain('>Квест</span>');expect(result.bodyPages[first]).toContain('/quests/16/mir-castle');
  });
  it('preserves bleed and separate numbering without rendering the retired prototype',()=>{
    const source=input();source.purpose='print-shop';source.profile.bleedMm=3;expect(buildReadyBookHtml(source).stylesCss).toContain('@page{size:156mm 106mm');expect(()=>buildReadyBookHtml(input('album-a5',12))).toThrow('at least 30');
    expect(buildReadyBookPagePlan(source.book).filter(page=>page.stopId===source.book.stops[0].id).map(page=>page.kind)).toEqual(['destination','photo-memory','notes']);
  });
  it('escapes editorial text and requires self-contained images and fonts',()=>{
    const source=input();source.book.stops[0].title='<script>alert("story")</script>';const result=buildReadyBookHtml(source);expect(result.bodyHtml).not.toContain('<script>');expect(result.bodyHtml).toContain('&lt;script&gt;');expect(()=>embeddedImage('https://example.org/image.jpg')).toThrow('embedded image');source.fonts.regular='https://example.org/font.ttf';expect(()=>buildReadyBookHtml(source)).toThrow('Embedded TTF');
  });
});
