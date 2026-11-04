import {printQuestLabel,questPrintMetadata} from '@/services/book/readyBooks/questBooks/labels';
import {i18n} from '@/i18n';
import {buildQuestBookBlockPlan,buildQuestBookPagePlan} from '@/services/book/readyBooks/questBooks/composition';
import {buildQuestBookBlockHtml} from '@/services/book/readyBooks/questBooks/render';
import {buildCanvasMapViewport,projectCanvasMapPoint} from '@/utils/mapSnapshot/viewport';
import {countryQuestBookSchema} from '@/data/travelBooks/schema/questBooks';
import by from '@/data/travelBooks/quests/by-volume-1.json';
import pl from '@/data/travelBooks/quests/pl-volume-1.json';
const bookLocale='ru' as const;
const books=[countryQuestBookSchema.parse(by),countryQuestBookSchema.parse(pl)];
const image='data:image/png;base64,aGVsbG8=';
const font='data:font/ttf;base64,aGVsbG8=';

test('keeps printed duration formatting in Russian when the interface uses another locale',async()=>{
  try{
    for(const locale of ['en','pl'] as const){
      await i18n.changeLanguage(locale);
      const label=questPrintMetadata({durationMinutes:90.5,difficulty:'easy',tags:[]});
      expect(label).toMatch(/^90,5\s+мин(?:\.|\s|$)/);
      expect(label).toContain('лёгкий');
    }
  }finally{await i18n.changeLanguage('ru');}
});

test('preserves all 78 source quests and668points, with no raw answers, hints or personal counters',()=>{
  expect(books.map(book=>book.quests.length)).toEqual([41,37]);
  expect(books.map(book=>book.quests.reduce((sum,quest)=>sum+quest.points.length,0))).toEqual([330,338]);
  expect(JSON.stringify(books)).not.toMatch(/"(?:answer_pattern|hint|task|views_count|completions_count|first_completer)"/);
  for(const book of books){
    const plan=buildQuestBookPagePlan(book,{endMatterPages:['country-map']});
    expect(plan.length%2).toBe(0);
    expect(plan.filter(page=>page.kind==='quest-story').map(page=>page.questId)).toEqual(book.quests.map(quest=>quest.questId));
    for(const quest of book.quests){
      const pages=plan.filter(page=>page.questId===quest.questId);
      expect(pages.map(page=>page.kind)).toEqual(['quest-story','quest-map','photo-memory','notes']);
      expect(pages[0].number%2).toBe(0);
    }
  }
});
test('rejects duplicate quest IDs and a right-hand information folio',()=>{
  expect(()=>buildQuestBookBlockPlan(['mir-castle','mir-castle'])).toThrow();
  expect(()=>buildQuestBookBlockPlan(['mir-castle'],3)).toThrow();
});
test.each(['pocket-150x100','album-a5'] as const)('renders every longest-case point and keeps personal pages empty (%s)',id=>{
  const quest=books.flatMap(book=>book.quests).find(quest=>quest.questId==='hel-jurata-amber')!;
  const profile={id,widthMm:id==='album-a5'?148:150,heightMm:id==='album-a5'?210:100,bleedMm:0,safeMm:5,bindingMm:15,binding:'rings' as const};
  const widthMm=profile.widthMm-20,heightMm=id==='album-a5'?161:55;
  const viewport=buildCanvasMapViewport(quest.points,[],widthMm*5,heightMm*5,17,1.3);
  const render=buildQuestBookBlockHtml({quest,contentLocale:bookLocale,profile,fonts:{regular:font,bold:font,serif:font},assets:{coverDataUri:image,mapDataUri:image,mapViewport:viewport,qrDataUri:image,qrSizeMm:22}});
  expect(render.pages).toHaveLength(4);
  for(const point of quest.points){
    expect(render.pages[0]).toContain(printQuestLabel(point.title).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
    expect(render.pages[1]).toContain(`data-point-id="${point.stepId}"`);
  }
  expect(render.pages[0]).toContain(quest.questUrl);
  expect(render.pages[1]).toContain('© OpenStreetMap contributors');
  expect(render.pages[1]).toContain('>openstreetmap.org/copyright</a>');
  expect(render.pages[1]).not.toContain('<polyline');
  expect(render.pages[2]).toMatch(/<div class="trim"><\/div>/);
  expect(render.pages[3]).toMatch(/<div class="trim"><\/div>/);
});
test('one viewport projects all selected points within the authored raster',()=>{
  for(const quest of books.flatMap(book=>book.quests)){
    const viewport=buildCanvasMapViewport(quest.points,[],756,951,17,1.3);
    for(const point of quest.points){const pixel=projectCanvasMapPoint(viewport,point.lat,point.lng);expect(pixel.x).toBeGreaterThanOrEqual(0);expect(pixel.x).toBeLessThanOrEqual(756);expect(pixel.y).toBeGreaterThanOrEqual(0);expect(pixel.y).toBeLessThanOrEqual(951);}
  }
});
