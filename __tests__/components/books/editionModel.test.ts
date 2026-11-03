import {formatDate,getFixedTranslator,i18n} from '@/i18n';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {bookT} from '@/components/books/bookCopy';
import {editionPages,moreBooks,promiseText,stopCountPhrase,versionLine} from '@/components/books/edition/editionModel';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';

const keyT=((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key) as typeof bookT;
const bySlug=(slug:string)=>readyBooks.find(book=>book.slug===slug)!;

describe('«Ещё книги» (owner decision 02.11.2026)',()=>{
  it('offers the other styles of the same country first, then the other country counterpart',()=>{
    expect(moreBooks(bySlug('belarus'),readyBooks).map(book=>book.slug)).toEqual(['belarus-photo','belarus-fantasy','belarus-graphic','poland']);
    expect(moreBooks(bySlug('poland-photo'),readyBooks).map(book=>book.slug)).toEqual(['poland','poland-fantasy','poland-graphic','belarus-photo']);
  });
  it('never repeats the current edition, returns at most four and varies families below the first tiers',()=>{
    for(const current of readyBooks){
      const picked=moreBooks(current,readyBooks);
      expect(picked.length).toBeLessThanOrEqual(4);
      expect(picked.map(book=>book.id)).not.toContain(current.id);
      expect(new Set(picked.map(book=>book.id)).size).toBe(picked.length);
    }
    // A quest book has no other styles: the other country's quest volume comes first.
    expect(moreBooks(bySlug('belarus-quests-1'),readyBooks)[0].slug).toBe('poland-quests-1');
  });
});

describe('edition copy helpers',()=>{
  afterEach(async()=>{await i18n.changeLanguage('ru');});
  it('names the count with the plural form of every interface language',async()=>{
    const cases:Record<string,[number,string][]>={
      ru:[[31,'31 место'],[30,'30 мест'],[22,'22 места'],[41,'41 квест']],
      be:[[31,'31 месца'],[30,'30 месцаў'],[22,'22 месцы']],
      uk:[[31,'31 місце'],[30,'30 місць'],[22,'22 місця']],
      pl:[[31,'31 miejsc'],[22,'22 miejsca'],[1,'1 miejsce']],
      en:[[31,'31 places'],[1,'1 place']],
    };
    for(const [locale,expected] of Object.entries(cases)){
      await i18n.changeLanguage(locale);
      for(const [count,text] of expected){
        const quests=text.includes('квест');
        expect(stopCountPhrase({kind:quests?'quests':'places',stopCount:count},bookT)).toBe(text);
      }
    }
  });
  it('picks one promise per edition family and fills it with the counted phrase',()=>{
    const promise=(slug:string)=>promiseText(bySlug(slug),keyT).split(':')[0];
    expect(promise('belarus')).toBe('promiseByCountry');
    expect(promise('belarus-photo')).toBe('promiseByCountry');
    expect(promise('poland')).toBe('promisePlCountry');
    expect(promise('poland-castles')).toBe('promisePlCastles');
    expect(promise('poland-mountains')).toBe('promisePlMountains');
    expect(promise('belarus-quests-1')).toBe('promiseByQuests');
    expect(promise('poland-quests-1')).toBe('promisePlQuests');
    for(const locale of ['ru','be','uk','pl','en']){
      const t=getFixedTranslator(locale);
      for(const key of ['promiseByCountry','promisePlCountry','promisePlCastles','promisePlMountains']){
        expect(t(`books:${key}` as never,{places:'31'})).toMatch(/^31\b/);
      }
      for(const key of ['promiseByQuests','promisePlQuests'])expect(t(`books:${key}` as never,{quests:'41'})).toMatch(/^41\b/);
    }
  });
  it('shows a dated revision as its day, falls back to the edition month and never shows a hash',()=>{
    const dated=versionLine('2026-11-01.photo.f556fd3ffcf3.07603515604d',keyT)!;
    expect(dated).toBe('versionDate:'+JSON.stringify({date:formatDate(Date.UTC(2026,10,1),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}));
    const hashed=versionLine('7a7f22a529343ba4ea6356a30107d610',keyT,'2026-11')!;
    expect(hashed).toBe('versionMonth:'+JSON.stringify({date:formatDate(Date.UTC(2026,10,1),{month:'long',year:'numeric',timeZone:'UTC'})}));
    expect(hashed).not.toContain('7a7f22a5');
    expect(versionLine('q1-951efb636b9a',keyT,'unknown')).toBeUndefined();
  });
  it('takes the hero spreads and the three «how» pages from the preview of the selected size',()=>{
    const book=publishedFixture(31);
    const first=book.stops[0].page;
    for(const profileId of ['pocket-150x100','album-a5'] as const){
      const pages=editionPages(book,profileId);
      const body=book.preview.find(preview=>preview.profileId===profileId&&preview.component==='body')!.pages;
      expect(pages.cover?.uri).toBe(book.preview.find(preview=>preview.profileId===profileId&&preview.component==='cover')!.pages[0].uri);
      expect(pages.spreads.map(spread=>spread.map(page=>page.number))).toEqual([[4,5],[first,first+1]]);
      expect(pages.how.map(page=>page.uri)).toEqual([body[first-1].uri,body[first].uri,body[first+1].uri]);
    }
    expect(editionPages({...book,preview:[]} as never,'pocket-150x100')).toEqual({spreads:[],how:[]});
  });
});
