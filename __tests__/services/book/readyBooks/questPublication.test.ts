/** @jest-environment node */
import {publishedFixture} from './publicationFixtures';
import {publishedBookSchema,publicationSchema} from '@/services/book/readyBooks/publication';
import {buildQuestBookPagePlan} from '@/services/book/readyBooks/questBooks/composition';
import current from '@/data/travelBooks/manifest.json';
const questFixture=()=>{
  const base=publishedFixture(),ids=['mir-castle','nesvizh-radziwill'];
  const plan=buildQuestBookPagePlan({quests:ids.map(questId=>({questId}))},{endMatterPages:['country-map']});
  const starts=plan.filter(page=>page.kind==='quest-story');
  return {...base,kind:'quests',id:'belarus-quests-1',slug:'belarus-quests-1',seriesId:'belarus-quests',volume:1,layoutVersion:3,endMatterPages:['country-map'],stopCount:2,bodyPageCount:plan.length,
    stops:ids.map((id,index)=>({id,questSlug:id,questId:index+12,title:id,sourceUrl:`https://metravel.by/quests/${index?'nesvizh':'mir'}/${id}`,page:starts[index].number})),
    artifacts:base.artifacts.map(asset=>({...asset,pageCount:asset.component==='body'&&asset.purpose!=='control'?(asset.purpose.startsWith('home-')?plan.length/2:plan.length):asset.pageCount})),
    preview:base.preview.map(group=>({...group,pages:group.component==='body'?group.pages.slice(0,plan.length):group.pages})),
  };
};
const canonicalFixture=(country:'BY'|'PL'='BY')=>{
 const book=questFixture();
 // Every immutable URI follows the new fixture identity, while all physical descriptors stay shared.
 const stem=country==='BY'?'belarus':'poland';
 return {...JSON.parse(JSON.stringify(book).split('/belarus-memory/').join(`/${stem}-quests-1/`)),id:`${stem}-quests-1`,slug:`${stem}-quests-1`,seriesId:`${stem}-quests`,country};
};
it('uses four-page quest composition without inventing place authors or articles',()=>{
 const book=publishedBookSchema.parse(canonicalFixture());expect(book.kind).toBe('quests');expect(book.bodyPageCount).toBe(12);
 if(book.kind!=='quests')throw new Error('Quest discriminator');
 expect(book.stops.map(stop=>stop.page)).toEqual([4,8]);expect(book.stops.every(stop=>!('authorId'in stop)&&!('sourceTravelId'in stop))).toBe(true);
 const books=current.books.filter(book=>(book as {kind?:string}).kind!=='quests');
 expect(publicationSchema.safeParse({schemaVersion:1,releaseId:'travel-books-v1',books:[...books,canonicalFixture(),canonicalFixture('PL')]}).success).toBe(true);
});
it('rejects swapped quest URLs, omitted pages, duplicate endings and fake place fields',()=>{
 const cases=[(b:ReturnType<typeof questFixture>)=>b.stops[0].sourceUrl='https://metravel.by/quests/mir/other-quest',(b:ReturnType<typeof questFixture>)=>b.bodyPageCount--,(b:ReturnType<typeof questFixture>)=>b.endMatterPages.push('country-map'),(b:ReturnType<typeof questFixture>)=>Object.assign(b.stops[0],{authorId:1,sourceTravelId:1})];
 for(const mutate of cases){const book=canonicalFixture();mutate(book);expect(publishedBookSchema.safeParse(book).success).toBe(false);}
});

it('accepts eight and ten additive editions while both original watercolor countries remain mandatory',()=>{
 const base=current.books.filter(book=>(book as {kind?:string}).kind!=='quests'&&book.visualStyle!=='graphic');
 const questPair=[canonicalFixture(),canonicalFixture('PL')];
 const graphicPair=base.filter(book=>!book.visualStyle).map(book=>{
   const stem=book.country==='BY'?'belarus':'poland',id=`${stem}-graphic-memory`;
   const graphic={...JSON.parse(JSON.stringify(book).split(`/${book.id}/`).join(`/${id}/`)),id,slug:`${stem}-graphic`,visualStyle:'graphic'};
   for(const template of graphic.coverPersonalization?.templates??[])template.textRegion.colorHex='#111111';
   return graphic;
 });
 expect(base).toHaveLength(6);
 for(const additions of [questPair,[...graphicPair,...questPair]]){
   const candidate={schemaVersion:1,releaseId:'travel-books-v1',books:[...base,...additions]};
   expect(candidate.books.length).toBe(additions.length===2?8:10);
   expect(publicationSchema.safeParse(candidate).success).toBe(true);
   for(const country of ['BY','PL']){
     const missing={...candidate,books:candidate.books.filter(book=>!(book.country===country&&!book.visualStyle&&(book as {kind?:string}).kind!=='quests'))};
     expect(publicationSchema.safeParse(missing).success).toBe(false);
   }
 }
});
