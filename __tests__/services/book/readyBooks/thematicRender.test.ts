import {buildReadyBookHtml, type ReadyBookRenderInput} from '@/services/book/readyBooks/render';
import {renderThematicFacts, thematicPhotoPlacement} from '@/services/book/readyBooks/render/thematic';
import {thematicDraft, thematicEvidence} from './thematicFixtures';

it('prints scoped ranges, current warnings and context caption without replacing blank personal pages',()=>{
  const book=thematicDraft(40);
  book.title='Горы Польши';
  book.visualStyle='photo';
  const stop=book.stops[0];
  stop.thematic.media.depiction='context';
  stop.thematic.media.caption='Зимний массив; вершина и крест не видны.';
  stop.thematic.route!.availability.note='Не заходите за ограждение повреждённой плотины.';
  const image={dataUri:'data:image/png;base64,aGVsbG8=',widthPx:1000,heightPx:800,credit:'Test',sourceUrl:stop.thematic.articleUrl,rights:'Owner commissioned',illustrated:false};
  const input:ReadyBookRenderInput={book,profile:{id:'pocket-150x100',widthMm:150,heightMm:100,bleedMm:0,safeMm:5,bindingMm:15,binding:'rings'},purpose:'read',
    assets:Object.fromEntries(book.stops.map(place=>[place.id,image])),cover:image,
    qr:Object.fromEntries(book.stops.map(place=>[place.id,{map:image.dataUri,article:image.dataUri,sizeMm:22}])),
    fonts:{regular:'data:font/ttf;base64,aGVsbG8=',bold:'data:font/ttf;base64,aGVsbG8=',serif:'data:font/ttf;base64,aGVsbG8='}};
  const result=buildReadyBookHtml(input),first=result.pageMap.findIndex(page=>page.kind==='destination');
  expect(result.bodyPages).toHaveLength(136);
  expect(result.coverPages[0]).toContain('<h1>Горы Польши</h1>');
  expect(result.bodyPages[first]).toContain('Зимний массив; вершина и крест не видны.');
  expect(result.bodyPages[first]).toContain('5–6 км · ↑ 965 м · 195 мин.');
  expect(result.bodyPages[first]).toContain('Не заходите за ограждение повреждённой плотины.');
  expect(result.bodyPages[first]).toContain('Доступ (2026-11-02)');
  expect(result.bodyPages[first]).toContain('Оценка провайдера:');
  expect(result.bodyPages[first]).toContain('href="https://park.example/trail"');
  expect(result.bodyPages[first]).toContain('href="https://park.example/notices"');
  expect(result.bodyPages[first]).toContain('data-thematic-photo="stop-0"');
  expect(result.bodyPages[first+1]).toContain('personal-photo-space');
  expect(result.bodyPages[first+1]).not.toContain('Маршрут-справка');
  expect(result.bodyPages[first+2]).toContain('blank-diary-space');
  expect(result.stylesCss).not.toContain('text-overflow');
});

it('keeps actual native photo placement within the measured profile box',()=>{
  for(const profile of ['pocket-150x100','album-a5']){
    const placed=thematicPhotoPlacement(4240,2400,profile);
    expect(placed.width/placed.height).toBeCloseTo(4240/2400);
    expect(placed.width).toBeLessThanOrEqual(profile==='album-a5'?118:58);
    expect(placed.height).toBeLessThanOrEqual(profile==='album-a5'?53:30);
    expect(placed.effectivePpi).toBeCloseTo(4240*25.4/placed.width);
  }
  const evidence=thematicEvidence();
  evidence.route!.metricNote='<script>unsafe</script>';
  expect(renderThematicFacts(evidence)).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
});
