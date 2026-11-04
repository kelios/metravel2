import {buildPrintGuide,bookArtifactFilename} from '@/services/book/readyBooks/printingGuide';
import {publishedFixture} from './publicationFixtures';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';
import {renderPrintGuideHtml} from '@/scripts/books/render-print-guide-html.mjs';

describe('guide and supplemental publication',()=>{
  it.each([30,31,35])('derives paper counts and signatures from %s actual places',count=>{
    const book=publishedFixture(count);
    const a5=buildPrintGuide(book,'album-a5');
    expect(a5.signatures.reduce((n,size)=>n+size,0)).toBe(Math.ceil(book.bodyPageCount/4)*4);
    expect(a5.entries.every(file=>file.name===bookArtifactFilename(book,book.artifacts.find(artifact=>artifact.id===file.id)!))).toBe(true);
    expect(a5.passport.files).toHaveLength(2);
    expect(a5.passport.files[0].sha256).toBe(book.artifacts.find(a=>a.profileId==='album-a5'&&a.purpose==='print-shop')!.sha256);
    const pocket=buildPrintGuide(book,'pocket-150x100');
    expect(pocket.signatures).toEqual([]);
    expect(pocket.sections.some(s=>s.id==='sewn')).toBe(false);
    expect(pocket.photoMm).toEqual({width:100,height:70});
    expect(a5.photoMm).toEqual({width:108,height:158});
    expect(a5.sections.find(s=>s.id==='control')!.paragraphs.join(' ')).toContain('49–51');
  });
  function supplemented(){
    const book=publishedFixture();
    for(const profile of book.profiles){
      for(const [purpose,component,variant] of [['stickers','stickers','color'],['stickers','stickers','no-background'],['instructions','instructions',undefined],['print-passport','passport',undefined]] as const){
        const id=[profile.id,purpose,component,variant].filter(Boolean).join('.');
        book.artifacts.push({...book.artifacts[0],id,profileId:profile.id,purpose,component,...(variant?{variant}:{}),pageCount:2,outputPageMm:{width:210,height:297},uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/${id}.pdf`});
      }
    }
    book.missing=['provider-acceptance','paper-check'];
    return book;
  }
  it('accepts a complete digital kit while retaining physical limits',()=>{
    const book=publishedBookSchema.parse(supplemented());
    expect(book.status).toBe('partial');expect(book.quality.every(q=>!q.printReady)).toBe(true);
  });
  it('rejects misleading missing lists, lost variants and incomplete profiles',()=>{
    for(const change of [(b:ReturnType<typeof supplemented>)=>b.artifacts.pop(),(b:ReturnType<typeof supplemented>)=>b.missing.push('stickers'),(b:ReturnType<typeof supplemented>)=>{b.artifacts.find(a=>a.variant==='color')!.variant='no-background';},(b:ReturnType<typeof supplemented>)=>{b.artifacts.find(a=>a.purpose==='instructions')!.component='body';}]){
      const book=supplemented();change(book);expect(publishedBookSchema.safeParse(book).success).toBe(false);
    }
  });
  it('names every download in reader terms, uniquely and without revision hashes or profile ids (#2949)',()=>{
    const book=supplemented();
    const names=book.artifacts.map(file=>bookArtifactFilename(book,file));
    expect(new Set(names).size).toBe(names.length);
    for(const name of names){
      expect(name).toMatch(/^Беларусь — акварель — (A5|15×10) — .+\.pdf$/);
      expect(name).not.toContain(book.revision);
      expect(name).not.toMatch(/pocket-150x100|album-a5|home-rings|home-sewn|print-shop|\bread\b/);
    }
    expect(bookArtifactFilename(book,book.artifacts.find(file=>file.profileId==='album-a5'&&file.purpose==='read'&&file.component==='body')!)).toBe('Беларусь — акварель — A5 — страницы.pdf');
    expect(bookArtifactFilename({...book,visualStyle:'graphic'},book.artifacts[0])).toContain('Беларусь — графика — ');
    expect(bookArtifactFilename({...book,kind:'quests',volume:1},book.artifacts[0])).toContain('Беларусь — квесты, часть 1 — ');
  });
  it('prints counts with Russian plural forms and no physical-gate service notes (#2949)',()=>{
    const guide=buildPrintGuide(publishedFixture(31),'album-a5');
    expect(guide.summary).toMatch(/^31 место; \d+ страниц(а|ы)? в книге;/);
    expect(guide.passport.binding).toBe('кольца');
    expect(guide.passportSummary).not.toMatch(/не (подтверждены|выполнены)|ICC|PDF\/X/);
    expect(guide.sections.every(section=>!/^\d+\./.test(section.title))).toBe(true);
    expect(JSON.stringify(guide.sections)).not.toMatch(/\b(read|home-rings|home-sewn|print-shop)\b/);
  });
  it('names the guide\'s own PDFs in HTML although the model is built before they are published (augment-publication order)',()=>{
    const book=supplemented();
    book.artifacts=book.artifacts.map(file=>({...file,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/${file.id}.pdf`}));
    const own=(file:{purpose:string})=>file.purpose==='instructions'||file.purpose==='print-passport';
    const guide=buildPrintGuide({...book,artifacts:book.artifacts.filter(file=>!own(file))},'album-a5');
    const html=renderPrintGuideHtml(guide,{slug:book.slug,artifacts:book.artifacts});
    const names=[...html.matchAll(/download="([^"]+)"/g)].map(match=>match[1]);
    expect(names).toEqual(book.artifacts.filter(file=>file.profileId==='album-a5').map(file=>bookArtifactFilename(book,file)));
    expect(names).toEqual(expect.arrayContaining(['Беларусь — акварель — A5 — инструкция.pdf','Беларусь — акварель — A5 — паспорт печати.pdf']));
  });
});
